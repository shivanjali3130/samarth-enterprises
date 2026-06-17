require('dotenv').config({ path: __dirname + '/.env' });
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path       = require('path');

const app        = express();
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'samarth-secret-change-in-production';

// ══════════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https:"],
      fontSrc:    ["'self'", "https://cdnjs.cloudflare.com", "https:"],
      imgSrc:     ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('/api/enquiry', cors());
app.options('/api/*', cors());

// Provide a clear 405 for non-POST methods to /api/enquiry and ensure OPTIONS responds
app.all('/api/enquiry', (req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  if (req.method !== 'POST') return res.status(405).json({ msg: 'Method Not Allowed' });
  next();
});

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Debug: log every incoming request (helpful to diagnose 405s)
app.use((req, res, next) => {
  try {
    console.log('>>> Incoming:', req.method, req.path, 'Host:', req.headers.host, 'Origin:', req.headers.origin);
  } catch (e) {
    // ignore logging errors
  }
  next();
});

// ══════════════════════════════════════════════
// STATIC FILES
// Serve ALL files (html, css, js, images) from
// the project root directory. Must come BEFORE
// the wildcard fallback so .html files are found.
// ══════════════════════════════════════════════
app.use(express.static(path.join(__dirname), {
  index: false    // don't auto-serve index.html — we handle '/' manually
}));

// ══════════════════════════════════════════════
// MONGODB
// ══════════════════════════════════════════════
const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/samarthDB';
mongoose.connect(dbURI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err  => console.error('❌ MongoDB Failed:', err.message));

// ══════════════════════════════════════════════
// SCHEMAS & MODELS
// ══════════════════════════════════════════════
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true },   // always bcrypt hash
  role:      { type: String, enum: ['user', 'admin'], default: 'user' },
  phone:     { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const enquirySchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name:      { type: String, required: true },
  phone:     { type: String, required: true },
  email:     { type: String, required: true },
  location:  { type: String, default: '' },
  service:   { type: String, default: '' },
  message:   { type: String, default: '' },
  status:    { type: String, enum: ['New', 'In Progress', 'Resolved', 'Cancelled'], default: 'New' },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

const User    = mongoose.model('User',    userSchema);
const Enquiry = mongoose.model('Enquiry', enquirySchema);

const labourSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  phone:     { type: String, required: true, trim: true, unique: true },
  role:      { type: String, required: true, trim: true },
  city:      { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

const Labour  = mongoose.model('Labour', labourSchema);

// ══════════════════════════════════════════════
// RATE LIMITER  (no extra package needed)
// ══════════════════════════════════════════════
const rateMap = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key  = req.ip;
    const now  = Date.now();
    const hits = (rateMap.get(key) || []).filter(t => now - t < windowMs);
    if (hits.length >= max)
      return res.status(429).json({ msg: 'Too many requests. Try again later.' });
    hits.push(now);
    rateMap.set(key, hits);
    next();
  };
}

// ══════════════════════════════════════════════
// AUTH MIDDLEWARE
// ══════════════════════════════════════════════
function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ msg: 'No token. Please log in.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ msg: 'Token invalid or expired. Please log in again.' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ msg: 'Admin access only.' });
}

// ══════════════════════════════════════════════
// EMAIL  (optional — only if SMTP env vars set)
// ══════════════════════════════════════════════
const OWNER_EMAIL = process.env.TO_EMAIL || process.env.OWNER_EMAIL || 'samarthent2024@gmail.com';
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  console.log('📧 Setting up email with SMTP_HOST:', process.env.SMTP_HOST, 'PORT:', process.env.SMTP_PORT);
  
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for 587
    auth:   { 
      user: process.env.SMTP_USER, 
      pass: process.env.SMTP_PASS 
    }
  });

  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ SMTP configuration invalid:', error.message);
      console.error('   Full error:', error);
    } else {
      console.log('✅ Email configured successfully');
      console.log('   Sending to:', OWNER_EMAIL);
    }
  });
} else {
  console.warn('⚠️  SMTP not set — emails disabled');
  console.warn('   Missing: SMTP_HOST, SMTP_USER, or SMTP_PASS in .env file');
}

// ══════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════

// ── POST /api/auth/register ───────────────────
// Anyone can register as 'user'.
// 'admin' role only allowed when NO admin exists yet (first-time setup).
// After that, existing admin creates new admins via POST /api/users.
app.post('/api/auth/register', rateLimit(10, 60_000), async (req, res) => {
  try {
    console.log('📝 Register:', req.body.email, '| role:', req.body.role);
    const { name, email, password, role } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!name || !normalizedEmail || !password)
      return res.status(400).json({ msg: 'Name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ msg: 'Password must be at least 6 characters.' });
    if (await User.findOne({ email: normalizedEmail }))
      return res.status(409).json({ msg: 'An account with this email already exists.' });

    // Admin self-registration only when no admin exists yet
    const requestedRole = role === 'admin' ? 'admin' : 'user';
    if (requestedRole === 'admin' && await User.findOne({ role: 'admin' }))
      return res.status(403).json({ msg: 'Admin already exists. Contact the existing admin to create new admin accounts.' });

    const hash = await bcrypt.hash(password, 12);
    await User.create({ name, email: normalizedEmail, password: hash, role: requestedRole });

    console.log(`✅ Registered ${requestedRole}: ${email}`);
    return res.status(201).json({ msg: 'Registration successful! You can now log in.' });

  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ msg: 'Server error during registration.' });
  }
});

