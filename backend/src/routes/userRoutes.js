const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { searchUsers } = require("../controllers/userController");

const router = express.Router();

router.get("/search", requireAuth, searchUsers);

module.exports = router;