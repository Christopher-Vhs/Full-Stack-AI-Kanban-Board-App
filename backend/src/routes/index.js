const express = require("express");
const authRoutes = require("./authRoutes");
const boardRoutes = require("./boardRoutes");
const userRoutes = require("./userRoutes");

const router = express.Router();

router.get("/health", (_req, res) => res.json({ status: "ok" }));

router.use("/auth", authRoutes);
router.use("/boards", boardRoutes);
router.use("/users", userRoutes);

module.exports = router;