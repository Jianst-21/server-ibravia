// src/middlewares/adminmiddleware.js
import jwt from "jsonwebtoken";
import supabase from "../config/supabaseclient.js";

/* =============================
   🔒 VERIFY ADMIN MIDDLEWARE
============================= */
export const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // ✅ Pastikan token dikirim dan formatnya benar
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token tidak ditemukan!" });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verifikasi token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res
        .status(403)
        .json({ error: "Token tidak valid atau sudah kedaluwarsa!" });
    }

    // ✅ Pastikan token berisi id_admin
    if (!decoded?.id_admin) {
      return res.status(403).json({ error: "Token tidak memiliki akses admin!" });
    }

    // ✅ Ambil data admin dari Supabase
    const { data: admin, error } = await supabase
      .from("admin")
      .select("id_admin, id_residence, role, username, email_admin, name_admin")
      .eq("id_admin", decoded.id_admin)
      .single();

    if (error || !admin) {
      return res.status(404).json({ error: "Admin tidak ditemukan di database!" });
    }

    // ✅ Cek role admin (optional, tapi bagus untuk keamanan)
    if (!admin.role || admin.role.toLowerCase() !== "admin") {
      return res
        .status(403)
        .json({ error: "Akses ditolak! Hanya admin yang diizinkan!" });
    }

    // ✅ Simpan data admin agar bisa dipakai di controller
    req.admin = {
      id_admin: admin.id_admin,
      id_residence: admin.id_residence, // penting untuk query dashboard
      username: admin.username,
      email_admin: admin.email_admin,
      name_admin: admin.name_admin,
      role: admin.role,
    };

    next();
  } catch (err) {
    console.error("❌ Terjadi kesalahan di verifyAdmin:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server (verifyAdmin)" });
  }
};
