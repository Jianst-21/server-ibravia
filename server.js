import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import passport from "passport";
import "./src/config/passport.js"; // PENTING → load passport config dulu

// Routes
import googleAuthRoutes from "./src/routes/googleAuth.js";
import authRoutes from "./src/routes/authroutes.js";
import houseRoutes from "./src/routes/houseroutes.js";
import reservationRoutes from "./src/routes/reservationroutes.js";
import propertyRoutes from "./src/routes/propertyroutes.js";
import blockRoutes from "./src/routes/block.js";
import houseSelector from "./src/routes/houseselector.js";
import editProfileRoutes from "./src/routes/editprofile.js";

import adminAuthRoutes from "./src/routes/adminauthroutes.js";
import adminDashboardRoutes from "./src/routes/admindashboardroutes.js";
import adminManageHouseRoutes from "./src/routes/adminmanagehouseroutes.js";
import adminNotificationRoutes from "./src/routes/adminnotificationroutes.js";
import adminReportRoutes from "./src/routes/adminreportroutes.js";
import adminManageReservationRoutes from "./src/routes/adminmanagereservationroute.js";

import cron from "node-cron";
import { updateReservationStatus } from "./src/cron/updateReservationStatus.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// 🔧 Logging Environment
// =====================================================
console.log("============ ENV CHECK ============");
console.log("SERVER_URL:", process.env.SERVER_URL);
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "OK" : "MISSING");
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "OK" : "MISSING");
console.log("====================================");

// =====================================================
// 🌐 CORS CONFIG
// =====================================================
const allowedOrigins = [
  "http://localhost:5173",
  "https://tubes-ibravia.vercel.app"
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// =====================================================
// 🔧 Express + Session
// =====================================================
app.set("trust proxy", 1); // WAJIB untuk Zeabur

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Google login (agar tidak 502)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: true,      // Zeabur pakai HTTPS
      httpOnly: true,
      sameSite: "none",  // harus none supaya bisa cross-domain
      maxAge: 1000 * 60 * 60 * 2,
    },
  })
);

// =====================================================
// 🔑 Passport Init
// =====================================================
app.use(passport.initialize());
app.use(passport.session());

// =====================================================
// 🌍 Test Route
// =====================================================
app.get("/", (req, res) => {
  res.send("Ibravia backend is running!");
});

// =====================================================
// 🚀 Routes
// =====================================================

// 🔥 Google Auth harus di paling atas sebelum /api/auth
app.use("/api/auth", googleAuthRoutes);

// Login biasa
app.use("/api/auth", authRoutes);

// User
app.use("/api/user", editProfileRoutes);

// Houses
app.use("/api/houses", houseRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/property", propertyRoutes);
app.use("/api/block", blockRoutes);
app.use("/api/houseselector", houseSelector);

// Admin
app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/admin", adminManageHouseRoutes);
app.use("/api/admin", adminNotificationRoutes);
app.use("/api/admin/report", adminReportRoutes);
app.use("/api/admin", adminManageReservationRoutes);

// =====================================================
// 🕒 Cron
// =====================================================
cron.schedule("0 0 * * *", () => {
  console.log("Running midnight cron job...");
  updateReservationStatus();
});

// =====================================================
// 🟢 Start Server
// =====================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
