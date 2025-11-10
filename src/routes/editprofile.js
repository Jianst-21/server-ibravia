import express from "express";
import multer from "multer";
import { getUserById, updateUser } from "../controllers/authcontroller.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),          // simpan file di memory dulu
  limits: { fileSize: 2 * 1024 * 1024 },    // max 2MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Hanya file gambar yang diperbolehkan."));
    } else {
      cb(null, true);
    }
  },
});
router.get("/:id_user", getUserById);
router.put("/:id_user", upload.single("profile_photo"), updateUser);

export default router;
