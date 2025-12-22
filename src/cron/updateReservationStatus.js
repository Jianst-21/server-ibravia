// file: src/cron/updateReservationStatus.js
import supabase from "../config/supabaseclient.js";
import transporter from "../config/nodemailer.js";

/**
 * Fungsi updateReservationStatus
 * Berfungsi sebagai sistem pembersihan otomatis (Auto-Cleanup) untuk membatalkan
 * reservasi yang sudah melewati batas waktu (deadline) tanpa konfirmasi admin.
 */
export async function updateReservationStatus() {
  try {
    // 1. Inisialisasi waktu sekarang dalam format ISO (UTC) untuk perbandingan database
    const now = new Date().toISOString();
    console.log("Cron running at (UTC):", now);

    /**
     * 2. Pengambilan Data Reservasi Kedaluwarsa
     * Mencari reservasi dengan kriteria:
     * - Status masih 'pending'
     * - Tanggal end_date lebih kecil dari waktu sekarang (lt = less than)
     */
    const { data: expiredReservations, error: fetchError } = await supabase
      .from("reservation")
      .select(`
        id_reservasi,
        id_house,
        id_user,
        start_date,
        end_date,
        reservation_status,
        house:houses(
          id_house, number_block, id_pt, id_admin, status, 
          block:block(id_block, block_name, residence:residence(id_residence, residence_name))
        ),
        user:user(id_user, name, email)
      `)
      .eq("reservation_status", "pending")
      .lt("end_date", now);

    if (fetchError) throw fetchError;

    console.log("Pending expired reservations found:", expiredReservations.length);

    if (!expiredReservations.length) {
      console.log("No pending reservations that have expired.");
      return;
    }

    /**
     * 3. Iterasi Pemrosesan Pembatalan
     * Setiap reservasi yang kedaluwarsa akan diproses satu per satu (Sequentially).
     */
    for (const reservation of expiredReservations) {
      const houseName = `Block ${reservation.house?.number_block} - ${reservation.house?.block?.block_name} (${reservation.house?.block?.residence?.residence_name})`;
      const send_time = new Date().toISOString();

      console.log(`Canceling reservation ID: ${reservation.id_reservasi} | House: ${houseName}`);

      // A. Update status reservasi di database menjadi 'canceled'
      const { error: updateResError } = await supabase
        .from("reservation")
        .update({ reservation_status: "canceled" })
        .eq("id_reservasi", reservation.id_reservasi);

      if (updateResError) {
        console.error("Failed to update reservation status:", updateResError);
        continue; // Lewati ke data berikutnya jika update gagal
      }

      // B. Kembalikan status unit rumah menjadi 'available' agar bisa dipesan kembali
      const { error: updateHouseError } = await supabase
        .from("houses")
        .update({ status: "available" })
        .eq("id_house", reservation.id_house);

      if (updateHouseError) console.error("Failed to update house status:", updateHouseError);

      // C. Pencatatan log aktivitas pengiriman email ke database
      const { error: emailError } = await supabase.from("email").insert({
        id_user: reservation.id_user,
        id_reservasi: reservation.id_reservasi,
        send_time,
        deskripsi: `Canceled: deadline reached (${new Date(reservation.end_date).toLocaleString()}).`,
      });
      if (emailError) console.error("Failed to insert email record:", emailError);

      // D. Notifikasi Email kepada User (Customer)
      if (reservation.user?.email) {
        try {
          await transporter.sendMail({
            from: `"Ibravia Support" <${process.env.EMAIL_USER}>`,
            to: reservation.user.email,
            subject: "Your Reservation Has Been Canceled",
            html: `
              <h2>Hello, ${reservation.user.name}</h2>
              <p>Your reservation for the house <b>${houseName}</b> has been <b>canceled</b> because it was not confirmed before the deadline.</p>
              <p>Deadline: <b>${new Date(reservation.end_date).toLocaleString()}</b></p>
              <p>If you are still interested, please make a new reservation through our platform.</p>
              <br/>
              <p>Regards,<br/>The Ibravia Team</p>
            `,
          });
        } catch (err) {
          console.error("Failed to send email to user:", err.message);
        }
      }

      // E. Notifikasi sistem untuk Dashboard Admin
      const { error: notifError } = await supabase.from("notification").insert({
        id_admin: reservation.house?.id_admin || 1,
        id_reservasi: reservation.id_reservasi,
        id_pt: reservation.house?.id_pt || null,
        content: `System Auto-Cancel: Reservation by ${reservation.user?.name} for ${houseName} expired.`,
        send_time,
        read_status: false,
      });
      if (notifError) console.error("Failed to insert notification:", notifError);
    }

    console.log("Job completed successfully.");
  } catch (err) {
    console.error("Critical Error in updateReservationStatus cron:", err.message);
  }
}