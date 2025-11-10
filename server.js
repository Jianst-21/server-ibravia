import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import transporter from "./src/config/nodemailer.js";

import authRoutes from "./src/routes/authroutes.js";
import houseRoutes from "./src/routes/houseroutes.js";
import reservationRoutes from "./src/routes/reservationroutes.js";
import propertyRoutes from "./src/routes/propertyroutes.js";
import blockRoutes from "./src/routes/block.js";
import houseSelector from "./src/routes/houseselector.js";
import cron from "node-cron";
import { updateReservationStatus } from "./src/cron/updateReservationStatus.js";
import editProfileRoutes from "./src/routes/editprofile.js";

import adminAuthRoutes from "./src/routes/adminauthroutes.js";
import adminDashboardRoutes from "./src/routes/admindashboardroutes.js";
import adminManageHouseRoutes from "./src/routes/adminmanagehouseroutes.js";
import adminNotificationRoutes from "./src/routes/adminnotificationroutes.js";
import adminReportRoutes from "./src/routes/adminreportroutes.js";
import adminManageReservationRoutes from "./src/routes/adminmanagereservationroute.js";

// ===============================
// 🔧 Inisialisasi
// ===============================
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ===============================
// 🧩 Middleware Global
// ===============================

// CORS → izinkan frontend di localhost:5173
// CORS → izinkan frontend di localhost:5173
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true, // penting kalau pakai session/cookie
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session → untuk login
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // false kalau masih pakai http
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 2, // 2 jam
    },
  })
);
// ===============================
// 🚀 Routes Utama
// ===============================
app.use("/api/auth", authRoutes);
app.use("/api/houses", houseRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/property", propertyRoutes);
app.use("/api/block", blockRoutes);
app.use("/api/houseselector", houseSelector);
app.use("/api/user", editProfileRoutes);

app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/admin", adminManageHouseRoutes);
app.use("/api/admin", adminNotificationRoutes);
app.use("/api/admin/report", adminReportRoutes);
app.use("/api/admin", adminManageReservationRoutes);

// ===============================
// 📧 Route Tes Email
// ===============================
app.get("/test-email", async (req, res) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // kirim ke email sendiri untuk test
      subject: "Tes Email dari Ibravia",
      text: "Halo! Ini email percobaan dari server Ibravia ",
    });

    console.log(" Email terkirim:", info.response);
    res.send(" Email berhasil dikirim!");
  } catch (err) {
    console.error(" Gagal kirim email:", err);
    res.status(500).send(" Gagal mengirim email, cek console.");
  }
});

// Jalankan setiap jam 00:00
cron.schedule("0 0 * * *", () => {
  console.log(" Menjalankan cron job setiap tengah malam");
  updateReservationStatus();
});

// ===============================
// 🟢 Jalankan Server
// ===============================
app.listen(PORT, () => {
  console.log(` Server berjalan di http://localhost:${PORT}`);
});

export default app;
