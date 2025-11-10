// file: controllers/reservationController.js
import supabase from "../config/supabaseclient.js";
import transporter from "../config/nodemailer.js";

export const createReservation = async (req, res) => {
  const { id_user, id_pt, id_house, reservation_status } = req.body;

  try {
    // Fetch user data from DB
    const { data: userData, error: userError } = await supabase
      .from("user")
      .select("name, email")
      .eq("id_user", id_user)
      .single();
    if (userError) throw userError;
    if (!userData) throw new Error("User not found.");

    const userName = userData.name;
    const userEmail = userData.email;

    // Check if user already has a pending or accepted reservation
    const { data: existingUserReservation, error: existingError } = await supabase
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

    // Fetch house data + block + residence + admin id
    const { data: houseData, error: houseError } = await supabase
      .from("houses")
      .select(`
        id_house,
        id_admin,
        status,
        number_block,
        block:block(id_block, block_name, residence:residence(id_residence, residence_name))
      `)
      .eq("id_house", id_house)
      .single();
    if (houseError) throw houseError;

    // Check if house is still available
    if (!houseData || ["reserved", "sold"].includes(houseData.status)) {
      return res.status(400).json({ success: false, error: "The house is no longer available." });
    }

    // Determine start_date & end_date
    const start_date = new Date().toISOString();
    const end_date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Insert into reservation table
    const { data: reservation, error: insertError } = await supabase
      .from("reservation")
      .insert([{ id_user, id_pt, id_house, start_date, end_date, reservation_status }])
      .select();
    if (insertError) throw insertError;
    if (!reservation || reservation.length === 0) throw new Error("Failed to create reservation.");
    const newReservation = reservation[0];

    // Update house status to 'reserved'
    const { error: updateHouseError } = await supabase
      .from("houses")
      .update({ status: "reserved" })
      .eq("id_house", id_house);
    if (updateHouseError) throw updateHouseError;

    // House name for description / notification
    const houseName = `Block ${houseData.number_block} - ${houseData.block?.block_name} (${houseData.block?.residence?.residence_name})`;
    const sendTime = new Date().toISOString();

    // Save email record for user
    await supabase.from("email").insert({
      id_user,
      id_reservasi: newReservation.id_reservasi,
      send_time: sendTime,
      deskripsi: `Reservation for house ${houseName} has been successfully created!`,
    });

    // Send email to user
    if (userEmail) {
      await transporter.sendMail({
        from: `"ibravia@gmail.com" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: "Reservation Successful",
        html: `
          <h2>Hello, ${userName}</h2>
          <p>Your reservation for house <b>${houseName}</b> has been successfully created.</p>
          <p><b>Start Date:</b> ${new Date(start_date).toLocaleString()}</p>
          <p><b>End Date:</b> ${new Date(end_date).toLocaleString()}</p>
          <p>Thank you for using our service.</p>
        `,
      });
    }

    // Save notification for the admin responsible for the house
    await supabase.from("notification").insert({
      id_admin: houseData.id_admin,
      id_reservasi: newReservation.id_reservasi,
      id_pt,
      content: `User ${userName} has made a reservation for house ${houseName}.`,
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
      .select(`
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
            residence:residence (
              residence_name
            )
          )
        )
      `)
      .eq("id_user", id_user);

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: "Failed to fetch user reservations." });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "No reservations found." });
    }

    const formatted = data.map((item) => {
      const block = item.house?.block || {};

      const details = [
        block.bedroom ? `${block.bedroom} Bedroom${block.bedroom > 1 ? "s" : ""}` : null,
        block.bathroom ? `${block.bathroom} Bathroom${block.bathroom > 1 ? "s" : ""}` : null,
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
