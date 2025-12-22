import supabase from "../config/supabaseclient.js";

/**
 * Controller: getPropertyList
 * Deskripsi: Mengambil seluruh daftar blok perumahan beserta informasi terkait.
 * Relasi: 
 * - Menarik data profil perumahan (residence).
 * - Menarik daftar unit rumah (house) yang tersedia di dalam blok tersebut.
 */
export const getPropertyList = async (req, res) => {
  const { data, error } = await supabase
    .from("block")
    .select(`
      id_block,
      block_name,
      bedroom,
      bathroom,
      living_room,
      kitchen,
      family_room,
      residence (
        id_residence,
        residence_name,
        location,
        id_pt
      ),
      house (
        id_house,
        land_area,
        house_area,
        number_block,
        status,
        id_pt,
        full_price,
        down_payment
      )
    `);

  // Mengembalikan pesan error jika query ke database gagal
  if (error) return res.status(400).json({ error: error.message });
  
  res.json(data);
};

/**
 * Controller: getPropertyDetail
 * Deskripsi: Mengambil detail spesifik dari satu blok berdasarkan ID.
 * Fitur: Mengonversi nilai angka mentah (price & down payment) menjadi format mata uang Rupiah (IDR).
 */
export const getPropertyDetail = async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("block")
    .select(`
      id_block,
      block_name,
      bedroom,
      bathroom,
      living_room,
      kitchen,
      family_room,
      residence (
        id_residence,
        residence_name,
        location,
        id_pt
      ),
      house (
        id_house,
        land_area,
        house_area,
        number_block,
        status,
        full_price,
        down_payment,
        id_pt
      )
    `)
    .eq("id_block", id)
    .single(); // Mengambil satu objek data (bukan array)

  if (error) return res.status(400).json({ error: error.message });

  /**
   * Helper: formatRupiah
   * Menggunakan Intl.NumberFormat standar JavaScript untuk mengubah angka 
   * menjadi format IDR (Contoh: Rp 500.000.000).
   */
  const formatRupiah = (value) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value || 0);

  /**
   * Transformasi Data:
   * Melakukan restrukturisasi data untuk menyisipkan nilai harga yang sudah terformat
   * sebelum dikirimkan ke frontend.
   */
  const formattedData = {
    ...data,
    house: {
      ...data.house,
      full_price: formatRupiah(data.house?.full_price),
      down_payment: formatRupiah(data.house?.down_payment),
      id_pt: data.house?.id_pt,
    },
  };

  res.json(formattedData);
};