import supabase from "../config/supabaseclient.js";

export const checkAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Harus login terlebih dahulu" });
  }
  next();
};

// Middleware untuk cek token autentikasi
export const requireAuth = async (req, res, next) => {
  try {
    // Ambil token dari header (misalnya dikirim dari frontend)
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token tidak ditemukan" });
    }

    // Verifikasi token via Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: "Token tidak valid" });
    }

    // Simpan user ke request agar bisa diakses di controller
    req.user = data.user;
    next(); // lanjut ke route berikutnya
  } catch (err) {
    console.error("Auth Middleware Error:", err); // <-- pakai err, warning hilang
    res.status(500).json({ error: "Terjadi kesalahan autentikasi" });
  }
};
