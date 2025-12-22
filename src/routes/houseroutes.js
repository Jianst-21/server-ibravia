import express from "express";
import supabase from "../config/supabaseclient.js";

const router = express.Router();

/**
 * Endpoint: GET /block/:id_block
 * Deskripsi: Mengambil daftar unit rumah berdasarkan ID Blok tertentu.
 * Alur: Melakukan pemanggilan data relasional (Join) dari tabel Houses -> Block -> Residence
 * untuk mendapatkan informasi properti yang komprehensif dalam satu request.
 */
router.get("/block/:id_block", async (req, res) => {
  const { id_block } = req.params;

  try {
    /**
     * Query Supabase menggunakan sintaks PostgREST:
     * 1. Mengambil detail unit (luas, harga, status).
     * 2. Join ke tabel 'block' untuk mendapatkan spesifikasi ruangan.
     * 3. Nested Join ke tabel 'residence' untuk mendapatkan lokasi dan nama perumahan.
     */
    const { data, error } = await supabase
      .from("houses")
      .select(`
        id_house,
        id_pt,
        house_area,
        land_area,
        number_block,
        status,
        full_price,
        down_payment,
        block:block (
          id_block,
          block_name,
          bathroom,
          bedroom,
          living_room,
          family_room,
          kitchen,
          residence:residence (
            id_residence,
            location,
            residence_name
          )
        )
      `)
      .eq("id_block", id_block);

    // Penanganan error dari sisi database Supabase
    if (error) {
      console.error("Supabase error:", error.message);
      return res.status(500).json({ message: "Database error", error });
    }

    // Validasi jika data kosong (blok tidak ditemukan atau tidak ada rumah di blok tersebut)
    if (!data || data.length === 0) {
      return res.status(404).json({ message: "No houses found for this block" });
    }

    // Mengirimkan array data rumah ke frontend
    res.json(data);
  } catch (err) {
    // Penanganan error internal server (misal: masalah koneksi atau logika JS)
    console.error("Server error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;