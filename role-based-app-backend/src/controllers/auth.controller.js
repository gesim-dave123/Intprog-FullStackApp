const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const users = require("../databaseMockUp/users.Storage.js");
require("dotenv/config");

const registerUser = async (req, res) => {
  try {
    const { fullname, username, password, email, role } = req.body;

    if (!username || !password || !fullname) {
      return res
        .status(400)
        .json({ error: `Username, fullname and password are required` });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: `Password should be at least 6 characters long` });
    }

    if (!role) {
      return res.status(400).json({ error: `Role is required` });
    }
    if (!email) {
      return res.status(400).json({ error: `Email is required` });
    }

    const existingUser = users.find((u) => u.username === username);

    if (existingUser) {
      return res.status(409).json({ error: `Username already exists` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: users.length + 1,
      fullname: fullname,
      username: username,
      password: hashedPassword,
      email: email,
      verified: false,
      role: role,
    };

    users.push(newUser);
    console.log(users);
    res.status(201).json({ message: `User registered`, username, role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

const login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername) {
      return res.status(400).json({ message: "Username/Email is required" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const user = users.find(
      (u) => u.username === emailOrUsername || u.email === emailOrUsername,
    );

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, email: user.email },
      process.env.SECRET_KEY,
      { expiresIn: "1h" },
    );

    res.json({
      token,
      user: { username: user.username, role: user.role, email: user.email },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while logging in" });
  }
};

const logout = async () => {};

const verifyEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = users.find(
      (u) => String(u.email).toLowerCase() === String(email).toLowerCase()
    );

    if (!user) {
      return res.status(404).json({ error: "No account found with that email" });
    }

    if (user.verified) {
      return res.status(200).json({ message: "Email is already verified" });
    }

    user.verified = true;
    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during verification" });
  }
};

module.exports = { registerUser, login, logout, verifyEmail };
