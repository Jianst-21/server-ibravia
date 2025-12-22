import express from "express";
import supabase from "../config/supabaseclient.js";

const router = express.Router();

/**
 * Endpoint: GET /block/:id_block
 * Deskripsi: Mengambil seluruh unit rumah yang terdaftar dalam satu blok tertentu.
 * Alur: Melakukan join multi-tabel untuk mendapatkan detail spesifikasi rumah, 
 * informasi blok, hingga data perumahan (residence) terkait.
 */
router.get("/block/:id_block", async (req, res) => {
  const { id_block } = req.params;

  try {
    /**
     * Menggunakan fitur relasi Supabase (PostgREST) untuk mengambil data 
     * dari beberapa tabel dalam satu kali pemanggilan API.
     * * - houses: Tabel utama.
     * - block: Join ke tabel blocks untuk mendapatkan spesifikasi ruangan.
     * - residence: Join bersarang (nested) di dalam blocks untuk mendapatkan profil perumahan.
     */
    const { data, error } = await supabase
      .from("houses")
      .select(`
        id_house,
        house_area,
        land_area,
        full_price,
        down_payment,
        status,
        id_pt,
        number_block,
        block:blocks (
          id_block,
          block_name,
          residence:residences (
            id_residence,
            residence_name,
            location,
            id_pt
          ),
          bedroom,
          bathroom,
          living_room,
          family_room,
          kitchen
        )
      `)
      .eq("id_block", id_block); // Filter berdasarkan ID blok yang dikirim di URL

    // Melempar error ke blok catch jika query gagal
    if (error) throw error;

    // Mengirimkan respon sukses beserta array unit rumah yang ditemukan
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    // Logging error di sisi server untuk debugging
    console.error("Error fetching houses:", err.message);
    
    // Memberikan feedback error ke frontend dengan status code 500
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;