import supabase from "../config/supabaseclient.js";
import transporter from "../config/nodemailer.js";

/**
 * Controller: createReservation
 * Mengelola proses pembuatan booking baru oleh Customer.
 * Alur: Validasi User -> Cek Duplikasi Booking -> Cek Stok Unit -> Insert Data -> Email & Notifikasi.
 */
export const createReservation = async (req, res) => {
  const { id_user, id_pt, id_house, reservation_status } = req.body;

  try {
    // 1. Verifikasi Data User
    const { data: userData, error: userError } = await supabase
      .from("user")
      .select("name, email")
      .eq("id_user", id_user)
      .single();
    if (userError || !userData) throw new Error("User not found.");

    const userName = userData.name;
    const userEmail = userData.email;

    // 2. Validasi Duplikasi: Customer tidak boleh punya lebih dari satu reservasi aktif (pending/accepted)
    const { data: existingUserReservation, error: existingError } =
      await supabase
        .from("reservation")
        .select("*")
        .eq("id_user", id_user)
        .in("reservation_status", ["pending", "accepted"]);
    
    if (existingError) throw existingError;

    if (existingUserReservation && existingUserReservation.length > 0) {
      return res.status(400).json({
        success: false,
        error: "You still have an unfinished reservation. Please complete it first.",
      });
    }

    // 3. Verifikasi Ketersediaan Unit Rumah
    const { data: houseData, error: houseError } = await supabase
      .from("houses")
      .select(`
        id_house, id_admin, status, number_block,
        block:block(id_block, block_name, residence:residence(id_residence, residence_name))
      `)
      .eq("id_house", id_house)
      .single();
    
    if (houseError) throw houseError;

    if (!houseData || ["reserved", "sold"].includes(houseData.status)) {
      return res.status(400).json({
        success: false,
        error: "The house is no longer available.",
      });
    }

    // 4. Pengaturan Masa Berlaku (H+7)
    const start_date = new Date().toISOString();
    const end_date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 5. Transaksi: Simpan Reservasi Baru
    const { data: reservation, error: insertError } = await supabase
      .from("reservation")
      .insert([{ id_user, id_pt, id_house, start_date, end_date, reservation_status }])
      .select();
    
    if (insertError) throw insertError;
    const newReservation = reservation[0];

    // 6. Update Status Unit menjadi 'reserved' agar tidak bisa dipesan orang lain
    await supabase.from("houses").update({ status: "reserved" }).eq("id_house", id_house);

    const residenceName = houseData.block?.residence?.residence_name;
    const sendTime = new Date().toISOString();

    // 7. Pencatatan Log Email ke Database
    await supabase.from("email").insert({
      id_user,
      id_reservasi: newReservation.id_reservasi,
      send_time: sendTime,
      deskripsi: `Reservation for house in ${residenceName} successfully created.`,
    });

    // 8. Ambil Kontak Admin untuk dikirimkan ke Customer asik
    const { data: adminData } = await supabase
      .from("admin")
      .select("username, phone")
      .eq("id_admin", houseData.id_admin)
      .single();

    const adminName = adminData?.username || "Admin";
    const adminPhone = adminData?.phone || "-";

    // 9. Pengiriman Email Konfirmasi ke Customer
    if (userEmail) {
      const formattedUserName = userName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      const houseFullName = `${residenceName} — Block ${houseData.block?.block_name} No. ${houseData.number_block}`;

      await transporter.sendMail({
        from: `"Ibravia" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: `${residenceName} — Reservation Created`,
        html: `
          <h2>${residenceName}</h2>
          <p>Hello <b>${formattedUserName}</b>,</p>
          <p>Your reservation for <b>${houseFullName}</b> has been successfully created.</p>
          <p><b>Start Date:</b> ${new Date(start_date).toLocaleDateString()}</p>
          <p><b>End Date:</b> ${new Date(end_date).toLocaleDateString()}</p>
          <p>Please contact our admin: +62 <b>${adminPhone}</b> (${adminName}) within 7 days to confirm payment.</p>
          <p>Thank you for choosing Ibravia.</p>
        `,
      });
    }

    // 10. Pengiriman Notifikasi ke Panel Admin (Dashboard Admin)
    await supabase.from("notification").insert({
      id_admin: houseData.id_admin,
      id_reservasi: newReservation.id_reservasi,
      id_pt,
      content: `New reservation by ${userName} for unit ${houseData.number_block}.`,
      send_time: sendTime,
      read_status: false,
    });

    res.json({
      success: true,
      message: "Reservation created successfully!",
      reservation: newReservation,
    });
  } catch (err) {
    console.error("Reservation error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Controller: getReservationsByUser
 * Mengambil seluruh riwayat reservasi milik satu pengguna tertentu.
 * Alur: Query Join -> Formatting Deskripsi Ruangan -> Respon JSON.
 */
export const getReservationsByUser = async (req, res) => {
  const { id_user } = req.params;

  try {
    const { data, error } = await supabase
      .from("reservation")
      .select(`
        id_reservasi, start_date, end_date, reservation_status,
        house:houses (
          id_house, number_block,
          block:block (
            id_block, block_name, bathroom, bedroom, living_room, family_room, kitchen,
            residence:residence (residence_name)
          )
        )
      `)
      .eq("id_user", id_user);

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ message: "No reservations found." });

    // Formatting data untuk tampilan kartu (Card) di frontend
    const formatted = data.map((item) => {
      const block = item.house?.block || {};
      const details = [
        block.bedroom ? `${block.bedroom} Bedroom(s)` : null,
        block.bathroom ? `${block.bathroom} Bathroom(s)` : null,
        block.living_room && block.family_room ? "Living & Family Room" : block.living_room ? "Living Room" : block.family_room ? "Family Room" : null,
        block.kitchen ? "Kitchen" : null,
      ].filter(Boolean);

      return {
        id_reservasi: item.id_reservasi,
        start_date: item.start_date,
        end_date: item.end_date,
        reservation_status: item.reservation_status,
        number_block: item.house?.number_block,
        block_name: block.block_name,
        residence_name: block.residence?.residence_name,
        description: details.join(", "),
      };
    });

    res.status(200).json({ reservations: formatted });
  } catch (err) {
    console.error("Error getReservationsByUser:", err.message);
    res.status(500).json({ error: "Failed to fetch user reservations." });
  }
};