import supabase from "../config/supabaseclient.js";

/**
 * Middleware: checkAuth
 * Digunakan untuk validasi autentikasi berbasis session tradisional.
 * Memeriksa apakah objek user tersedia di dalam req.session sebelum mengizinkan akses ke rute.
 */
export const checkAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Harus login terlebih dahulu" });
  }
  next();
};

/**
 * Middleware: requireAuth
 * Digunakan untuk validasi autentikasi berbasis token (JWT/Supabase Auth).
 * Alur: Ekstraksi Bearer Token -> Validasi ke Supabase -> Injeksi Data User.
 */
export const requireAuth = async (req, res, next) => {
  try {
    // Mengekstraksi token dari header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token tidak ditemukan" });
    }

    /**
     * Verifikasi Token:
     * Menggunakan method bawaan Supabase untuk memvalidasi token secara real-time.
     * Keuntungannya: Memastikan akun user masih aktif di server Supabase.
     */
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ error: "Token tidak valid" });
    }

    /**
     * Menyimpan data user ke dalam objek request (req.user).
     * Hal ini memudahkan controller selanjutnya untuk mengetahui identitas user yang sedang mengakses rute.
     */
    req.user = data.user;
    
    // Melanjutkan ke fungsi/middleware berikutnya
    next(); 
  } catch (err) {
    // Logging error untuk keperluan debugging pengembang
    console.error("Auth Middleware Error:", err); 
    res.status(500).json({ error: "Terjadi kesalahan autentikasi" });
  }
};