import express from "express";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import supabase from "../config/supabaseclient.js";

const router = express.Router();

/* ================================
   CONFIG PASSPORT GOOGLE
================================ */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;

        // Cek apakah user ada di Supabase
        const { data: existingUser } = await supabase
          .from("user")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        let user = existingUser;

        // Jika belum ada → create user baru
        if (!existingUser) {
          const username = email.split("@")[0];

          const { data: newUser, error } = await supabase
            .from("user")
            .insert([
              {
                name,
                email,
                password: null,
                account_status: true,
                username,
              },
            ])
            .select()
            .single();

          if (error) throw error;
          user = newUser;
        }

        return done(null, user);
      } catch (err) {
        console.error("Google Auth Error:", err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

/* ======================================
   MULAI LOGIN → REDIRECT KE GOOGLE
====================================== */
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

/* ======================================
   CALLBACK DARI GOOGLE
====================================== */
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req, res) => {
    // Generate token seperti login biasa
    const token = jwt.sign(
      { id_user: req.user.id_user, email: req.user.email, role: "user" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Redirect ke frontend dengan data lengkap
    const redirectURL =
      "http://localhost:5173/oauth-success" +
      `?email=${req.user.email}` +
      `&name=${req.user.name}` +
      `&id=${req.user.id_user}` +
      `&token=${token}`;

    res.redirect(redirectURL);
  }
);

export default router;
