import express from "express";
import supabase from "../config/supabaseclient.js";

const router = express.Router();

// ✅ Ambil rumah berdasarkan id_block + relasi lengkap
router.get("/block/:id_block", async (req, res) => {
  const { id_block } = req.params;

  try {
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

    if (error) {
      console.error(" Supabase error:", error.message);
      return res.status(500).json({ message: "Database error", error });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "No houses found for this block" });
    }

    res.json(data);
  } catch (err) {
    console.error(" Server error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});
export default router;
