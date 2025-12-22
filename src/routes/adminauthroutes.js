import express from "express";
import { loginAdmin } from "../controllers/adminauthcontroller.js";

const router = express.Router();

//Auth
router.post("/login", loginAdmin);

export default router;
