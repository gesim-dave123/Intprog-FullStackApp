const express = require("express");
const {
  authenticateToken,
  authorizeRole,
} = require("../middlewares/auth.middleware.js");
const {
  displayRequests,
  createRequest,
  updateRequestStatus,
  deleteRequest,
} = require("../controllers/user.controller.js");

const router = express.Router();

router.get("/", authenticateToken, displayRequests);
router.post("/", authenticateToken, createRequest);
router.patch(
  "/:requestId/status",
  authenticateToken,
  authorizeRole("admin"),
  updateRequestStatus,
);
router.delete("/:requestId", authenticateToken, deleteRequest);

module.exports = router;
