// controllers/adminmanagehousecontroller.js
import supabase from "../config/supabaseclient.js";

/* ======================================================
   🏠 GET SEMUA RUMAH (Untuk halaman Manage House admin)
====================================================== */
export const getAdminHouses = async (req, res) => {
  try {
    const { id_residence } = req.admin;

    const { data: houses, error } = await supabase
      .from("houses")
      .select(`
        id_house,
        id_residence,
        id_block,
        number_block,
        status,
        house_area,
        land_area,
        full_price,
        down_payment,
        reserved_at,
        updated_at,
        block:id_block (
          block_name,
          bedroom,
          bathroom,
          living_room,
          family_room,
          kitchen
        ),
        residence:id_residence (
          residence_name,
          location
        )
      `)
      .eq("id_residence", id_residence)
      .order("id_house", { ascending: true });

    if (error) throw error;
    res.json(houses);
  } catch (err) {
    console.error("❌ Gagal mengambil data rumah:", err);
    res.status(500).json({ error: "Gagal mengambil data rumah." });
  }
};

/* ======================================================
   🔄 UPDATE STATUS RUMAH
====================================================== */
export const updateHouseStatus = async (req, res) => {
  try {
    const { id_house } = req.params;
    const { status } = req.body;
    const { id_admin, id_residence } = req.admin;

    const allowed = ["available", "sold", "reserved"];
    if (!allowed.includes(status)) {
      return res
        .status(400)
        .json({ error: "Status tidak valid (available/sold/reserved)." });
    }

    const { data: house, error: findErr } = await supabase
      .from("houses")
      .select("*")
      .eq("id_house", id_house)
      .eq("id_residence", id_residence)
      .single();

    if (findErr || !house)
      return res.status(404).json({ error: "Rumah tidak ditemukan." });

    const { error: updateErr } = await supabase
      .from("houses")
      .update({
        status,
        updated_at: new Date().toISOString(),
        reserved_at: status === "reserved" ? new Date().toISOString() : null,
      })
      .eq("id_house", id_house);

    if (updateErr) throw updateErr;

    await supabase.from("notification").insert([
      {
        id_admin,
        id_residence,
        content: `Status rumah ${house.number_block} diubah menjadi ${status}.`,
        send_time: new Date().toISOString(),
        read_status: false,
      },
    ]);

    res.json({ message: "Status rumah berhasil diperbarui." });
  } catch (err) {
    console.error("❌ Gagal update status rumah:", err);
    res.status(500).json({ error: "Gagal memperbarui status rumah." });
  }
};


/* ======================================================
   📅 GET RESERVATION BY HOUSE (untuk hitung H-7 di frontend)
====================================================== */
export const getReservationByHouse = async (req, res) => {
  try {
    const { id_house } = req.params;

    // Ambil reservasi berdasarkan rumah
    const { data: reservations, error } = await supabase
      .from("reservation")
      .select("*")
      .eq("id_house", id_house)
      .order("start_date", { ascending: false });

    if (error) throw error;

    if (!reservations || reservations.length === 0) {
      return res.json({ success: true, reservations: [] });
    }

    const latest = reservations[0]; // Ambil reservasi terbaru

    // Format data agar cocok dengan frontend
    res.json({
      success: true,
      reservations: [
        {
          id_reservasi: latest.id_reservasi,
          reservation_date: latest.start_date, // ⬅️ frontend pakai ini
          end_date: latest.end_date,
          reservation_status: latest.reservation_status,
        },
      ],
    });
  } catch (err) {
    console.error("❌ Gagal ambil reservasi:", err);
    res.status(500).json({ success: false, error: "Gagal ambil reservasi." });
  }
};






