// file: src/cron/updateReservationStatus.js
import supabase from "../config/supabaseclient.js";
import transporter from "../config/nodemailer.js";

export async function updateReservationStatus() {
  try {
    // 🔹 Current time in UTC
    const now = new Date().toISOString();
    console.log(" Cron running at (UTC):", now);

    // 🔹 Fetch all pending reservations where end_date has passed
    const { data: expiredReservations, error: fetchError } = await supabase
      .from("reservation")
      .select(`
        id_reservasi,
        id_house,
        id_user,
        start_date,
        end_date,
        reservation_status,
        house:houses(id_house, number_block, id_pt, id_admin, status, block:block(id_block, block_name, residence:residence(id_residence, residence_name))),
        user:user(id_user, name, email)
      `)
      .eq("reservation_status", "pending")
      .lt("end_date", now);

    if (fetchError) throw fetchError;

    console.log(" Pending expired reservations found:", expiredReservations.length);

    if (!expiredReservations.length) {
      console.log(" No pending reservations that have expired.");
      return;
    }

    for (const reservation of expiredReservations) {
      const houseName = `Block ${reservation.house?.number_block} - ${reservation.house?.block?.block_name} (${reservation.house?.block?.residence?.residence_name})`;
      const send_time = new Date().toISOString();

      console.log(` Canceling reservation ID: ${reservation.id_reservasi} | House: ${houseName}`);

      // 🔹 Update reservation status → canceled
      const { error: updateResError } = await supabase
        .from("reservation")
        .update({ reservation_status: "canceled" })
        .eq("id_reservasi", reservation.id_reservasi);

      if (updateResError) {
        console.error(" Failed to update reservation status:", updateResError);
        continue;
      }

      // 🔹 Update house status → available
      const { error: updateHouseError } = await supabase
        .from("houses")
        .update({ status: "available" })
        .eq("id_house", reservation.id_house);

      if (updateHouseError) console.error(" Failed to update house status:", updateHouseError);

      // 🔹 Save email record to database
      const { error: emailError } = await supabase.from("email").insert({
        id_user: reservation.id_user,
        id_reservasi: reservation.id_reservasi,
        send_time,
        deskripsi: `The reservation for house ${houseName} has been canceled because it was not confirmed before ${new Date(reservation.end_date).toLocaleString()}.`,
      });
      if (emailError) console.error(" Failed to insert email record:", emailError);

      // 🔹 Send email to user
      if (reservation.user?.email) {
        try {
          await transporter.sendMail({
            from: `"ibraviaku@gmail.com" <${process.env.EMAIL_USER}>`,
            to: reservation.user.email,
            subject: "Your Reservation Has Been Canceled",
            html: `
              <h2>Hello, ${reservation.user.name}</h2>
              <p>Your reservation for the house <b>${houseName}</b> has been <b>canceled</b> because it was not confirmed before the deadline.</p>
              <p>Reservation end date: <b>${new Date(reservation.end_date).toLocaleString()}</b></p>
              <p>Please make a new reservation if you are still interested.</p>
              <br/>
              <p>Thank you,<br/>ibravia</p>
            `,
          });
          console.log(` Email sent to ${reservation.user.email}`);
        } catch (err) {
          console.error(" Failed to send email:", err.message);
        }
      }

      // 🔹 Save notification for admin
      const { error: notifError } = await supabase.from("notification").insert({
        id_admin: reservation.house?.id_admin || 1,
        id_reservasi: reservation.id_reservasi,
        id_pt: reservation.house?.id_pt || null,
        content: `A reservation by ${reservation.user?.name} for house ${houseName} has been canceled because it was not confirmed.`,
        send_time,
        read_status: false,
      });
      if (notifError) console.error(" Failed to insert notification:", notifError);
    }

    console.log(" All expired pending reservations have been canceled and notifications sent.");
  } catch (err) {
    console.error(" Error updateReservationStatus:", err.message);
  }
}
