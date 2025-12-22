import supabase from "../config/supabaseclient.js";
import transporter from "../config/nodemailer.js";

/**
 * Helper: addDays
 * Menghitung penambahan hari pada objek Date.
 * Digunakan untuk menghitung deadline pembayaran/konfirmasi (H+7).
 */
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Helper: sendEmailAndLog
 * Mengirim notifikasi email kepada pengguna melalui Nodemailer dan
 * mencatat riwayat pengiriman email tersebut ke tabel 'email' di database.
 */
const sendEmailAndLog = async (
  id_user,
  id_reservasi,
  toEmail,
  userName,
  type,
  houseDetails
) => {
  let subject, text, deskripsiLog;

  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Mengekstrak informasi blok dan nomor rumah dari string detail
  const match = houseDetails.match(/Block\s+([A-Za-z0-9]+)\s+No\.\s+([A-Za-z0-9]+)/);
  const blockName = match ? match[1] : "-";
  const houseNumber = match ? match[2] : "-";

  // Konfigurasi konten email untuk status Accepted
  if (type === "accepted") {
    subject = "Your Reservation Has Been Approved - Ibravia";
    text = `Dear ${userName},

Thank you for choosing Ibravia.
We are pleased to inform you that your reservation has been approved.

Property Details:
- Block Name: ${blockName}
- House Number: ${houseNumber}
- Reservation Date: ${formattedDate}

Next step: Please contact the housing administrator to discuss further arrangements.
If you have questions, contact us at ibraviaku@gmail.com

Warm regards,
The Ibravia Team`;

    deskripsiLog = `Reservation for ${houseDetails} accepted. Email notification sent.`;
  }

  // Konfigurasi konten email untuk status Cancelled
  else if (type === "cancelled") {
    subject = "Reservation Cancelled - Ibravia";
    text = `Dear ${userName},

Thank you for choosing Ibravia.
We regret to inform you that your reservation request has been declined.

Property Details:
- Block Name: ${blockName}
- House Number: ${houseNumber}
- Reservation Date: ${formattedDate}

You are welcome to make another reservation for a different unit.
If you have questions, contact us at ibraviaku@gmail.com

Warm regards,
The Ibravia Team`;

    deskripsiLog = `Reservation for ${houseDetails} cancelled. Email notification sent.`;
  }

  else {
    console.warn("Unknown email type:", type);
    return;
  }

  // Proses pengiriman email melalui SMTP
  try {
    await transporter.sendMail({
      from: `"Ibravia" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      text,
    });
    console.log(`Email (${type}) sent to ${toEmail}`);
  } catch (emailError) {
    console.error("Failed to send email:", emailError.message);
  }

  // Mencatat log aktivitas ke database untuk audit trail
  try {
    const { error: logError } = await supabase.from("email").insert([
      {
        id_user,
        id_reservasi,
        deskripsi: deskripsiLog,
      },
    ]);
    if (logError) console.error("Failed to log email:", logError.message);
    else console.log("Email log recorded");
  } catch (dbError) {
    console.error("Error logging email notification:", dbError.message);
  }
};

/**
 * Controller: getAdminManageReservation
 * Mengambil daftar reservasi dengan status 'Pending' yang masuk ke residence admin.
 * Fungsi ini juga memiliki logika 'Auto-Expired' untuk otomatis membatalkan reservasi yang lewat 7 hari.
 */
export const getAdminManageReservation = async (req, res) => {
  try {
    const { id_residence } = req.admin || {};
    if (!id_residence) {
      return res.status(403).json({ error: "Admin not authenticated." });
    }

    // Mengambil semua rumah di bawah residence admin
    const { data: houses, error: houseError } = await supabase
      .from("houses")
      .select("id_house, id_block")
      .eq("id_residence", id_residence);

    if (houseError) throw houseError;
    if (!houses?.length) return res.status(200).json([]);

    const houseIds = houses.map((h) => h.id_house);

    // Mengambil detail reservasi, rumah, blok, dan data user (Join Multi-tabel)
    const { data: reservationsData, error: reservationError } = await supabase
      .from("reservation")
      .select(`
        id_reservasi,
        start_date,
        reservation_status,
        id_house,
        id_user,
        houses (
          number_block,
          land_area,
          house_area,
          status,
          block (
            id_block,
            block_name,
            id_residence,
            bedroom,
            bathroom,
            living_room,
            family_room,
            kitchen,
            residence ( residence_name, location )
          )
        ),
        user ( id_user, name, email )
      `)
      .in("id_house", houseIds)
      .in("reservation_status", ["Pending", "pending"])
      .order("start_date", { ascending: false });

    if (reservationError) throw reservationError;
    if (!reservationsData?.length) return res.status(200).json([]);

    const now = new Date();
    const updates = [];

    // Transformasi data dan pengecekan masa berlaku (H+7)
    const processedReservations = reservationsData.map((r) => {
      const house = r.houses || {};
      const block = house.block || {};
      const residence = block.residence || {};
      const user = r.user || {};

      // Logika Auto-Expired: Jika sudah lewat 7 hari, status otomatis diubah di DB
      if (r.reservation_status === "Pending") {
        const reservationDate = new Date(r.start_date);
        const deadlineDate = addDays(reservationDate, 7);
        if (deadlineDate < now) {
          updates.push(
            supabase.from("reservation").update({ reservation_status: "Expired" }).eq("id_reservasi", r.id_reservasi)
          );
          updates.push(
            supabase.from("houses").update({ status: "available" }).eq("id_house", r.id_house)
          );
          r.reservation_status = "Expired";
        }
      }

      // Menyusun deskripsi fitur rumah
      const descriptionParts = [];
      if (block.bedroom) descriptionParts.push(`${block.bedroom} Bedroom${block.bedroom > 1 ? "s" : ""}`);
      if (block.bathroom) descriptionParts.push(`${block.bathroom} Bathroom${block.bathroom > 1 ? "s" : ""}`);
      if (block.living_room) descriptionParts.push("Living Room");
      if (block.family_room) descriptionParts.push("Family Room");
      if (block.kitchen) descriptionParts.push("Kitchen");

      return {
        id_reservasi: r.id_reservasi,
        id_house: r.id_house,
        name: user.name || "-",
        email: user.email || "-",
        block_name: block.block_name || "Unknown Block",
        number_house: house.number_block || "-",
        land_area: house.land_area || "-",
        building_area: house.house_area || "-",
        status: r.reservation_status || "Pending",
        reservation_date: r.start_date || "-",
        deadline_date: addDays(new Date(r.start_date), 7).toISOString(),
        description: descriptionParts.length > 0 ? descriptionParts.join(", ") : "House details unavailable",
        address: residence.location || "Location not available",
        residence_name: residence.residence_name || "Unknown Residence",
      };
    });

    if (updates.length > 0) await Promise.all(updates);

    res.status(200).json(processedReservations);
  } catch (err) {
    console.error("Failed to fetch manage reservation data:", err);
    res.status(500).json({ error: "Failed to fetch reservation data." });
  }
};

/**
 * Controller: acceptReservation
 * Menyetujui reservasi: Mengubah status reservasi menjadi 'accepted' 
 * dan status rumah menjadi 'sold', lalu mengirim email konfirmasi.
 */
export const acceptReservation = async (req, res) => {
  const { id_reservasi, id_house } = req.body;

  try {
    const { data: resData, error: fetchError } = await supabase
      .from("reservation")
      .select(`id_user, user ( email, name ), houses ( number_block, block ( block_name ) )`)
      .eq("id_reservasi", id_reservasi)
      .single();

    if (fetchError || !resData) throw new Error("Reservation not found");

    await supabase.from("reservation").update({ reservation_status: "accepted" }).eq("id_reservasi", id_reservasi);
    await supabase.from("houses").update({ status: "sold" }).eq("id_house", id_house);

    if (resData.user?.email) {
      const houseDetails = `Block ${resData.houses?.block?.block_name || "?"} No. ${resData.houses?.number_block || "?"}`;
      await sendEmailAndLog(resData.id_user, id_reservasi, resData.user.email, resData.user.name, "accepted", houseDetails);
    }

    res.status(200).json({ message: "Reservation accepted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Controller: cancelReservation
 * Membatalkan reservasi: Mengubah status reservasi menjadi 'cancelled'
 * dan mengembalikan status rumah menjadi 'available'.
 */
export const cancelReservation = async (req, res) => {
  const { id_reservasi, id_house } = req.body;

  try {
    const { data: resData, error: fetchError } = await supabase
      .from("reservation")
      .select(`id_user, user ( email, name ), houses ( number_block, block ( block_name ) )`)
      .eq("id_reservasi", id_reservasi)
      .single();

    if (fetchError || !resData) throw new Error("Reservation not found");

    await supabase.from("reservation").update({ reservation_status: "cancelled" }).eq("id_reservasi", id_reservasi);
    await supabase.from("houses").update({ status: "available" }).eq("id_house", id_house);

    if (resData.user?.email) {
      const houseDetails = `Block ${resData.houses?.block?.block_name || "?"} No. ${resData.houses?.number_block || "?"}`;
      await sendEmailAndLog(resData.id_user, id_reservasi, resData.user.email, resData.user.name, "cancelled", houseDetails);
    }

    res.status(200).json({ message: "Reservation cancelled." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};