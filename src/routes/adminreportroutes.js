import express from "express";
import { verifyAdmin } from "../middlewares/adminmiddleware.js";
import { getAdminReport } from "../controllers/adminreportcontroller.js";

const router = express.Router();

/* ======================
   📊 ADMIN REPORT
====================== */
router.get("/", verifyAdmin, getAdminReport);

export default router;
