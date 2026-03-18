const express = require("express");
const {
  authenticateToken,
  authorizeRole,
} = require("../middlewares/auth.middleware.js");
const {
  displayEmployees,
  addEmployee,
  editEmployee,
  deleteEmployee,
} = require("../controllers/user.controller.js");

const router = express.Router();

router.get("/", authenticateToken, authorizeRole("admin"), displayEmployees);
router.post("/", authenticateToken, authorizeRole("admin"), addEmployee);
router.put(
  "/:employeeId",
  authenticateToken,
  authorizeRole("admin"),
  editEmployee,
);
router.delete(
  "/:employeeId",
  authenticateToken,
  authorizeRole("admin"),
  deleteEmployee,
);

module.exports = router;
