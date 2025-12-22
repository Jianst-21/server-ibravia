import supabase from "../config/supabaseclient.js";

/**
 * Controller: getAdminReport
 * Berfungsi untuk menghasilkan data laporan riwayat reservasi yang telah selesai diproses.
 * Laporan ini mencakup reservasi dengan status 'accepted' (disetujui) atau 'cancelled' (dibatalkan).
 */
export const getAdminReport = async (req, res) => {
  try {
    // Mengambil id_residence dari data admin yang terautentikasi via middleware
    const { id_residence } = req.admin;

    /**
     * Langkah 1: Mendapatkan daftar unit rumah.
     * Karena laporan ini bersifat spesifik per perumahan (residence), 
     * kita harus mencari semua id_house yang terdaftar di bawah residence admin tersebut.
     */
    const { data: houseData, error: houseError } = await supabase
      .from("houses")
      .select("id_house")
      .eq("id_residence", id_residence);

    if (houseError) throw houseError;

    // Membuat array sederhana berisi ID rumah untuk digunakan pada filter query selanjutnya
    const houseIds = houseData.map((h) => h.id_house);

    // Proteksi: Jika residence belum memiliki rumah sama sekali, hentikan proses dan kirim array kosong
    if (houseIds.length === 0) {
      return res.status(200).json([]);
    }

    /**
     * Langkah 2: Query utama ke tabel 'reservation'.
     * Mengambil data reservasi dengan teknik Join Multi-tabel:
     * - Join ke 'user' untuk mengambil nama pelanggan.
     * - Join ke 'house' untuk mengambil nomor rumah.
     * - Join bersarang (nested) ke 'block' untuk mendapatkan nama blok properti.
     */
    const { data, error } = await supabase
      .from("reservation")
      .select(`
        id_reservasi,
        start_date,
        reservation_status, 
        user:id_user (name),
        house:id_house (
          number_block,
          block:id_block (block_name)
        )
      `)
      // Filter Keamanan: Pastikan hanya reservasi dari rumah yang dimiliki residence admin ini
      .in("id_house", houseIds) 
      // Filter Bisnis: Hanya menampilkan data yang sudah memiliki keputusan akhir (accepted/cancelled)
      .in("reservation_status", ["accepted", "cancelled"]) 
      // Mengurutkan berdasarkan tanggal terbaru (descending)
      .order("start_date", { ascending: false });

    if (error) throw error;

    /**
     * Langkah 3: Re-mapping Data.
     * Menyusun ulang struktur data agar lebih "flat" dan mudah dibaca oleh komponen tabel di frontend.
     * Menangani kasus data null dengan nilai default (fallback).
     */
    const formattedReport = data.map((r) => ({
      name: r.user?.name || "Unknown User",
      block_name: r.house?.block?.block_name || "-",
      number_house: r.house?.number_block || "-",
      date: r.start_date,
      status: r.reservation_status, 
    }));

    // Mengirimkan hasil laporan yang sudah diformat ke client
    res.status(200).json(formattedReport);
  } catch (err) {
    console.error("Error fetching admin report:", err);
    res.status(500).json({ error: "Gagal mengambil data laporan." });
  }
};