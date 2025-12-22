import supabase from "../config/supabaseclient.js";

/**
 * Controller: getAdminNotifications
 * Mengambil daftar seluruh notifikasi yang ditujukan untuk admin yang sedang login.
 * Data diurutkan berdasarkan waktu kirim terbaru (descending).
 */
export const getAdminNotifications = async (req, res) => {
  try {
    // Validasi autentikasi admin melalui data yang disematkan middleware
    if (!req.admin || !req.admin.id_admin) {
      return res.status(403).json({ error: "Admin tidak terautentikasi." });
    }

    const { id_admin } = req.admin;

    // Mengambil data kolom spesifik dari tabel notification milik admin terkait
    const { data, error } = await supabase
      .from("notification")
      .select(
        "id_notification, id_admin, id_reservasi, id_pt, content, send_time, read_status"
      )
      .eq("id_admin", id_admin)
      .order("send_time", { ascending: false });

    // Penanganan error query database
    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Kesalahan saat query notifikasi." });
    }

    res.status(200).json(data || []);
  } catch (err) {
    console.error("Gagal mengambil notifikasi:", err);
    res.status(500).json({ error: "Terjadi kesalahan internal server." });
  }
};

/**
 * Controller: markAsRead
 * Memperbarui status baca notifikasi tertentu menjadi 'read'.
 * ID notifikasi didapatkan dari parameter URL (req.params).
 */
export const markAsRead = async (req, res) => {
  try {
    const { id_notification } = req.params;

    // Melakukan update kolom read_status berdasarkan ID notifikasi unik
    const { error } = await supabase
      .from("notification")
      .update({ read_status: "read" })
      .eq("id_notification", id_notification);

    if (error) throw error;

    res.json({ message: "Notifikasi berhasil ditandai sebagai dibaca." });
  } catch (err) {
    console.error("Gagal update notifikasi:", err.message || err);
    res.status(500).json({ error: "Gagal menandai notifikasi sebagai dibaca." });
  }
};

/**
 * Controller: getUnreadCount
 * Menghitung jumlah total notifikasi yang belum dibaca (status bukan 'read').
 * Menggunakan opsi head: true agar Supabase hanya mengembalikan jumlah (count) tanpa data baris.
 */
export const getUnreadCount = async (req, res) => {
  try {
    // Memastikan admin sudah terautentikasi
    if (!req.admin || !req.admin.id_admin) {
      return res.status(403).json({ error: "Admin tidak terautentikasi." });
    }

    const { id_admin } = req.admin;

    // Query untuk menghitung jumlah baris yang tidak memiliki status 'read'
    const { count, error } = await supabase
      .from("notification")
      .select("*", { count: "exact", head: true })
      .eq("id_admin", id_admin)
      .neq("read_status", "read");

    if (error) throw error;

    // Mengembalikan jumlah angka notifikasi belum dibaca ke frontend (untuk badge icon)
    res.status(200).json({ unreadCount: count || 0 });
  } catch (err) {
    console.error("Gagal menghitung notifikasi belum dibaca:", err);
    res.status(500).json({ error: "Gagal menghitung notifikasi." });
  }
};