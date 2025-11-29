import supabase from "../config/supabaseclient.js";
import transporter from "../config/nodemailer.js"; // Pastikan path benar

/* ==========================================================
   🔧 Helper Function
========================================================== */
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/* ==========================================================
   📧 Helper: Kirim Email & Catat Log ke Database
========================================================== */
const sendEmailAndLog = async (
  id_user,
  id_reservasi,
  toEmail,
  userName,
  type,
  houseDetails
) => {
  let subject, text, deskripsiLog;

  // --- Format tanggal reservasi secara lokal (opsional jika dikirim dari frontend bisa ditambah param) ---
  const now = new Date();
  const formattedDate = now.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // --- Extract detail rumah dari houseDetails string ---
  // Contoh houseDetails = "Block A No. 01"
  const match = houseDetails.match(/Block\s+([A-Za-z0-9]+)\s+No\.\s+([A-Za-z0-9]+)/);
  const blockName = match ? match[1] : "-";
  const houseNumber = match ? match[2] : "-";

  /* ==========================================================
     🟢 EMAIL: ACCEPTED
  =========================================================== */
  if (type === "accepted") {
    subject = "✅ Your Reservation Has Been Approved - Ibravia";
    text = `Dear ${userName},

Thank you for choosing Ibravia.

We are pleased to inform you that your reservation has been approved by the housing administrator. Below are the details of your booking:

🏠 Property Details:
• Block Name: ${blockName}
• House Number: ${houseNumber}
• Reservation Date: ${formattedDate}

The next step is to discuss pricing, payment schedule, and further arrangements directly with the respective housing administrator.

Please make sure to follow up within the given time frame to proceed with the process.

If you have any questions, feel free to contact our support team at ibraviaku@gmail.com

Thank you for your trust in Ibravia.
We’re excited to accompany you throughout your housing journey.

Warm regards,
The Ibravia Team
ibraviaku@gmail.com`;

    deskripsiLog = `Reservation for ${houseDetails} accepted. Email notification sent.`;
  }

  /* ==========================================================
     🔴 EMAIL: CANCELLED
  =========================================================== */
  else if (type === "cancelled") {
    subject = " Reservation Cancelled - Ibravia";
    text = `Dear ${userName},

Thank you for choosing Ibravia.

We regret to inform you that your reservation request has been declined by the housing administrator.

🏠 Property Details:
• Block Name: ${blockName}
• House Number: ${houseNumber}
• Reservation Date: ${formattedDate}

This decision may be due to internal scheduling, availability conflicts, or other administrative reasons.

You are welcome to make another reservation for a different unit or contact the administrator for clarification.

If you have any questions or need assistance, please reach out to us at ibraviaku@gmail.com

Thank you for your understanding, and we hope to serve you again soon.

Warm regards,
The Ibravia Team
ibraviaku@gmail.com`;

    deskripsiLog = `Reservation for ${houseDetails} cancelled. Email notification sent.`;
  }

  /* ==========================================================
     ⚠️ Unknown Type
  =========================================================== */
  else {
    console.warn("Unknown email type:", type);
    return;
  }

  // --- Kirim Email ---
  try {
    await transporter.sendMail({
      from: `"Ibravia" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      text,
    });
    console.log(`✅ Email (${type}) sent to ${toEmail}`);
  } catch (emailError) {
    console.error("⚠️ Failed to send email:", emailError.message);
  }

  // --- Simpan Log ke Database ---
  try {
    const { error: logError } = await supabase.from("email").insert([
      {
        id_user,
        id_reservasi,
        deskripsi: deskripsiLog,
      },
    ]);
    if (logError) console.error("⚠️ Failed to log email:", logError.message);
    else console.log("✅ Email log recorded");
  } catch (dbError) {
    console.error("⚠️ Error logging email notification:", dbError.message);
  }
};

/* ==========================================================
   📋 GET ALL RESERVATIONS UNTUK ADMIN
========================================================== */
export const getAdminManageReservation = async (req, res) => {
  try {
    const { id_residence } = req.admin || {};
    if (!id_residence) {
      return res
        .status(403)
        .json({ error: "Admin not authenticated or residence not assigned." });
    }

    // 🔹 Ambil semua house milik residence admin
    const { data: houses, error: houseError } = await supabase
      .from("houses")
      .select("id_house, id_block")
      .eq("id_residence", id_residence);

    if (houseError) throw houseError;
    if (!houses?.length) return res.status(200).json([]);

    const houseIds = houses.map((h) => h.id_house);

    // 🔹 Ambil semua reservasi terkait house tersebut
    const { data: reservationsData, error: reservationError } = await supabase
      .from("reservation")
      .select(
        `
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
      `
      )
      .in("id_house", houseIds)
      .in("reservation_status", ["Pending", "pending"]) // ✅ Case-insensitive fix
      .order("start_date", { ascending: false });

    if (reservationError) throw reservationError;
    if (!reservationsData?.length) return res.status(200).json([]);

    // 🔹 Auto-expired handler
    const now = new Date();
    const updates = [];

    const processedReservations = reservationsData.map((r) => {
      const house = r.houses || {};
      const block = house.block || {};
      const residence = block.residence || {};
      const user = r.user || {};

      // --- Periksa tanggal expired ---
      if (r.reservation_status === "Pending") {
        const reservationDate = new Date(r.start_date);
        const deadlineDate = addDays(reservationDate, 7);
        if (deadlineDate < now) {
          updates.push(
            supabase
              .from("reservation")
              .update({ reservation_status: "Expired" })
              .eq("id_reservasi", r.id_reservasi)
          );
          updates.push(
            supabase
              .from("houses")
              .update({ status: "available" })
              .eq("id_house", r.id_house)
          );
          r.reservation_status = "Expired";
        }
      }

      // --- Buat deskripsi properti ---
      const descriptionParts = [];
      if (block.bedroom)
        descriptionParts.push(
          `${block.bedroom} Bedroom${block.bedroom > 1 ? "s" : ""}`
        );
      if (block.bathroom)
        descriptionParts.push(
          `${block.bathroom} Bathroom${block.bathroom > 1 ? "s" : ""}`
        );
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
        description:
          descriptionParts.length > 0
            ? descriptionParts.join(", ")
            : "House details unavailable",
        address: residence.location || "Location not available",
        residence_name: residence.residence_name || "Unknown Residence",
      };
    });

    if (updates.length > 0) await Promise.all(updates);

    res.status(200).json(processedReservations);
  } catch (err) {
    console.error("❌ Failed to fetch manage reservation data:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to fetch reservation data." });
  }
};

/* ==========================================================
   ✅ ACCEPT RESERVATION
========================================================== */
export const acceptReservation = async (req, res) => {
  const { id_reservasi, id_house } = req.body;

  if (!id_reservasi || !id_house)
    return res
      .status(400)
      .json({ error: "id_reservasi and id_house are required." });

  try {
    // 🔹 Ambil data reservasi & user
    const { data: resData, error: fetchError } = await supabase
      .from("reservation")
      .select(
        `
        id_user,
        user ( email, name ),
        houses ( number_block, block ( block_name ) )
      `
      )
      .eq("id_reservasi", id_reservasi)
      .single();

    if (fetchError || !resData) throw new Error("Reservation not found");

    // 🔹 Update status reservation & house
    await supabase
      .from("reservation")
      .update({ reservation_status: "accepted" })
      .eq("id_reservasi", id_reservasi);

    await supabase
      .from("houses")
      .update({ status: "sold" })
      .eq("id_house", id_house);

    // 🔹 Kirim email
    if (resData.user?.email) {
      const userName = resData.user.name || "Customer";
      const houseDetails = `Block ${
        resData.houses?.block?.block_name || "?"
      } No. ${resData.houses?.number_block || "?"}`;
      await sendEmailAndLog(
        resData.id_user,
        id_reservasi,
        resData.user.email,
        userName,
        "accepted",
        houseDetails
      );
    }

    res.status(200).json({
      message: "Reservation accepted and notification sent.",
    });
  } catch (err) {
    console.error("❌ Failed to accept reservation:", err);
    res
      .status(500)
      .json({ error: err.message || "Error accepting reservation." });
  }
};

/* ==========================================================
   ❌ CANCEL RESERVATION
========================================================== */
export const cancelReservation = async (req, res) => {
  const { id_reservasi, id_house } = req.body;

  if (!id_reservasi || !id_house)
    return res
      .status(400)
      .json({ error: "id_reservasi and id_house are required." });

  try {
    // 🔹 Ambil data reservasi & user
    const { data: resData, error: fetchError } = await supabase
      .from("reservation")
      .select(
        `
        id_user,
        user ( email, name ),
        houses ( number_block, block ( block_name ) )
      `
      )
      .eq("id_reservasi", id_reservasi)
      .single();

    if (fetchError || !resData) throw new Error("Reservation not found");

    // 🔹 Update status reservation & house
    await supabase
      .from("reservation")
      .update({ reservation_status: "cancelled" })
      .eq("id_reservasi", id_reservasi);

    await supabase
      .from("houses")
      .update({ status: "available" })
      .eq("id_house", id_house);

    // 🔹 Kirim email
    if (resData.user?.email) {
      const userName = resData.user.name || "Customer";
      const houseDetails = `Block ${
        resData.houses?.block?.block_name || "?"
      } No. ${resData.houses?.number_block || "?"}`;
      await sendEmailAndLog(
        resData.id_user,
        id_reservasi,
        resData.user.email,
        userName,
        "cancelled",
        houseDetails
      );
    }

    res.status(200).json({
      message: "Reservation cancelled and notification sent.",
    });
  } catch (err) {
    console.error("❌ Failed to cancel reservation:", err);
    res
      .status(500)
      .json({ error: err.message || "Error cancelling reservation." });
  }
};
