import supabase from "../config/supabaseclient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/* =============================
   🔐 LOGIN ADMIN
============================= */
export const loginAdmin = async (req, res) => {
  const { identifier, password } = req.body;

  try {
    if (!identifier || !password) {
      return res.status(400).json({ error: "Email/Username dan password wajib diisi." });
    }

    const isEmail = identifier.includes("@");

    // Cari admin berdasarkan email / username
    const { data: admin, error } = await supabase
      .from("admin")
      .select("*")
      .eq(isEmail ? "email_admin" : "username", identifier)
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Password or Username is incorrect"});
    }

    if (!admin) {
      return res.status(404).json({ error: "Admin tidak ditemukan." });
    }

    // Cek password
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: "Password or Username is incorrect" });
    }

    // Buat JWT
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

    // Update last login
    await supabase
      .from("admin")
      .update({ last_login: new Date().toISOString() })
      .eq("id_admin", admin.id_admin);

    // Kirim response sukses
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
    console.error("❌ Error login admin:", err);
    res.status(500).json({ error: "Password or Username is incorrect" });
  }
};
