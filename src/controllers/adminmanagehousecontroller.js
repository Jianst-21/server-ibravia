import supabase from "../config/supabaseclient.js";

/**
 * Controller: getAdminHouses
 * Mengambil data seluruh unit rumah yang dikelola oleh residence admin yang sedang login.
 * Melakukan join dengan tabel 'block' dan 'residence' untuk mendapatkan informasi detail properti.
 */
export const getAdminHouses = async (req, res) => {
  try {
    // Mengambil id_residence dari objek admin yang disematkan oleh middleware autentikasi
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
    
    // Mengirimkan array data rumah ke frontend
    res.json(houses);
  } catch (err) {
    console.error("Gagal mengambil data rumah:", err);
    res.status(500).json({ error: "Gagal mengambil data rumah." });
  }
};

/**
 * Controller: updateHouseStatus
 * Memperbarui status ketersediaan unit rumah (available, sold, atau reserved).
 * Setelah update berhasil, fungsi ini akan mencatat riwayat perubahan ke tabel notifikasi.
 */
export const updateHouseStatus = async (req, res) => {
  try {
    const { id_house } = req.params;
    const { status } = req.body;
    const { id_admin, id_residence } = req.admin;

    // Validasi: Memastikan status yang dikirim sesuai dengan aturan bisnis
    const allowed = ["available", "sold", "reserved"];
    if (!allowed.includes(status)) {
      return res
        .status(400)
        .json({ error: "Status tidak valid (available/sold/reserved)." });
    }

    // Verifikasi kepemilikan: Memastikan rumah tersebut memang milik residence admin yang bersangkutan
    const { data: house, error: findErr } = await supabase
      .from("houses")
      .select("*")
      .eq("id_house", id_house)
      .eq("id_residence", id_residence)
      .single();

    if (findErr || !house)
      return res.status(404).json({ error: "Rumah tidak ditemukan." });

    // Melakukan pembaruan status dan timestamp terkait
    const { error: updateErr } = await supabase
      .from("houses")
      .update({
        status,
        updated_at: new Date().toISOString(),
        // Jika status berubah jadi reserved, catat waktu reservasinya. Jika tidak, kosongkan.
        reserved_at: status === "reserved" ? new Date().toISOString() : null,
      })
      .eq("id_house", id_house);

    if (updateErr) throw updateErr;

    // Membuat log notifikasi otomatis untuk mencatat siapa admin yang mengubah status rumah tersebut
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
    console.error("Gagal update status rumah:", err);
    res.status(500).json({ error: "Gagal memperbarui status rumah." });
  }
};

/**
 * Controller: getReservationByHouse
 * Mengambil data reservasi terbaru untuk unit rumah spesifik.
 * Digunakan oleh frontend untuk menghitung masa berlaku reservasi (misal: H-7 deadline).
 */
export const getReservationByHouse = async (req, res) => {
  try {
    const { id_house } = req.params;

    // Mencari semua riwayat reservasi untuk rumah tersebut, diurutkan dari yang terbaru
    const { data: reservations, error } = await supabase
      .from("reservation")
      .select("*")
      .eq("id_house", id_house)
      .order("start_date", { ascending: false });

    if (error) throw error;

    // Jika tidak ada data reservasi, kirim array kosong
    if (!reservations || reservations.length === 0) {
      return res.json({ success: true, reservations: [] });
    }

    // Mengambil objek reservasi teratas (paling terbaru)
    const latest = reservations[0];

    // Mengirimkan respon dengan struktur yang diharapkan oleh komponen frontend Ibravia
    res.json({
      success: true,
      reservations: [
        {
          id_reservasi: latest.id_reservasi,
          reservation_date: latest.start_date, // Dipetakan ke start_date untuk frontend
          end_date: latest.end_date,
          reservation_status: latest.reservation_status,
        },
      ],
    });
  } catch (err) {
    console.error("Gagal ambil reservasi:", err);
    res.status(500).json({ success: false, error: "Gagal ambil reservasi." });
  }
};