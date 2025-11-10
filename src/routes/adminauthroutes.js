import express from "express";
import { loginAdmin } from "../controllers/adminauthcontroller.js";

const router = express.Router();

/* ======================
   🔐 ADMIN AUTH
====================== */
router.post("/login", loginAdmin);

export default router;
