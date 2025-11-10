import express from "express";
import { getPropertyList, getPropertyDetail } from "../controllers/propertycontroller.js";

const router = express.Router();

// semua property
router.get("/", getPropertyList);

// detail satu property
router.get("/:id", getPropertyDetail);

export default router;
