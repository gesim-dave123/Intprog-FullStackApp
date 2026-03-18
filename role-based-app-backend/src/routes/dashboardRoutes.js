const express = require("express");
const {
  authenticateToken,
  authorizeRole,
} = require("../middlewares/auth.middleware.js");
const { displayDashboardData } = require("../controllers/user.controller.js");

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  displayDashboardData,
);

module.exports = router;
