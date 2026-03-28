require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const helmet = require('helmet');
const path = require("path");

const app = express();

// ============================
// SECURITY MIDDLEWARE
// ============================

// Helmet with proper CSP for inline scripts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  noSniff: true,
  xssFilter: true
}));

// Restricted CORS - only allow your own domain
const corsOptions = {
  origin: process.env.ALLOWED_ORIGIN || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key']
};
app.use(cors(corsOptions));

// Rate limiting middleware (prevent spam/DDoS)
const MAX_REQUESTS = 100;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const requestCounts = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }
  
  const userRequests = requestCounts.get(ip);
  const recentRequests = userRequests.filter(time => now - time < WINDOW_MS);
  
  if (recentRequests.length >= MAX_REQUESTS) {
    return res.status(429).json({ 
      success: false, 
      error: "Too many requests. Please try again later." 
    });
  }
  
  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  next();
}

// Request body size limit - prevent large payload attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Apply rate limiting
app.use('/api/', rateLimit);

// Sanitize inputs - basic XSS prevention
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-\+\(\)]{7,}$/;

const PORT = process.env.PORT || 3000;

/* ------------------------- Static Files ------------------------- */
app.use(express.static(path.join(__dirname, "public")));

/* ------------------------- MongoDB Connection ------------------------- */
// Optional: Only connect if MONGO_URI exists
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ MongoDB Connected Successfully");
      console.log(`📊 MongoDB: ✅ Connected`);
    })
    .catch((err) => {
      console.error("❌ MongoDB Connection Failed:", err);
      console.log(`📊 MongoDB: ❌ Failed`);
    });
} else {
  console.warn("⚠️ MONGO_URI not set - database features disabled");
  console.log(`📊 MongoDB: ⚠️ Not set`);
}

/* ------------------------- Schema + Model ------------------------- */
const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    location: String,
    service: String,
    message: String,
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const Enquiry = mongoose.model("Enquiry", enquirySchema);

/* ------------------------- Email Transporter ------------------------- */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("⚠️ SMTP not fully configured — emails will NOT send.");
    return null;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  // Verify the transporter
  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ SMTP Verification Failed:", error.message);
    } else {
      console.log("✅ SMTP Verified Successfully");
    }
  });

  return transporter;
}

const transporter = createTransporter();

/* ------------------------- Routes ------------------------- */

// API Home
app.get("/api", (req, res) => {
  res.type("html").send(`
    <!DOCTYPE html>
    <html><body style="font-family: system-ui; padding: 2rem;">
      <h2>Samarth Enquiries API</h2>
      <p><strong>POST</strong> /api/enquiry — save enquiry + send email</p>
      <p><strong>GET</strong> /api/enquiries — view saved enquiries</p>
      <p>Server is running ✅</p>
    </body></html>
  `);
});

// Save enquiry
app.post("/api/enquiry", async (req, res) => {
  try {
    // Validate and sanitize input
    const rawData = {
      name: (req.body.name || "").trim().substring(0, 100),
      phone: (req.body.phone || "").trim().substring(0, 20),
      email: (req.body.email || "").trim().toLowerCase().substring(0, 100),
      location: (req.body.location || "").trim().substring(0, 100),
      service: (req.body.service || "").trim().substring(0, 100),
      message: (req.body.message || "").trim().substring(0, 1000),
    };

    // Validate required fields
    if (!rawData.name || !rawData.phone || !rawData.email) {
      return res.status(400).json({ 
        success: false, 
        error: "Name, phone, and email are required" 
      });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(rawData.email)) {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid email address"
      });
    }

    // Validate phone format
    if (!PHONE_REGEX.test(rawData.phone)) {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid phone number"
      });
    }

    // Sanitize all inputs
    const data = {
      name: sanitizeInput(rawData.name),
      phone: sanitizeInput(rawData.phone),
      email: sanitizeInput(rawData.email),
      location: sanitizeInput(rawData.location),
      service: sanitizeInput(rawData.service),
      message: sanitizeInput(rawData.message),
    };

    // Only save to DB if MongoDB is connected
    let savedId = null;
    if (mongoose.connection.readyState === 1) {
      const doc = new Enquiry(data);
      await doc.save();
      savedId = doc._id;
      console.log("📥 Enquiry saved:", doc._id);
    } else {
      console.log("📥 Enquiry received (DB not connected):", data.email);
    }

    let mailed = false;

    // Send email if configured
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"Samarth Website" <${process.env.SMTP_USER}>`,
          to: process.env.TO_EMAIL || process.env.SMTP_USER,
          subject: `New Website Enquiry — ${data.service || 'General'}`,
          html: `
            <h3>New Enquiry</h3>
            <p><strong>Name:</strong> ${data.name}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Phone:</strong> ${data.phone}</p>
            <p><strong>Service:</strong> ${data.service || 'Not specified'}</p>
            <p><strong>Location:</strong> ${data.location || 'Not specified'}</p>
            <p><strong>Message:</strong><br>${(data.message || 'No message').replace(/\n/g, "<br>")}</p>
            <p><em>Received at: ${new Date().toLocaleString()}</em></p>
          `,
        });

        mailed = true;
        console.log("📧 Email sent successfully");
      } catch (err) {
        console.warn("⚠️ Email failed:", err.message);
      }
    }

    return res.json({ 
      success: true, 
      mailed, 
      id: savedId,
      message: "Enquiry received successfully"
    });
  } catch (err) {
    console.error("❌ Error saving enquiry:", err);
    return res.status(500).json({ 
      success: false, 
      error: "An error occurred. Please try again later." 
    });
  }
});

// Fetch enquiries - Protected with API Key
app.get("/api/enquiries", async (req, res) => {
  try {
    // Require API key for security
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({ 
        error: "Unauthorized. Valid API key required." 
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: "Database not available" 
      });
    }

    const list = await Enquiry.find().sort({ createdAt: -1 }).lean();
    return res.json(list);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    return res.status(500).json({ error: "Unable to retrieve enquiries" });
  }
});

/* ------------------------- Fallback Route ------------------------- */
// Always LAST — serve frontend for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "samarth.html"));
});

/* ------------------------- Error Handling ------------------------- */
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

/* ------------------------- Start Server ------------------------- */
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, "public")}`);
  console.log(` Email: ${transporter ? '✅ Configured' : '⚠️ Not configured'}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  mongoose.connection.close();
  process.exit(0);
});