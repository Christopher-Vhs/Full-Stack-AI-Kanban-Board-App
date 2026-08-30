require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

    console.log("Applying schema...");

    await pool.query(sql);

    console.log("✅ Schema applied successfully.");
  } catch (err) {
    console.error("❌ Failed to apply schema:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();