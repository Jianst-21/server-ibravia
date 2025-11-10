import supabase from "../config/supabaseclient.js";

export const getAdminReport = async (req, res) => {
  try {
    const { id_residence } = req.admin;

    // 1. Ambil daftar ID rumah yang dimiliki oleh residence admin ini
    const { data: houseData, error: houseError } = await supabase
      .from("houses")
      .select("id_house")
      .eq("id_residence", id_residence);

    if (houseError) throw houseError;

    const houseIds = houseData.map((h) => h.id_house);

    // Jika tidak ada rumah, kembalikan array kosong agar tidak error
    if (houseIds.length === 0) {
      return res.status(200).json([]);
    }

    // 2. Query utama ke tabel 'reservation'
    const { data, error } = await supabase
      .from("reservation") // <-- Mengambil langsung dari tabel reservation
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
      .in("id_house", houseIds) // Pastikan hanya mengambil reservasi dari residence admin ini
      .in("reservation_status", ["accepted", "cancelled"]) // <-- FILTER UTAMA: Hanya status accepted & cancelled
      .order("start_date", { ascending: false });

    if (error) throw error;

    // 3. Format data agar rapi saat dikirim ke frontend
    const formattedReport = data.map((r) => ({
      name: r.user?.name || "Unknown User",
      block_name: r.house?.block?.block_name || "-",
      number_house: r.house?.number_block || "-",
      date: r.start_date,
      status: r.reservation_status, // Mengambil nilai langsung dari kolom reservation_status
    }));

    res.status(200).json(formattedReport);
  } catch (err) {
    console.error("❌ Error fetching admin report:", err);
    res.status(500).json({ error: "Gagal mengambil data laporan." });
  }
};