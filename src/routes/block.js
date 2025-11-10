import express from "express";
import supabase from "../config/supabaseclient.js";

const router = express.Router();

// GET block berdasarkan id_residence
router.get("/:id_residence", async (req, res) => {
  try {
    const { id_residence } = req.params;

    const { data, error } = await supabase
      .from("block")
      .select("id_block, block_name, id_residence")
      .eq("id_residence", id_residence);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(" Error fetching blocks:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
