import express from "express";
import { verifyAdmin } from "../middlewares/adminmiddleware.js";
import { getAdminDashboard, getResidenceInfo } from "../controllers/admindashboardcontroller.js";


const router = express.Router();

// Dashboard admin utama
router.get("/dashboard", verifyAdmin, getAdminDashboard);

// Info nama residence
router.get("/residence-info", verifyAdmin, getResidenceInfo);

export default router;
