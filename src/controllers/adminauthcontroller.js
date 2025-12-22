import supabase from "../config/supabaseclient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/**
 * Controller loginAdmin
 * Mengelola proses autentikasi untuk aktor Admin.
 * Mendukung login menggunakan email maupun username secara fleksibel.
 */
export const loginAdmin = async (req, res) => {
  const { identifier, password } = req.body;

  try {
    // Validasi awal: Memastikan input tidak kosong
    if (!identifier || !password) {
      return res.status(400).json({ error: "Email/Username dan password wajib diisi." });
    }

    // Menentukan jenis identifier (apakah user menginput email atau username)
    const isEmail = identifier.includes("@");

    /**
     * Mengambil data admin dari tabel 'admin' di database Supabase.
     * Pencarian dilakukan berdasarkan kolom email_admin atau username.
     */
    const { data: admin, error } = await supabase
      .from("admin")
      .select("*")
      .eq(isEmail ? "email_admin" : "username", identifier)
      .single();

    // Penanganan jika terjadi error pada database atau data tidak ditemukan
    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Password or Username is incorrect"});
    }

    if (!admin) {
      return res.status(404).json({ error: "Admin tidak ditemukan." });
    }

    /**
     * Verifikasi Kredensial:
     * Membandingkan password teks murni dari input dengan hash password di database menggunakan bcrypt.
     */
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: "Password or Username is incorrect" });
    }

    /**
     * Pembuatan JSON Web Token (JWT):
     * Menyimpan informasi admin ke dalam payload token.
     * Masa berlaku token diatur selama 8 jam.
     */
    const token = jwt.sign(
      {
        id_admin: admin.id_admin,
        id_residence: admin.id_residence,
        role: admin.role,
        username: admin.username,
        email_admin: admin.email_admin,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    /**
     * Audit Trail:
     * Memperbarui kolom 'last_login' pada database untuk mencatat waktu akses terakhir admin.
     */
    await supabase
      .from("admin")
      .update({ last_login: new Date().toISOString() })
      .eq("id_admin", admin.id_admin);

    // Mengirimkan respon sukses beserta token dan profil singkat admin
    res.json({
      message: "Login admin berhasil.",
      token,
      admin: {
        id_admin: admin.id_admin,
        name: admin.name_admin,
        role: admin.role,
        id_residence: admin.id_residence,
        email_admin: admin.email_admin,
        username: admin.username,
      },
    });
  } catch (err) {
    // Penanganan error sistem secara umum (Generic error message demi keamanan)
    console.error("Error login admin:", err);
    res.status(500).json({ error: "Password or Username is incorrect" });
  }
};