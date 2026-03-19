const express = require("express");
const {
  registerUser,
  login,
  logout,
  verifyEmail,
} = require("../controllers/auth.controller.js");
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", login);
router.post("/logout", logout);
router.post("/verify-email", verifyEmail);

module.exports = router;
