import express from "express";
import multer from "multer";
import { getUserById, updateUser } from "../controllers/authcontroller.js";

const router = express.Router();

/**
 * Konfigurasi Multer:
 * Digunakan untuk menangani pengunggahan file (multipart/form-data).
 */
const upload = multer({
  // Menyimpan file sementara di RAM agar bisa langsung diproses oleh library gambar (seperti Sharp)
  storage: multer.memoryStorage(),
  
  // Batasan ukuran file (2MB) untuk menghemat ruang penyimpanan server/cloud
  limits: { fileSize: 2 * 1024 * 1024 }, 
  
  /**
   * Filter File:
   * Memastikan hanya file dengan tipe MIME "image/*" yang dapat diunggah.
   * Ini adalah lapisan keamanan pertama untuk mencegah unggahan file berbahaya (seperti .exe atau .php).
   */
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Hanya file gambar yang diperbolehkan."));
    } else {
      cb(null, true);
    }
  },
});

/**
 * Endpoint: GET /:id_user
 * Mengambil informasi detail profil user untuk ditampilkan pada halaman profil.
 */
router.get("/:id_user", getUserById);

/**
 * Endpoint: PUT /:id_user
 * Mengperbarui data profil user.
 * Middleware 'upload.single' akan menangkap satu file dari field bernama "profile_photo"
 * dan menyimpannya di 'req.file' sebelum diteruskan ke controller 'updateUser'.
 */
router.put("/:id_user", upload.single("profile_photo"), updateUser);

export default router;