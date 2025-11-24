// GET single house by id_house

import express from "express";
import supabase from "../config/supabaseclient.js";

const router = express.Router();

router.get("/:id_house", async (req, res) => {
  const { id_house } = req.params;

  try {
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

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("❌ Gagal ambil house:", err.message);
    res.status(500).json({ message: "Failed to retrieve house data" });
  }
});
export default router;