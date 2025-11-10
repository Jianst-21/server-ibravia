import express from "express";
import {
  getAdminNotifications,
  markAsRead,
  getUnreadCount,
} from "../controllers/adminnotificationcontroller.js";
import { verifyAdmin } from "../middlewares/adminmiddleware.js"; // ✅ sudah cocok

const router = express.Router();

// Gunakan middleware verifyAdmin
router.get("/notifications", verifyAdmin, getAdminNotifications);
router.patch("/notifications/:id_notification/read", verifyAdmin, markAsRead);
router.get("/notifications/unread-count", verifyAdmin, getUnreadCount);

export default router;
