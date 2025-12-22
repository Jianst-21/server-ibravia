import supabase from "../config/supabaseclient.js";
import bcrypt from "bcryptjs";
import transporter from "../config/nodemailer.js";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

/**
 * Controller: getUserById
 * Mengambil data profil lengkap user berdasarkan ID unik.
 */
export const getUserById = async (req, res) => {
  const { id_user } = req.params;

  try {
    const { data, error } = await supabase
      .from("user")
      .select("*")
      .eq("id_user", id_user)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "User not found." });

    res.json({ user: data });
  } catch (err) {
    console.error("Failed to fetch user:", err.message);
    res.status(500).json({ error: "Failed to retrieve user data." });
  }
};

/**
 * Controller: updateUser
 * Memperbarui profil user termasuk pengolahan gambar menggunakan Sharp 
 * dan pengunggahan ke Supabase Storage.
 */
export const updateUser = async (req, res) => {
  const { id_user } = req.params;

  if (!id_user || isNaN(Number(id_user))) {
    return res.status(400).json({ error: "Invalid user ID." });
  }

  const { first_name, last_name, phone_number, address, remove_photo } = req.body;

  try {
    let photoUrl = null;

    // Logika pengolahan gambar profil
    if (req.file) {
      const image = sharp(req.file.buffer);
      const metadata = await image.metadata();

      // Validasi resolusi minimal untuk menjaga kualitas UI
      if (metadata.width < 400 || metadata.height < 400) {
        return res.status(400).json({ error: "Minimum image resolution is 400x400px." });
      }

      const ext = req.file.originalname.split(".").pop();
      const fileName = `profile_${uuidv4()}.${ext}`;

      // Upload file ke bucket profile_photos
      const { error: uploadError } = await supabase.storage
        .from("profile_photos")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("profile_photos")
        .getPublicUrl(fileName);

      photoUrl = publicUrlData.publicUrl;
    }

    const updateData = {
      name: `${first_name} ${last_name}`,
      phone_number,
      address,
    };

    // Penanganan pembaruan atau penghapusan foto profil
    if (photoUrl) {
      updateData.photo_profile = photoUrl;
    } else if (remove_photo === "true") {
      updateData.photo_profile = null;
    }

    const { data, error } = await supabase
      .from("user")
      .update(updateData)
      .eq("id_user", Number(id_user))
      .select()
      .single();

    if (error) throw error;

    res.json({ message: "Profile updated successfully.", user: data });
  } catch (err) {
    console.error("Failed to update profile:", err.message);
    res.status(500).json({ error: err.message || "Failed to update profile." });
  }
};

/**
 * Controller: login
 * Mengelola autentikasi user menggunakan Email atau Username.
 * Melakukan pengecekan status verifikasi akun sebelum mengizinkan akses.
 */
