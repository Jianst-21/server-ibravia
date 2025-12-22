import express from "express";
import supabase from "../config/supabaseclient.js";

const router = express.Router();

/**
 * Endpoint: GET /:id_residence
 * Deskripsi: Mengambil daftar blok yang tersedia di bawah satu perumahan (residence) tertentu.
 * Penggunaan: Digunakan pada fitur House Selector untuk memfilter blok setelah user memilih lokasi perumahan.
 */
router.get("/:id_residence", async (req, res) => {
  try {
    // Mengekstraksi ID perumahan dari parameter URL
    const { id_residence } = req.params;

    /**
     * Query Supabase:
     * - From: Tabel 'block'
     * - Select: Hanya mengambil kolom id_block, block_name, dan id_residence untuk efisiensi bandwidth.
     * - Filter: Mencocokkan id_residence agar data yang tampil tidak bercampur dengan perumahan lain.
     */
    const { data, error } = await supabase
      .from("block")
      .select("id_block, block_name, id_residence")
      .eq("id_residence", id_residence);

    // Melempar error ke blok catch jika query database gagal
    if (error) throw error;

    // Mengirimkan array data blok dalam format JSON ke client
    res.json(data);
  } catch (err) {
    // Logging error di sisi server untuk keperluan maintenance
    console.error("Error fetching blocks:", err.message);
    
    // Memberikan respon error dengan status code 500 (Internal Server Error)
    res.status(500).json({ error: err.message });
  }
});

export default router;