const express = require("express");
const {
  authenticateToken,
  authorizeRole,
} = require("../middlewares/auth.middleware.js");
const {
  displayAccounts,
  addAccount,
  editAccount,
  resetAccountPassword,
  deleteAccount,
} = require("../controllers/user.controller.js");

const router = express.Router();

router.get("/", authenticateToken, authorizeRole("admin"), displayAccounts);
router.post(
  "/addAccount",
  authenticateToken,
  authorizeRole("admin"),
  addAccount,
);
router.put(
  "/:accountId",
  authenticateToken,
  authorizeRole("admin"),
  editAccount,
);
router.patch(
  "/:accountId/reset-password",
  authenticateToken,
  authorizeRole("admin"),
  resetAccountPassword,
);
router.delete(
  "/:accountId",
  authenticateToken,
  authorizeRole("admin"),
  deleteAccount,
);

module.exports = router;