export const login = async (req, res) => {
  const { identifier, password } = req.body;

  try {
    const isEmail = identifier.includes("@");

    const { data: user, error } = await supabase
      .from("user")
      .select("*")
      .eq(isEmail ? "email" : "username", identifier)
      .maybeSingle();

    if (error || !user) return res.status(400).json({ error: "User not found." });

    // Akun harus melewati verifikasi OTP terlebih dahulu
    if (!user.account_status)
      return res.status(403).json({ error: "Account not verified. Please verify your email via OTP." });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Incorrect password." });

    // Inisialisasi sesi server-side
    req.session.user = {
      id: user.id_user,
      email: user.email,
      username: user.username,
    };

    res.json({
      message: "Login successful.",
      user: req.session.user,
    });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Controller: logout
 * Menghapus sesi user yang aktif di server.
 */
export const logout = (req, res) => {
  req.session.destroy();
  res.json({ message: "Logout successful." });
};

/**
 * Helper: generateOTP
 * Menghasilkan kode numerik 6 digit untuk verifikasi.
 */
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Helper: sendOTP
 * Fungsi internal untuk membuat record OTP di database dan mengirimkannya ke email user.
 */
const sendOTP = async (user, purpose) => {
  const otpCode = generateOTP();
  const startTime = new Date();
  const expiredTime = new Date(startTime.getTime() + 5 * 60000); // Masa berlaku 5 menit

  const { error: otpError } = await supabase.from("otp").insert([
    {
      id_user: user.id_user,
      otp_code: otpCode,
      start_time: startTime.toISOString(),
      expired_time: expiredTime.toISOString(),
      otp_status: false,
      purpose,
    },
  ]);
  if (otpError) throw otpError;

  const emailSubject =
    purpose === "signup"
      ? "Account Verification Code - Ibravia"
      : "Password Reset Verification Code - Ibravia";

  const emailText = `
Dear ${user.name || "User"},

We received a request to ${
    purpose === "signup" ? "verify your account" : "reset your password"
  } on Ibravia.
Your OTP Code: ${otpCode}

Valid for 5 minutes. If you did not initiate this request, please disregard this email.
`;

  await transporter.sendMail({
    from: '"Ibravia Support" <no-reply@ibravia.com>',
    to: user.email,
    subject: emailSubject,
    text: emailText,
  });
};

/**
 * Controller: signup
 * Melakukan registrasi user baru dengan status awal unverified (false).
 */
export const signup = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const { data: existingUser } = await supabase
      .from("user")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.account_status === true) {
        return res.status(400).json({ error: "Email already in use." });
      } else {
        // Hapus record lama jika user mencoba daftar ulang sebelum verifikasi sukses
        await supabase.from("user").delete().eq("email", email);
      }
    }

    const hashed = await bcrypt.hash(password, 10);

    const { data: newUser, error: userError } = await supabase
      .from("user")
      .insert([{ name, email, password: hashed, account_status: false }])
      .select()
      .single();

    if (userError) throw userError;

    await sendOTP(newUser, "signup");

    res.json({
      message: "OTP has been sent to your email. Please verify your account.",
    });
  } catch (err) {
    console.error("Error during signup:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Controller: forgotPassword
 * Menginisialisasi alur pemulihan kata sandi dengan pengiriman OTP.
 */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const { data: user } = await supabase
      .from("user")
      .select("id_user, email, name")
      .eq("email", email)
      .maybeSingle();

    if (!user) return res.status(400).json({ error: "User not found." });

    await sendOTP(user, "reset_password");

    res.json({
      message: "Password reset OTP has been sent to your email.",
    });
  } catch (err) {
    console.error("Error during forgotPassword:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Controller: verifyOTP
 * Melakukan validasi kode OTP yang dimasukkan user terhadap data di database.
 * Mendukung verifikasi untuk signup dan reset_password.
 */
export const verifyOTP = async (req, res) => {
  const { email, otp, purpose } = req.body;

  try {
    if (!email || !otp || !purpose) {
      return res.status(400).json({ error: "Email, OTP, and purpose are required." });
    }

    const normalizedPurpose = purpose.toLowerCase();
    
    const { data: user } = await supabase
      .from("user")
      .select("id_user, email")
      .eq("email", email)
      .single();

    if (!user) return res.status(400).json({ error: "User not found." });

    // Mengambil OTP terbaru berdasarkan timestamp mulai
    const { data: otpData } = await supabase
      .from("otp")
      .select("*")
      .eq("id_user", user.id_user)
      .eq("purpose", normalizedPurpose)
      .order("start_time", { ascending: false })
      .limit(1)
      .single();

    if (!otpData || otpData.otp_code !== otp) return res.status(400).json({ error: "OTP incorrect." });
    if (otpData.otp_status) return res.status(400).json({ error: "OTP already used." });

    const now = new Date();
    const expired = new Date(otpData.expired_time);
    if (now > expired) return res.status(400).json({ error: "OTP has expired." });

    // Tandai OTP telah digunakan
    await supabase
      .from("otp")
      .update({ otp_status: true })
      .eq("id_otp", otpData.id_otp);

    if (normalizedPurpose === "signup") {
      await supabase
        .from("user")
        .update({ account_status: true })
        .eq("id_user", user.id_user);

      return res.json({ message: "Account verified successfully." });
    }

    if (normalizedPurpose === "reset_password") {
      return res.json({ message: "OTP verified. You may now reset your password." });
    }
  } catch (err) {
    console.error("Error during verifyOTP:", err);
    return res.status(500).json({ error: "Server error occurred." });
  }
};

/**
 * Controller: resendOTP
 * Mengirimkan ulang kode OTP jika user tidak menerimanya atau kode kadaluwarsa.
 */
export const resendOTP = async (req, res) => {
  const { email, purpose } = req.body;

  try {
    const { data: user } = await supabase
      .from("user")
      .select("id_user, name, email, account_status")
      .eq("email", email)
      .maybeSingle();

    if (!user) return res.status(400).json({ error: "User not found." });
    if (purpose === "signup" && user.account_status)
      return res.status(400).json({ error: "Account already verified." });

    await sendOTP(user, purpose);

    return res.json({ message: "A new OTP has been sent to your email." });
  } catch (err) {
    console.error("Error during resendOTP:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Controller: resetPassword
 * Melakukan pembaruan kata sandi di database setelah verifikasi OTP berhasil.
 */
export const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    if (!email || !newPassword)
      return res.status(400).json({ error: "Email and new password are required." });

    const { data: user, error: userError } = await supabase
      .from("user")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (userError || !user)
      return res.status(404).json({ error: "User not found." });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from("user")
      .update({ password: hashedPassword })
      .eq("email", email);

    if (updateError) throw updateError;

    res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Error during resetPassword:", err);
    res.status(500).json({ error: "Internal server error." });
  }
};