// ── POST /api/auth/login ──────────────────────
// Returns JWT token + role so frontend can redirect correctly.
app.post('/api/auth/login', rateLimit(20, 60_000), async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    console.log('🔐 Login attempt:', normalizedEmail);

    if (!normalizedEmail || !password)
      return res.status(400).json({ msg: 'Email and password are required.' });

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ msg: 'Invalid email or password.' });
    }

    console.log('✅ User found:', email, '| Role:', user.role);
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log('❌ Password mismatch for:', email);
      return res.status(401).json({ msg: 'Invalid email or password.' });
    }

    // Sign JWT — contains id, name, email, role (never password)
    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✅ Login: ${email} (${user.role})`);

    // Return token + user info — frontend uses role to decide where to redirect
    return res.json({
      success: true,
      token,
      role:  user.role,
      name:  user.name,
      email: user.email,
      id:    user._id
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ msg: 'Server error during login.' });
  }
});

// ── GET /api/auth/admin-exists ─────────────────
app.get('/api/auth/admin-exists', async (req, res) => {
  try {
    const count = await User.countDocuments({ role: 'admin' });
    return res.json({ success: true, adminExists: count > 0 });
  } catch (err) {
    console.error('Admin exists check failed:', err.message);
    return res.status(500).json({ success: false, msg: 'Server error.' });
  }
});

// ── GET /api/auth/me ──────────────────────────
app.get('/api/auth/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found.' });
    return res.json({ success: true, user });
  } catch {
    return res.status(500).json({ msg: 'Server error.' });
  }
});

// ══════════════════════════════════════════════
// USER MANAGEMENT  (admin only)
// ══════════════════════════════════════════════

// GET /api/users
app.get('/api/users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.json({ success: true, users });
  } catch {
    return res.status(500).json({ msg: 'Server error.' });
  }
});

// POST /api/users  — admin creates a user or another admin
app.post('/api/users', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ msg: 'Name, email and password required.' });
    if (await User.findOne({ email }))
      return res.status(409).json({ msg: 'Email already exists.' });
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hash, role: role || 'user', phone: phone || '' });
    const { password: _, ...safe } = user.toObject();
    return res.status(201).json({ success: true, user: safe });
  } catch {
    return res.status(500).json({ msg: 'Server error.' });
  }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', protect, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.id.toString())
      return res.status(400).json({ msg: 'You cannot delete your own account.' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found.' });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ msg: 'Server error.' });
  }
});

// ══════════════════════════════════════════════
// ENQUIRY ROUTES
// ══════════════════════════════════════════════

// POST /api/enquiry  — public (from website contact form)
app.post('/api/enquiry', rateLimit(20, 15 * 60_000), async (req, res) => {
  console.log('📥 Enquiry POST received:', req.method, req.url, req.headers['content-type']);
  console.log('📥 Body:', req.body);
  try {
    const { name, phone, email, location, service, message } = req.body;
    if (!name || !phone || !email)
      return res.status(400).json({ error: 'Name, phone and email are required.' });

    const matchedUser = await User.findOne({ email });
    const doc = await Enquiry.create({
      userId:   matchedUser ? matchedUser._id : null,
      name, phone, email,
      location: location || '',
      service:  service  || '',
      message:  message  || ''
    });

    let emailSent = false;
    let emailError = null;

    if (transporter) {
      try {
        console.log('📧 Sending email to:', OWNER_EMAIL);
        await transporter.sendMail({
          from:    `"Samarth Website" <${process.env.SMTP_USER}>`,
          to:      OWNER_EMAIL,
          subject: `New Enquiry — ${service || 'General'}`,
          html:    `<h3>New Enquiry</h3>
                    <p><b>Name:</b> ${name}</p>
                    <p><b>Phone:</b> ${phone}</p>
                    <p><b>Email:</b> ${email}</p>
                    <p><b>Service:</b> ${service || '—'}</p>
                    <p><b>Location:</b> ${location || '—'}</p>
                    <p><b>Message:</b> ${message || '—'}</p>`
        });
        emailSent = true;
        console.log('✅ Email sent successfully to:', OWNER_EMAIL);
      } catch (e) {
        emailError = e.message;
        console.error('❌ Email failed:', e.message);
        console.error('   Error code:', e.code);
        console.error('   From:', process.env.SMTP_USER);
        console.error('   To:', OWNER_EMAIL);
      }
    } else {
      console.warn('⚠️  Transporter not initialized — email not sent');
      emailError = 'Email service not configured';
    }

    return res.json({ success: true, id: doc._id, message: 'Enquiry received!', emailSent, emailError });
  } catch (err) {
    console.error('Enquiry error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/my-enquiries  — logged-in user sees only their own
app.get('/api/my-enquiries', protect, async (req, res) => {
  try {
    const list = await Enquiry.find({
      $or: [{ userId: req.user.id }, { email: req.user.email }]
    }).sort({ createdAt: -1 });
    return res.json({ success: true, enquiries: list });
  } catch {
    return res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/admin/all-labour  — admin sees all worker records
app.get('/api/admin/all-labour', protect, adminOnly, async (req, res) => {
  try {
    const list = await Labour.find().sort({ createdAt: -1 });
    return res.json({ success: true, labour: list });
  } catch (err) {
    console.error('Labour fetch error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/admin/labour  — create a new labour worker record
app.post('/api/admin/labour', protect, adminOnly, async (req, res) => {
  try {
    const { name, phone, role, city } = req.body;
    const normalizedPhone = typeof phone === 'string' ? phone.replace(/\s+/g, '').trim() : '';
    if (!name || !normalizedPhone || !role || !city)
      return res.status(400).json({ error: 'All fields are required.' });

    const existing = await Labour.findOne({ phone: normalizedPhone });
    if (existing)
      return res.status(409).json({ error: 'This mobile number already exists.' });

    const doc = await Labour.create({ name, phone: normalizedPhone, role, city });
    return res.status(201).json({ success: true, labour: doc });
  } catch (err) {
    console.error('Labour create error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'This mobile number already exists.' });
    }
    return res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/admin/labour/:id
app.delete('/api/admin/labour/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Labour.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Labour record not found.' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Labour delete error:', err.message);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/admin/all-enquiries  — admin sees all
app.get('/api/admin/all-enquiries', protect, adminOnly, async (req, res) => {
  try {
    const list = await Enquiry.find().sort({ createdAt: -1 });
    return res.json({ success: true, enquiries: list });
  } catch {
    return res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/admin/enquiries/:id/status
app.put('/api/admin/enquiries/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const allowed = ['New', 'In Progress', 'Resolved', 'Cancelled'];
    if (!allowed.includes(req.body.status))
      return res.status(400).json({ msg: 'Invalid status.' });
    const doc = await Enquiry.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!doc) return res.status(404).json({ msg: 'Enquiry not found.' });
    return res.json({ success: true, enquiry: doc });
  } catch {
    return res.status(500).json({ msg: 'Server error.' });
  }
});

// DELETE /api/admin/enquiries/:id
app.delete('/api/admin/enquiries/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await Enquiry.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ msg: 'Not found.' });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ msg: 'Server error.' });
  }
});

// GET /api/admin/stats
app.get('/api/admin/stats', protect, adminOnly, async (req, res) => {
  try {
    const [total, newC, inProg, resolved] = await Promise.all([
      Enquiry.countDocuments(),
      Enquiry.countDocuments({ status: 'New' }),
      Enquiry.countDocuments({ status: 'In Progress' }),
      Enquiry.countDocuments({ status: 'Resolved' })
    ]);
    return res.json({ success: true, stats: { total, new: newC, inProgress: inProg, resolved } });
  } catch {
    return res.status(500).json({ msg: 'Server error.' });
  }
});

// ══════════════════════════════════════════════
// PAGE ROUTES
// Explicit route for each HTML page so the
// wildcard fallback never swallows them.
// ══════════════════════════════════════════════
const htmlPages = [
  'samarth', 'about', 'contact', 'gallery', 'services',
  'auth-portal', 'admin-dashboard', 'my-enquiries', 'login', 'portal'
];

htmlPages.forEach(page => {
  app.get(`/${page}.html`, (req, res) => {
    const file = path.join(__dirname, `${page}.html`);
    res.sendFile(file, err => {
      if (err) {
        console.error(`❌ Could not serve ${page}.html:`, err.message);
        res.status(404).send(`
          <h2 style="font-family:sans-serif">Page not found: <code>${page}.html</code></h2>
          <p>Make sure the file exists in your project folder.</p>
          <a href="/">← Go Home</a>
        `);
      }
    });
  });
});

// Home - Now serves portal landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'portal.html'));
});

// ══════════════════════════════════════════════
// FALLBACKS
// ══════════════════════════════════════════════
// Unknown API route → 404 JSON
app.use((req, res, next) => {
  if (req.path.startsWith('/api/'))
    return res.status(404).json({ msg: `API endpoint not found: ${req.method} ${req.path}` });
  next();
});

// Everything else → home page
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'samarth.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ msg: 'Internal server error' });
});

// ══════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n🚀  Server running at http://localhost:${PORT}\n`);
});