import supabase from "../config/supabaseclient.js";

export const getAdminDashboard = async (req, res) => {
  try {
    const admin = req.admin;
    if (!admin || !admin.id_residence) {
      return res.status(403).json({
        error: "Data admin tidak ditemukan atau tidak memiliki akses.",
      });
    }

    const { id_residence } = admin;

    // ===============================
    // 1️⃣ Ambil semua id_house milik residence ini
    // ===============================
    const { data: houseList, error: houseErr } = await supabase
      .from("houses")
      .select("id_house")
      .eq("id_residence", id_residence);

    if (houseErr) throw houseErr;

    const houseIds = houseList.map((h) => h.id_house);

    // ===============================
    // 2️⃣ Total rumah
    // ===============================
    const { count: totalHouses } = await supabase
      .from("houses")
      .select("id_house", { count: "exact", head: true })
      .eq("id_residence", id_residence);

    // ===============================
    // 3️⃣ Rumah reserved
    // ===============================
    const { count: reservedHouses } = await supabase
      .from("houses")
      .select("id_house", { count: "exact", head: true })
      .eq("id_residence", id_residence)
      .eq("status", "reserved");

    // ===============================
    // 4️⃣ Reservasi aktif (hanya dari rumah di residence ini)
    // ===============================
    const { count: activeReservations } = await supabase
      .from("reservation")
      .select("id_reservasi", { count: "exact", head: true })
      .eq("reservation_status", "active")
      .in("id_house", houseIds.length > 0 ? houseIds : [-1]); // antisipasi kalau kosong

    // ===============================
    // 4.5️⃣ Reservasi Cancelled (BARU)
    // ===============================
    const { count: cancelledReservations } = await supabase
      .from("reservation")
      .select("id_reservasi", { count: "exact", head: true })
      .eq("reservation_status", "cancelled") // Filter status 'cancelled'
      .in("id_house", houseIds.length > 0 ? houseIds : [-1]);

    // ===============================
    // 5️⃣ 5 reservasi terbaru (hanya dari rumah di residence ini)
    // ===============================
    const { data: latestReservationsRaw } = await supabase
      .from("reservation")
      .select(
        "id_reservasi, id_user, id_house, reservation_status, start_date, end_date"
      )
      .in("id_house", houseIds.length > 0 ? houseIds : [-1])
      .order("start_date", { ascending: false })
      .limit(5);

    // ===============================
    // 6️⃣ Join user & house info
    // ===============================
    const latestReservations = await Promise.all(
      (latestReservationsRaw || []).map(async (r) => {
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

    // ===============================
    // 7️⃣ Response ke Frontend
    // ===============================
    res.status(200).json({
      message: "Berhasil mengambil data dashboard admin",
      data: {
        admin_name: admin.name_admin,
        residence_id: id_residence,
        total_houses: totalHouses || 0,
        reserved_houses: reservedHouses || 0,
        active_reservations: activeReservations || 0,
        cancelled_reservations: cancelledReservations || 0, // <--- TAMBAHKAN INI
        latest_reservations: latestReservations || [],
      },
    });
  } catch (err) {
    console.error("❌ Error getAdminDashboard:", err);
    res.status(500).json({ error: "Gagal memuat data dashboard admin." });
  }
};

// ===============================
// 🏠 Ambil Nama Residence
// ===============================
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
    console.error("❌ Error fetching residence info:", err);
    res.status(500).json({ error: "Gagal mengambil data residence." });
  }
};
