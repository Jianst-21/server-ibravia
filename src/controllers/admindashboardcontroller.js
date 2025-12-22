import supabase from "../config/supabaseclient.js";

/**
 * Helper: toJakartaDate
 * Mengonversi waktu ke zona waktu Asia/Jakarta.
 * Penting untuk memastikan perhitungan statistik mingguan konsisten meskipun timezone server berbeda.
 */
const toJakartaDate = (dateInput) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
};

/**
 * Controller: getAdminDashboard
 * Mengambil ringkasan data statistik untuk ditampilkan pada halaman utama dashboard admin.
 */
export const getAdminDashboard = async (req, res) => {
  try {
    // Validasi keberadaan data admin dari middleware autentikasi
    const admin = req.admin;
    if (!admin || !admin.id_residence) {
      return res.status(403).json({
        error: "Data admin tidak ditemukan atau tidak memiliki akses.",
      });
    }

    const { id_residence } = admin;

    // 1. Ambil daftar ID rumah yang dikelola oleh residence ini
    const { data: houseList, error: houseErr } = await supabase
      .from("houses")
      .select("id_house")
      .eq("id_residence", id_residence);

    if (houseErr) throw houseErr;

    const houseIds = (houseList || []).map((h) => h.id_house);

    // 2. Hitung total seluruh unit rumah dalam residence
    const { count: totalHouses } = await supabase
      .from("houses")
      .select("id_house", { count: "exact", head: true })
      .eq("id_residence", id_residence);

    // 3. Hitung unit rumah yang saat ini berstatus 'reserved'
    const { count: reservedHouses } = await supabase
      .from("houses")
      .select("id_house", { count: "exact", head: true })
      .eq("id_residence", id_residence)
      .eq("status", "reserved");

    // 4. Hitung jumlah reservasi yang berstatus aktif
    const { count: activeReservations } = await supabase
      .from("reservation")
      .select("id_reservasi", { count: "exact", head: true })
      .eq("reservation_status", "active")
      .in("id_house", houseIds.length > 0 ? houseIds : [-1]);

    // 5. Hitung jumlah reservasi yang telah dibatalkan
    const { count: cancelledReservations } = await supabase
      .from("reservation")
      .select("id_reservasi", { count: "exact", head: true })
      .eq("reservation_status", "cancelled")
      .in("id_house", houseIds.length > 0 ? houseIds : [-1]);

    // 6. Ambil data mentah seluruh reservasi untuk kebutuhan chart mingguan
    const { data: allReservationsRaw, error: allResErr } = await supabase
      .from("reservation")
      .select("id_reservasi, id_user, id_house, reservation_status, start_date, end_date")
      .in("id_house", houseIds.length > 0 ? houseIds : [-1])
      .order("start_date", { ascending: false });

    if (allResErr) throw allResErr;

    // 7. Pengolahan Data Mingguan (Sunday - Saturday)
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const nowJkt = toJakartaDate(new Date());

    // Menentukan titik awal minggu (Minggu jam 00:00 Jakarta)
    const weekStart = new Date(nowJkt);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(nowJkt.getDate() - nowJkt.getDay());

    // Menentukan titik akhir minggu
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const counts = Array(7).fill(0);

    // Melakukan iterasi untuk menghitung jumlah reservasi per hari dalam minggu ini
    for (const r of allReservationsRaw || []) {
      const dJkt = toJakartaDate(r.start_date);
      if (dJkt >= weekStart && dJkt < weekEnd) {
        counts[dJkt.getDay()] += 1;
      }
    }

    // Memetakan hasil perhitungan ke dalam format yang dimengerti oleh library chart (frontend)
    const weeklydata = counts.map((value, idx) => ({
      day: idx + 1,     // 1 = Sunday, dst.
      name: DAYS[idx],
      value,
    }));

    // 8. Melakukan Join Manual (Enrichment) untuk mendapatkan detail User dan Rumah
    const allReservations = await Promise.all(
      (allReservationsRaw || []).map(async (r) => {
        const { data: house } = await supabase
          .from("houses")
          .select("number_block, status")
          .eq("id_house", r.id_house)
          .single();

        const { data: user } = await supabase
          .from("user")
          .select("name, email")
          .eq("id_user", r.id_user)
          .single();

        return { ...r, house, user };
      })
    );

    // 9. Mengirimkan response sukses ke frontend
    res.status(200).json({
      message: "Berhasil mengambil data dashboard admin",
      data: {
        admin_name: admin.name_admin,
        residence_id: id_residence,
        total_houses: totalHouses || 0,
        reserved_houses: reservedHouses || 0,
        active_reservations: activeReservations || 0,
        cancelled_reservations: cancelledReservations || 0,
        weeklydata,
        all_reservations: allReservations || [],
      },
    });
  } catch (err) {
    console.error("Error getAdminDashboard:", err);
    res.status(500).json({ error: "Gagal memuat data dashboard admin." });
  }
};

/**
 * Controller: getResidenceInfo
 * Mengambil informasi dasar residence (nama dan lokasi) untuk header dashboard.
 */
export const getResidenceInfo = async (req, res) => {
  try {
    const admin = req.admin;
    if (!admin || !admin.id_residence) {
      return res.status(403).json({
        error: "Data admin tidak ditemukan atau tidak memiliki akses.",
      });
    }

    const { id_residence } = admin;

    const { data, error } = await supabase
      .from("residence")
      .select("residence_name, location")
      .eq("id_residence", id_residence)
      .single();

    if (error) throw error;

    res.status(200).json({
      id_residence,
      name: data.residence_name,
      location: data.location,
    });
  } catch (err) {
    console.error("Error fetching residence info:", err);
    res.status(500).json({ error: "Gagal mengambil data residence." });
  }
};