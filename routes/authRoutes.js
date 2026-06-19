const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// REGISTER ROUTE
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, adminSecret } = req.body;

    // If attempting to register as admin, validate the admin secret
    if (role === 'admin') {
      if (!process.env.ADMIN_SECRET) {
        return res.status(500).json({ msg: 'Admin secret not configured on server' });
      }
      if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(401).json({ msg: 'Invalid admin secret' });
      }
    }

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'user' // Defaults to 'user' unless 'admin' is specified
    });

    await user.save();
    res.status(201).json({ msg: "User registered successfully" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// LOGIN ROUTE
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

    // Create Token with the User ID and Role
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token, role: user.role, name: user.name });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;