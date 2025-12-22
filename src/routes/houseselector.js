import express from "express";
import supabase from "../config/supabaseclient.js";

const router = express.Router();

/**
 * Endpoint: GET /:id_house
 * Deskripsi: Mengambil detail lengkap dari satu unit rumah berdasarkan ID-nya.
 * Alur: Melakukan join multi-level untuk mendapatkan informasi unit, blok, dan perumahan sekaligus.
 */
router.get("/:id_house", async (req, res) => {
  const { id_house } = req.params;

  try {
    /**
     * Query Supabase:
     * - Menggunakan .select() untuk mendefinisikan kolom dan relasi (Join).
     * - .eq("id_house", id_house) bertindak sebagai filter pencarian.
     * - .single() memastikan Supabase mengembalikan satu objek, bukan array berisi satu objek.
     */
    const { data, error } = await supabase
      .from("houses")
      .select(`
        id_house,
        house_area,
        land_area,
        number_block,
        status,
        full_price,
        down_payment,
        block:block (
          id_block,
          block_name,
          residence:residence (
            id_residence,
            location,
            residence_name
          )
        )
      `)
      .eq("id_house", id_house)
      .single();

    // Melempar error jika terjadi masalah pada query database
    if (error) throw error;

    // Mengirimkan objek data rumah ke frontend
    res.json(data);
  } catch (err) {
    // Logging error di server untuk mempermudah pelacakan bug
    console.error("Gagal ambil house:", err.message);
    
    // Memberikan respon error yang deskriptif ke pengguna
    res.status(500).json({ message: "Failed to retrieve house data" });
  }
});

export default router;