// file: controllers/reservationController.js
import supabase from "../config/supabaseclient.js";
import transporter from "../config/nodemailer.js";

export const createReservation = async (req, res) => {
  const { id_user, id_pt, id_house, reservation_status } = req.body;

  try {
    // ============= FETCH USER DATA =====================
    const { data: userData, error: userError } = await supabase
      .from("user")
      .select("name, email")
      .eq("id_user", id_user)
      .single();
    if (userError) throw userError;
    if (!userData) throw new Error("User not found.");

    const userName = userData.name;
    const userEmail = userData.email;

    // ============= VALIDATE EXISTING RESERVATION =====================
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
        error:
          "You still have an unfinished reservation. Please complete it first.",
      });
    }

    // ============= FETCH HOUSE DATA =====================
    const { data: houseData, error: houseError } = await supabase
      .from("houses")
      .select(
        `
        id_house,
        id_admin,
        status,
        number_block,
        block:block(
          id_block,
          block_name,
          residence:residence(id_residence, residence_name)
        )
      `
      )
      .eq("id_house", id_house)
      .single();
    if (houseError) throw houseError;

    // ============= CHECK HOUSE STATUS =====================
    if (!houseData || ["reserved", "sold"].includes(houseData.status)) {
      return res.status(400).json({
        success: false,
        error: "The house is no longer available.",
      });
    }

    // ============= SET START & END DATE =====================
    const start_date = new Date().toISOString();
    const end_date = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // ============= INSERT RESERVATION =====================
    const { data: reservation, error: insertError } = await supabase
      .from("reservation")
      .insert([
        { id_user, id_pt, id_house, start_date, end_date, reservation_status },
      ])
      .select();
    if (insertError) throw insertError;

    const newReservation = reservation[0];

    // ============= UPDATE HOUSE STATUS =====================
    await supabase
      .from("houses")
      .update({ status: "reserved" })
      .eq("id_house", id_house);

    // ============= COMPOSE HOUSE NAME =====================
    const residenceName = houseData.block?.residence?.residence_name;
    const blockName = houseData.block?.block_name;
    const houseName = `${residenceName}`;

    const sendTime = new Date().toISOString();

    // ============= SAVE EMAIL RECORD =====================
    await supabase.from("email").insert({
      id_user,
      id_reservasi: newReservation.id_reservasi,
      send_time: sendTime,
      deskripsi: `Reservation for house ${houseName} has been successfully created!`,
    });

    // ============= FETCH ADMIN FOR EMAIL =====================
    const { data: adminData } = await supabase
      .from("admin")
      .select("username, phone")
      .eq("id_admin", houseData.id_admin)
      .single();

    const adminName = adminData?.username || "Admin";
    const adminPhone = adminData?.phone || "-";

    // ============= SEND EMAIL TO USER =====================
    // ============= SEND EMAIL TO USER =====================
    if (userEmail) {
      // Format username agar kapital di awal setiap kata
      const formattedUserName = userName
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      // Nama residence saja untuk subject
      const residenceName = houseData.block?.residence?.residence_name;

      // Nama lengkap untuk isi email
      const houseFullName = `${residenceName} — Block ${houseData.block?.block_name} No. ${houseData.number_block}`;

      await transporter.sendMail({
        from: `"ibraviaku@gmail.com" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: `${residenceName} — Reservation Created`,
        html: `
          <h2>${residenceName}</h2>

          <p>Hello <b>${formattedUserName}</b>,</p>
          <p>Your reservation for <b>${houseFullName}</b> has been successfully created.</p>

          <p><b>Start Date:</b> ${new Date(start_date).toLocaleDateString()}</p>
          <p><b>End Date:</b> ${new Date(end_date).toLocaleDateString()}</p>

          <p>Please contact our admin: +62 <b>${adminPhone}</b> (${adminName}) within 7 days.</p>
          <p>If you do not confirm within this period, your reservation will be automatically cancelled.</p>

          <br/>
          <p>Thank you for choosing our service.</p>
        `,
      });
    }

    // ============= ADMIN NOTIFICATION =====================
    await supabase.from("notification").insert({
      id_admin: houseData.id_admin,
      id_reservasi: newReservation.id_reservasi,
      id_pt,
      content: `User ${userName} reserved house in ${houseName}.`,
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

export const getReservationsByUser = async (req, res) => {
  const { id_user } = req.params;

  try {
    const { data, error } = await supabase
      .from("reservation")
      .select(
        `
        id_reservasi,
        start_date,
        end_date,
        reservation_status,
        house:houses (
          id_house,
          number_block,
          block:block (
            id_block,
            block_name,
            bathroom,
            bedroom,
            living_room,
            family_room,
            kitchen,
            residence:residence (residence_name)
          )
        )
      `
      )
      .eq("id_user", id_user);

    if (error) {
      console.error("❌ Supabase error:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch user reservations." });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "No reservations found." });
    }

    const formatted = data.map((item) => {
      const block = item.house?.block || {};

      const details = [
        block.bedroom
          ? `${block.bedroom} Bedroom${block.bedroom > 1 ? "s" : ""}`
          : null,
        block.bathroom
          ? `${block.bathroom} Bathroom${block.bathroom > 1 ? "s" : ""}`
          : null,
        block.living_room && block.family_room
          ? "Living & Family Room"
          : block.living_room
          ? "Living Room"
          : block.family_room
          ? "Family Room"
          : null,
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
