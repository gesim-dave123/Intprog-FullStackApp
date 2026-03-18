const express = require("express");
const {
  registerUser,
  login,
  logout,
} = require("../controllers/auth.controller.js");
// const { authenticateToken } = require("../middlewares/auth.middleware.js");
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", login);
router.post("/logout", logout);

module.exports = router;
