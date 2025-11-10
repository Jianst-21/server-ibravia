// src/controllers/adminnotificationcontroller.js
import supabase from "../config/supabaseclient.js";

/* ======================================
   📬 GET SEMUA NOTIFIKASI ADMIN
====================================== */
export const getAdminNotifications = async (req, res) => {
  try {
    if (!req.admin || !req.admin.id_admin) {
      return res.status(403).json({ error: "Admin tidak terautentikasi." });
    }

    const { id_admin } = req.admin;


    const { data, error } = await supabase
      .from("notification")
      .select(
        "id_notification, id_admin, id_reservasi, id_pt, content, send_time, read_status"
      )
      .eq("id_admin", id_admin)
      .order("send_time", { ascending: false });

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: "Kesalahan saat query notifikasi." });
    }

    res.status(200).json(data || []);
  } catch (err) {
    console.error("❌ Gagal mengambil notifikasi:", err);
    res.status(500).json({ error: "Terjadi kesalahan internal server." });
  }
};

/* ======================================
   ✅ UPDATE STATUS NOTIFIKASI (dibaca)
====================================== */
export const markAsRead = async (req, res) => {
  try {
    const { id_notification } = req.params;

    const { error } = await supabase
      .from("notification")
      .update({ read_status: "read" })
      .eq("id_notification", id_notification);

    if (error) throw error;

    res.json({ message: "Notifikasi berhasil ditandai sebagai dibaca." });
  } catch (err) {
    console.error("❌ Gagal update notifikasi:", err.message || err);
    res.status(500).json({ error: "Gagal menandai notifikasi sebagai dibaca." });
  }
};

/* ======================================
   🔢 GET JUMLAH NOTIFIKASI BELUM DIBACA
====================================== */
export const getUnreadCount = async (req, res) => {
  try {
    if (!req.admin || !req.admin.id_admin) {
      return res.status(403).json({ error: "Admin tidak terautentikasi." });
    }

    const { id_admin } = req.admin;

    const { count, error } = await supabase
      .from("notification")
      .select("*", { count: "exact", head: true })
      .eq("id_admin", id_admin)
      .neq("read_status", "read");

    if (error) throw error;

    res.status(200).json({ unreadCount: count || 0 });
  } catch (err) {
    console.error("❌ Gagal menghitung notifikasi belum dibaca:", err);
    res.status(500).json({ error: "Gagal menghitung notifikasi." });
  }
};
