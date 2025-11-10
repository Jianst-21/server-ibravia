// file: src/cron/updateReservationStatus.js
import supabase from "../config/supabaseclient.js";
import transporter from "../config/nodemailer.js";

export async function updateReservationStatus() {
  try {
    // 🔹 Waktu sekarang UTC
    const now = new Date().toISOString();
    console.log(" Cron running at (UTC):", now);

    // 🔹 Ambil semua reservasi pending yang sudah lewat end_date
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

    console.log(" Pending reservations expired found:", expiredReservations.length);

    if (!expiredReservations.length) {
      console.log(" Tidak ada reservasi pending yang expired.");
      return;
    }

    for (const reservation of expiredReservations) {
      const houseName = `Block ${reservation.house?.number_block} - ${reservation.house?.block?.block_name} (${reservation.house?.block?.residence?.residence_name})`;
      const send_time = new Date().toISOString();

      console.log(` Canceling reservation ID: ${reservation.id_reservasi} | House: ${houseName}`);

      //  Update status reservasi -> canceled
      const { error: updateResError } = await supabase
        .from("reservation")
        .update({ reservation_status: "canceled" })
        .eq("id_reservasi", reservation.id_reservasi);

      if (updateResError) {
        console.error(" Failed to update reservation status:", updateResError);
        continue;
      }

      //  Update status rumah -> available
      const { error: updateHouseError } = await supabase
        .from("houses")
        .update({ status: "available" })
        .eq("id_house", reservation.id_house);

      if (updateHouseError) console.error(" Failed to update house status:", updateHouseError);

      //  Simpan email ke user
      const { error: emailError } = await supabase.from("email").insert({
        id_user: reservation.id_user,
        id_reservasi: reservation.id_reservasi,
        send_time,
        deskripsi: `Reservasi rumah ${houseName} telah dibatalkan karena tidak dikonfirmasi sebelum ${new Date(reservation.end_date).toLocaleString()}.`,
      });
      if (emailError) console.error(" Failed to insert email record:", emailError);

      //  Kirim email ke user
      if (reservation.user?.email) {
        try {
          await transporter.sendMail({
            from: `"ibravia@gmail.com" <${process.env.EMAIL_USER}>`,
            to: reservation.user.email,
            subject: "Reservasi Anda Telah Dibatalkan",
            html: `
              <h2>Halo, ${reservation.user.name}</h2>
              <p>Reservasi Anda untuk rumah <b>${houseName}</b> telah <b>dibatalkan</b> karena tidak dikonfirmasi sebelum waktunya.</p>
              <p>Tanggal akhir reservasi: <b>${new Date(reservation.end_date).toLocaleString()}</b></p>
              <p>Silakan lakukan reservasi ulang jika berminat.</p>
              <br/>
              <p>Terima kasih,<br/>ibravia</p>
            `,
          });
          console.log(` Email terkirim ke ${reservation.user.email}`);
        } catch (err) {
          console.error(" Failed to send email:", err.message);
        }
      }

      //  Simpan notifikasi ke admin (ambil dari house.id_admin)
      const { error: notifError } = await supabase.from("notification").insert({
        id_admin: reservation.house?.id_admin || 1, // default admin 1 jika null
        id_reservasi: reservation.id_reservasi,
        id_pt: reservation.house?.id_pt || null,
        content: `Reservasi oleh ${reservation.user?.name} untuk rumah ${houseName} telah dibatalkan karena tidak dikonfirmasi.`,
        send_time,
        read_status: false,
      });
      if (notifError) console.error(" Failed to insert notification:", notifError);
    }

    console.log(" Semua reservasi pending expired telah dibatalkan dan notifikasi dikirim.");
  } catch (err) {
    console.error(" Error updateReservationStatus:", err.message);
  }
}
