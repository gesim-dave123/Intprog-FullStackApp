const express = require("express");
const {
  authenticateToken,
  authorizeRole,
} = require("../middlewares/auth.middleware.js");
const {
  displayDepartments,
  addDepartment,
  editDepartment,
  deleteDepartment,
} = require("../controllers/user.controller.js");

const router = express.Router();

router.get("/", authenticateToken, authorizeRole("admin"), displayDepartments);
router.post("/", authenticateToken, authorizeRole("admin"), addDepartment);
router.put(
  "/:departmentId",
  authenticateToken,
  authorizeRole("admin"),
  editDepartment,
);
router.delete(
  "/:departmentId",
  authenticateToken,
  authorizeRole("admin"),
  deleteDepartment,
);

module.exports = router;
