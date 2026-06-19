const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const User = require('../models/user');

const usersDataPath = path.join(__dirname, '..', 'data', 'users.json');

async function ensureLocalUsersFile() {
  try {
    await fs.mkdir(path.dirname(usersDataPath), { recursive: true });
    await fs.access(usersDataPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(usersDataPath, '[]', 'utf8');
    } else {
      throw err;
    }
  }
}

async function loadLocalUsers() {
  await ensureLocalUsersFile();
  const raw = await fs.readFile(usersDataPath, 'utf8');
  return JSON.parse(raw || '[]');
}

async function saveLocalUsers(users) {
  await ensureLocalUsersFile();
  await fs.writeFile(usersDataPath, JSON.stringify(users, null, 2), 'utf8');
}

async function findUserByEmail(email) {
  if (mongoose.connection.readyState === 1) {
    return User.findOne({ email });
  }
  const users = await loadLocalUsers();
  return users.find(u => u.email === email) || null;
}

async function createLocalUser(userData) {
  const users = await loadLocalUsers();
  users.push(userData);
  await saveLocalUsers(users);
  return userData;
}

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
    let user = await findUserByEmail(email);
    if (user) return res.status(400).json({ msg: "User already exists" });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = {
      name,
      email,
      password: hashedPassword,
      role: role || 'user' // Defaults to 'user' unless 'admin' is specified
    };

    if (mongoose.connection.readyState === 1) {
      user = new User(newUser);
      await user.save();
    } else {
      user = await createLocalUser(newUser);
    }

    res.status(201).json({ msg: "User registered successfully" });
  } catch (err) {
    console.error('Auth register error:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// LOGIN ROUTE
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await findUserByEmail(email);
    if (!user) return res.status(400).json({ msg: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

    // Create Token with the User ID and Role
    const token = jwt.sign(
      { id: user._id || user.email, role: user.role },
      process.env.JWT_SECRET || 'samarth-secret-change-in-production',
      { expiresIn: '1h' }
    );

    res.json({ token, role: user.role, name: user.name });
  } catch (err) {
    console.error('Auth login error:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

module.exports = router;