import express from "express";
import supabase from "../config/supabaseclient.js";

const router = express.Router();

// Ambil semua rumah berdasarkan id_block, termasuk id_pt
router.get("/block/:id_block", async (req, res) => {
  const { id_block } = req.params;

  try {
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
      .eq("id_block", id_block);

    if (error) throw error;

    

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("Error fetching houses:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;
