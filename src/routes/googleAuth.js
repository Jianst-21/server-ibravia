import express from "express";
import passport from "passport";
import jwt from "jsonwebtoken";

const router = express.Router();

/**
 * Endpoint: GET /google
 * Deskripsi: Tahap inisialisasi autentikasi Google.
 * Alur: Mengarahkan pengguna ke halaman login Google (Consent Screen).
 * Scope: Meminta izin akses untuk data profil dan alamat email pengguna.
 */
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

/**
 * Endpoint: GET /google/callback
 * Deskripsi: Titik balik (callback) setelah pengguna berhasil login di sisi Google.
 * Alur: Validasi kredensial -> Pembuatan JWT -> Redirect ke Frontend.
 */
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", session: true }),
  (req, res) => {
    // Penanganan jika data pengguna gagal didapatkan
    if (!req.user) return res.redirect("/login");

    /**
     * Pembuatan JSON Web Token (JWT):
     * Informasi user yang didapat dari Google (id, email) dimasukkan ke dalam payload.
     * Token ini yang nantinya digunakan oleh frontend untuk melakukan request yang terautentikasi.
     */
    const token = jwt.sign(
      { id_user: req.user.id_user, email: req.user.email, role: "user" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    /**
     * Redirect ke Frontend:
     * Karena frontend Ibravia berbasis Single Page Application (SPA), token dan data 
     * user dikirimkan melalui URL Query Parameter agar bisa ditangkap oleh halaman 'oauth-success'.
     */
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