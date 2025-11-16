import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    const token = jwt.sign(
      { id_user: req.user.id_user, email: req.user.email, role: "user" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

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
