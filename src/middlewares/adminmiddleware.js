import jwt from "jsonwebtoken";
import supabase from "../config/supabaseclient.js";

/**
 * Middleware: verifyAdmin
 * Berfungsi sebagai penjaga gerbang (gatekeeper) untuk rute-rute khusus admin.
 * Alur: Validasi Header -> Verifikasi Token JWT -> Validasi Database -> Inject Data ke Request.
 */
export const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    /**
     * Tahap 1: Validasi Struktur Header
     * Memastikan header Authorization tersedia dan menggunakan skema 'Bearer'.
     */
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token tidak ditemukan!" });
    }

    const token = authHeader.split(" ")[1];

    /**
     * Tahap 2: Verifikasi Integritas Token
     * Menggunakan library jsonwebtoken untuk mendekripsi dan memverifikasi tanda tangan digital token.
     */
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(403)
        .json({ error: "Token tidak valid atau sudah kedaluwarsa!" });
    }

    /**
     * Tahap 3: Validasi Payload
     * Memastikan payload token mengandung informasi minimal yang diperlukan (id_admin).
     */
    if (!decoded?.id_admin) {
      return res.status(403).json({ error: "Token tidak memiliki akses admin!" });
    }

    /**
     * Tahap 4: Verifikasi Eksistensi di Database
     * Melakukan cross-check ke Supabase untuk memastikan akun admin masih aktif
     * dan datanya sinkron dengan database terbaru.
     */
    const { data: admin, error } = await supabase
      .from("admin")
      .select("id_admin, id_residence, role, username, email_admin, name_admin")
      .eq("id_admin", decoded.id_admin)
      .single();

    if (error || !admin) {
      return res.status(404).json({ error: "Admin tidak ditemukan di database!" });
    }

    /**
     * Tahap 5: Otorisasi Berbasis Peran (RBAC)
     * Memastikan kolom 'role' pada database benar-benar bernilai 'admin'.
     */
    if (!admin.role || admin.role.toLowerCase() !== "admin") {
      return res
        .status(403)
        .json({ error: "Akses ditolak! Hanya admin yang diizinkan!" });
    }

    /**
     * Tahap 6: Injeksi Objek Admin
     * Menyimpan data admin ke dalam objek 'req' sehingga controller selanjutnya 
     * dapat mengakses informasi seperti 'id_residence' tanpa perlu query ulang.
     */
    req.admin = {
      id_admin: admin.id_admin,
      id_residence: admin.id_residence, 
      username: admin.username,
      email_admin: admin.email_admin,
      name_admin: admin.name_admin,
      role: admin.role,
    };

    // Melanjutkan ke fungsi/middleware berikutnya
    next();
  } catch (err) {
    console.error("Terjadi kesalahan di verifyAdmin:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server (verifyAdmin)" });
  }
};