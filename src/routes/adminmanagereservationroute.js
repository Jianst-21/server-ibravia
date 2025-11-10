import express from "express";
import { verifyAdmin } from "../middlewares/adminmiddleware.js";
import {
  getAdminManageReservation,
  acceptReservation,
  cancelReservation,
} from "../controllers/adminmanagereservationcontroller.js";

const router = express.Router();

// Mendefinisikan path spesifik untuk masing-masing aksi
router.get("/manage-reservation", verifyAdmin, getAdminManageReservation);
router.post("/accept-reservation", verifyAdmin, acceptReservation);
router.post("/cancel-reservation", verifyAdmin, cancelReservation);

export default router;