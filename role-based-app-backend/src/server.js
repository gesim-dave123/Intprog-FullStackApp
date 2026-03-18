// initialized packages
require("dotenv/config");
const express = require("express");
const cors = require("cors");
const authRoutes = require("../src/routes/authRoutes.js");
const dashboardRoutes = require("../src/routes/dashboardRoutes.js");
const employeeRoutes = require("../src/routes/employeeRoutes.js");
const accountsRoutes = require("../src/routes/accountsRoutes.js");
const departmentRoutes = require("../src/routes/departmentRoutes.js");
const requestRoutes = require("../src/routes/requestRoutes.js");

const { authenticateToken } = require("../src/middlewares/auth.middleware.js");

const { displayProfile } = require("../src/controllers/user.controller.js");
const app = express();

const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: [`http://127.0.0.1:5500`, `http://localhost:5500`],
  }),
);

app.use(express.json());

// middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/requests", requestRoutes);

app.get(`/api/profile`, authenticateToken, displayProfile);

app.get(`/api/content/guest`, (req, res) => {
  res.json({ message: "Public content for all visitors" });
});

// middleware for server error
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Server Error");
});

app.listen(PORT, () => {
  console.log(`The backend is running on http://localhost:${PORT}`);
});
