import express from "express";
import { verifyAdmin } from "../middlewares/adminmiddleware.js";
import {
  getAdminHouses,
  updateHouseStatus,
  getReservationByHouse,
} from "../controllers/adminmanagehousecontroller.js";

const router = express.Router();

/* ===========================
   🏠 ADMIN MANAGE HOUSES
=========================== */

// Ambil semua data rumah milik PT admin
router.get("/houses", verifyAdmin, async (req, res, next) => {
  console.log(" [GET] Fetching admin houses...");
  next();
}, getAdminHouses);

// Update status rumah (available / sold / reserved)
router.patch("/houses/:id_house/status", verifyAdmin, async (req, res, next) => {
  console.log(` [PATCH] Updating house status — ID: ${req.params.id_house}`);
  next();
}, updateHouseStatus);

/* ===========================
   📅 RESERVATIONS BY HOUSE
=========================== */

// Ambil data reservasi berdasarkan id_house (untuk hitung H-7)
router.get("/reservations/:id_house", verifyAdmin, async (req, res, next) => {
  console.log(` [GET] Fetching reservations for house ID: ${req.params.id_house}`);
  next();
}, getReservationByHouse);

export default router;
