// ============================================================
//  Samarth Enterprises – User Portal Script
//  Handles: Auth check, Attendance DB, Enquiry display
// ============================================================

// ── Constants ────────────────────────────────────────────────
const COMPANY_NAME   = "Samarth Enterprises";
const ATTEND_KEY     = "samarth_attendance";   // localStorage key
const ENQUIRY_KEY    = "samarth_enquiries";    // localStorage key
const SESSION_KEY    = "samarth_session";      // localStorage key
const API_MY_ENQUIRIES = "/api/my-enquiries";

// ── Auth Guard ───────────────────────────────────────────────
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);

    const name = localStorage.getItem('name') || localStorage.getItem('userName');
    const email = localStorage.getItem('email');
    const id = localStorage.getItem('userId') || null;
    if (!email && !name) return null;

    return { id, name, email };
  } catch { return null; }
}

async function fetchServerEnquiries(token) {
  if (!token) return null;
  try {
    const res = await fetch(API_MY_ENQUIRIES, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.success || !Array.isArray(data.enquiries)) return null;
    return data.enquiries;
  } catch {
    return null;
  }
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "samarth.html";
}

// ── Attendance Database ───────────────────────────────────────
function getAllAttendance() {
  try {
    return JSON.parse(localStorage.getItem(ATTEND_KEY) || "[]");
  } catch { return []; }
}

function saveAttendance(records) {
  localStorage.setItem(ATTEND_KEY, JSON.stringify(records));
}

function recordAttendance(user) {
  const records = getAllAttendance();
  const now     = new Date();

  // Prevent duplicate attendance for same day & user
  const today = now.toDateString();
  const alreadyMarked = records.some(
    r => r.userId === user.id && new Date(r.timestamp).toDateString() === today
  );
  if (alreadyMarked) return false; // already logged today

  const entry = {
    id          : crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    userId      : user.id,
    userName    : user.name || user.email,
    email       : user.email,
    companyName : COMPANY_NAME,
    date        : now.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
    time        : now.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", second:"2-digit" }),
    timestamp   : now.toISOString(),
    dayOfWeek   : now.toLocaleDateString("en-IN", { weekday:"long" })
  };

  records.push(entry);
  saveAttendance(records);
  return true;
}

function getUserAttendance(userId) {
  return getAllAttendance()
    .filter(r => r.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ── Enquiry Database ──────────────────────────────────────────
function getAllEnquiries() {
  try {
    return JSON.parse(localStorage.getItem(ENQUIRY_KEY) || "[]");
  } catch { return []; }
}

// Only show enquiries submitted BY the user (not admin-added ones)
function getUserEnquiries(userId) {
  return getAllEnquiries()
    .filter(e => e.userId === userId && e.source === "user")
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ── Status Badge Helper ───────────────────────────────────────
function statusBadge(status) {
  const map = {
    pending    : { cls: "status-pending",    icon: "fa-clock",        label: "Pending"     },
    processing : { cls: "status-processing", icon: "fa-rotate",       label: "Processing"  },
    resolved   : { cls: "status-resolved",   icon: "fa-circle-check", label: "Resolved"    },
    closed     : { cls: "status-closed",     icon: "fa-xmark-circle", label: "Closed"      },
  };
  const s = map[(status || "pending").toLowerCase()] || map.pending;
  return `<span class="status-badge ${s.cls}"><i class="fa-solid ${s.icon}"></i>${s.label}</span>`;
}

// ── Render Enquiries Table ────────────────────────────────────
function renderEnquiries(userId, enquiries = null) {
  const tbody = document.getElementById("userTableBody");
  if (!Array.isArray(enquiries)) {
    enquiries = getUserEnquiries(userId);
  }

  if (enquiries.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="3">
          <div class="empty-state">
            <i class="fa-solid fa-inbox"></i>
            <p>No enquiries submitted yet.</p>
            <a href="contact.html" class="btn-new-enquiry">Make Your First Enquiry</a>
          </div>
        </td>
      </tr>`;
    return;
  }

  const formatDate = (entry) => {
    if (entry.date) return entry.date;
    const dateValue = entry.createdAt || entry.timestamp;
    if (!dateValue) return '—';
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
  };

  tbody.innerHTML = enquiries.map(e => `
    <tr class="fade-in-row">
      <td data-label="Date">
        <span class="date-chip">
          <i class="fa-regular fa-calendar"></i>
          ${formatDate(e)}
        </span>
      </td>
      <td data-label="Service">${e.service || e.subject || "General Enquiry"}</td>
      <td data-label="Status">${statusBadge(e.status)}</td>
    </tr>`).join("");
}

// ── Render Attendance Table ───────────────────────────────────
function renderAttendance(userId) {
  const tbody  = document.getElementById("attendanceTableBody");
  const records = getUserAttendance(userId);

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="4">
          <div class="empty-state small">
            <i class="fa-solid fa-calendar-xmark"></i>
            <p>No attendance records yet.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = records.map((r, i) => `
    <tr class="fade-in-row" style="animation-delay:${i * 0.04}s">
      <td data-label="Day">${r.dayOfWeek}</td>
      <td data-label="Date">
        <span class="date-chip"><i class="fa-regular fa-calendar"></i>${r.date}</span>
      </td>
      <td data-label="Time">
        <span class="time-chip"><i class="fa-regular fa-clock"></i>${r.time}</span>
      </td>
      <td data-label="Company">
        <span class="company-chip"><i class="fa-solid fa-building"></i>${r.companyName}</span>
      </td>
    </tr>`).join("");
}

// ── Stats Cards ───────────────────────────────────────────────
function renderStats(user, enquiries, attendance) {
  document.getElementById("statEnquiries").textContent  = enquiries.length;
  document.getElementById("statAttendance").textContent = attendance.length;
  document.getElementById("statPending").textContent    =
    enquiries.filter(e => (e.status || "pending").toLowerCase() === "pending").length;

  // Greeting
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const nameEl = document.getElementById("welcomeUser");
  if (nameEl) nameEl.textContent = `${greet}, ${user.name || user.email} 👋`;
}

// ── Toast Notification ────────────────────────────────────────
function showToast(msg, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type==="success"?"fa-circle-check":type==="warn"?"fa-triangle-exclamation":"fa-circle-info"}"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 400); }, 3500);
}

// ── Tab Switching ─────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

// ── Live Clock ────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById("liveClock");
  if (!el) return;
  const tick = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
  };
  tick();
  setInterval(tick, 1000);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const user = getCurrentUser();

  // ── Auth check ──
  if (!user) {
    window.location.href = "samarth.html";
    return;
  }

  // ── Display user info ──
  const userNameEl = document.getElementById("headerUserName");
  if (userNameEl) userNameEl.textContent = user.name || user.email;

  // ── Record attendance ──
  const isNew = recordAttendance(user);
  if (isNew) {
    showToast("✅ Attendance marked for today!", "success");
  }

  // ── Load data ──
  const token = localStorage.getItem('token');
  let enquiries = await fetchServerEnquiries(token);
  if (!Array.isArray(enquiries)) {
    enquiries = getUserEnquiries(user.id);
  }

  const attendance = getUserAttendance(user.id);

  renderStats(user, enquiries, attendance);
  renderEnquiries(user.id, enquiries);
  renderAttendance(user.id);
  initTabs();
  startClock();
});