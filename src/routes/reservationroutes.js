import express from "express";
import { createReservation } from "../controllers/reservationcontroller.js";
import { updateReservationStatus } from "../cron/updateReservationStatus.js";
import { getReservationsByUser } from "../controllers/reservationcontroller.js";

const router = express.Router();
router.post("/", createReservation);

router.get("/user/:id_user", getReservationsByUser);
router.get("/check-expired", async (req, res) => {
  await updateReservationStatus();
  res.json({ message: "Reservation check completed." });
});



export default router;  
