import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";

const router = express.Router();

// 👉 Step 1: redirect ke Google login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// 👉 Step 2: callback Google
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", session: true }),
  (req, res) => {
    if (!req.user) return res.redirect("/login");

    // Generate JWT
    const token = jwt.sign(
      { id_user: req.user.id_user, email: req.user.email, role: "user" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Redirect ke frontend
    const redirectURL =
      `${process.env.FRONTEND_URL}/oauth-success` +
      `?email=${req.user.email}` +
      `&name=${req.user.name}` +
      `&id=${req.user.id_user}` +
      `&token=${token}`;

    res.redirect(redirectURL);
  }
);

export default router;
