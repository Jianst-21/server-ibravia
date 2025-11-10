import express from "express";
import {
  signup,
  login,
  logout,
  verifyOTP,
  resendOTP,
  forgotPassword,
  resetPassword 
} from "../controllers/authcontroller.js";


const router = express.Router();
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/resend-otp", resendOTP);
router.post("/verify-otp", verifyOTP);  
router.post("/forgot-password", forgotPassword);
router.post("/reset-Password", resetPassword);

export default router;
