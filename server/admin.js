// ══════════════════════════════════════════════
// admin.js  —  Admin Dashboard Logic
// ══════════════════════════════════════════════

const token    = localStorage.getItem('token');
const role     = localStorage.getItem('role');
const userName = localStorage.getItem('userName') || 'Admin';
const API_BASE  = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'http://localhost:3000';

// ── Guard: must be logged in as admin ─────────
if (!token || role !== 'admin') {
  window.location.href = 'auth-portal.html';
}

// ── Show admin name in header + body ──────────
document.addEventListener('DOMContentLoaded', () => {
  const headerEl = document.getElementById('adminNameHeader');
  const bodyEl   = document.getElementById('adminNameBody');
  if (headerEl) headerEl.textContent = userName;
  if (bodyEl)   bodyEl.textContent   = userName;

  // Header scroll shadow
  const header = document.getElementById('siteHeader');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });
  }

  // Logout link in nav
  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink) {
    logoutLink.addEventListener('click', e => {
      e.preventDefault();
      logout();
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
    });
  }

  // Setup Event Listeners for Modals
  setupModalListeners();

  // Initial Data Loads
  fetchAllEnquiries();
  loadStats();
  fetchLabourRecords();
});

// ══════════════════════════════════════════════
// MODAL CONTROLS
// ══════════════════════════════════════════════
function setupModalListeners() {
  // Lead Modal
  const openLeadBtn = document.getElementById('openLeadModalBtn');
  const closeLeadBtn = document.getElementById('closeLeadModalBtn');
  const leadModal = document.getElementById('leadModal');
  const leadForm = document.getElementById('addLeadForm');

  if(openLeadBtn && leadModal) openLeadBtn.onclick = () => leadModal.style.display = 'flex';
  if(closeLeadBtn && leadModal) closeLeadBtn.onclick = () => leadModal.style.display = 'none';

  if(leadForm) {
    leadForm.onsubmit = async (e) => {
      e.preventDefault();
      await createNewLead();
    };
  }

  // Labour Modal
  const openLabourBtn = document.getElementById('openLabourModalBtn');
  const closeLabourBtn = document.getElementById('closeLabourModalBtn');
  const labourModal = document.getElementById('labourModal');
  const labourForm = document.getElementById('addLabourForm');

  if(openLabourBtn && labourModal) openLabourBtn.onclick = () => labourModal.style.display = 'flex';
  if(closeLabourBtn && labourModal) closeLabourBtn.onclick = () => labourModal.style.display = 'none';

  if(labourForm) {
    labourForm.onsubmit = async (e) => {
      e.preventDefault();
      await createLabourRecord();
    };
  }

  // Close modals when clicking outside content area
  window.onclick = (e) => {
    if (e.target === leadModal) leadModal.style.display = 'none';
    if (e.target === labourModal) labourModal.style.display = 'none';
  };
}

// ══════════════════════════════════════════════
// FETCH & RENDER ENQUIRIES
// ══════════════════════════════════════════════
async function fetchAllEnquiries() {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="loading-cell">
        <i class="fa-solid fa-spinner fa-spin"></i> Loading enquiries…
      </td>
    </tr>`;

  try {
    console.log('📥 Fetching enquiries with token:', token ? 'present' : 'missing');
    const res = await fetch(`${API_BASE}/api/admin/all-enquiries`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('📊 Response status:', res.status);

    if (res.status === 401 || res.status === 403) {
      console.error('❌ Auth failed - redirecting to login');
      localStorage.clear();
      window.location.href = 'auth-portal.html';
      return;
    }

    const data = await res.json();
    console.log('📋 Enquiries received:', data);
    const enquiries = data.enquiries || [];

    const countEl = document.getElementById('enquiryCount');
    if (countEl) countEl.textContent = enquiries.length;

    if (enquiries.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="loading-cell">
            <i class="fa-solid fa-inbox" style="color:#2f3bb6"></i> No enquiries yet.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = enquiries.map(item => {
      const timestamp = item.createdAt || item.timestamp;
      const date = timestamp ? new Date(timestamp).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      const status  = item.status || 'New';
      const message = escHtml(item.message || '—');

      return `
        <tr data-id="${item._id}">
          <td style="white-space:nowrap;color:#6b7280">${date}</td>
          <td>
            <div class="client-name">${escHtml(item.name)}</div>
            <div class="client-email">${escHtml(item.email || '—')}</div>
          </td>
          <td><span class="svc-tag">${escHtml(item.service || '—')}</span></td>
          <td style="white-space:nowrap; font-weight: 600;">${escHtml(item.phone)}</td>
          <td style="color:#6b7280">${escHtml(item.location || '—')}</td>
          <td class="msg-cell" title="${message}">${message}</td>
          <td>
            <select class="status-sel" data-id="${item._id}" data-status="${status}">
              <option ${status === 'New'         ? 'selected' : ''}>New</option>
              <option ${status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option ${status === 'Resolved'    ? 'selected' : ''}>Resolved</option>
              <option ${status === 'Cancelled'   ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td>
            <button class="del-btn" data-id="${item._id}">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </td>
        </tr>`;
    }).join('');

    // Attach event listeners to the delete buttons and status selects
    document.querySelectorAll('#adminTableBody .del-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteEnquiry(btn.dataset.id, btn));
    });

    document.querySelectorAll('#adminTableBody .status-sel').forEach(sel => {
      sel.addEventListener('change', () => updateStatus(sel.dataset.id, sel));
    });

  } catch (err) {
    console.error('Admin fetch error:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="loading-cell" style="color:#e74c3c">
          <i class="fa-solid fa-circle-exclamation"></i> Failed to load enquiries.
        </td>
      </tr>`;
  }
}

// ══════════════════════════════════════════════
// CREATE NEW LEAD (POST)
// ══════════════════════════════════════════════
async function createNewLead() {
  const name = document.getElementById('leadName').value.trim();
  const email = document.getElementById('leadEmail').value.trim();
  const phone = document.getElementById('leadPhone').value.trim();
  const service = document.getElementById('leadService').value;
  const location = document.getElementById('leadLocation').value.trim();
  const message = document.getElementById('leadMessage').value.trim();

  // Validate required fields
  if (!name || !phone || !email) {
    showToast('Name, Email, and Phone are required!', 'error');
    return;
  }

  try {
    console.log('📝 Creating new lead:', { name, email, phone, service, location, message });
    
    // Use the public enquiry endpoint - it will be linked to admin by email lookup
    const res = await fetch(`${API_BASE}/api/enquiry`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, service, location, message })
    });

    console.log('📊 Enquiry response status:', res.status);
    const result = await res.json();
    console.log('📋 Enquiry result:', result);

    if(!res.ok) throw new Error(result.error || result.msg || 'Failed to create lead');

    showToast('✅ New Lead added successfully!', 'success');
    document.getElementById('addLeadForm').reset();
    document.getElementById('leadModal').style.display = 'none';
    
    fetchAllEnquiries();
    loadStats();
  } catch (err) {
    console.error('❌ Enquiry creation error:', err);
    showToast(`Failed to add lead: ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════════
// LABOUR DATA OPERATIONS
// ══════════════════════════════════════════════
function normalizePhone(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

async function createLabourRecord() {
  const name = document.getElementById('labourName').value.trim();
  const phone = normalizePhone(document.getElementById('labourPhone').value);
  const role  = document.getElementById('labourRole').value.trim();
  const city  = document.getElementById('labourCity').value.trim();

  if (!name || !phone || !role || !city) {
    showToast('Please fill in all worker details.', 'error');
    return;
  }

  const duplicatePhone = Array.from(document.querySelectorAll('#labourTableBody tr[data-labour-id]'))
    .some(row => normalizePhone(row.children[1]?.textContent) === phone);

  if (duplicatePhone) {
    showToast('This mobile number already exists.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/labour`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, phone, role, city })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || result.msg || 'Failed to save worker');

    showToast('✅ Worker saved successfully.', 'success');
    document.getElementById('addLabourForm').reset();
    document.getElementById('labourModal').style.display = 'none';
    fetchLabourRecords();
  } catch (err) {
    console.error('Labour create error:', err);
    if (err.message.includes('401') || err.message.includes('403')) {
      localStorage.clear();
      window.location.href = 'auth-portal.html';
      return;
    }
    showToast(`Failed to save worker: ${err.message}`, 'error');
  }
}

async function fetchLabourRecords() {
  const tbody = document.getElementById('labourTableBody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="loading-cell">
        <i class="fa-solid fa-spinner fa-spin"></i> Loading workers…
      </td>
    </tr>`;

  try {
    const res = await fetch(`${API_BASE}/api/admin/all-labour`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      window.location.href = 'auth-portal.html';
      return;
    }

    const data = await res.json();
    const labour = data.labour || [];
    if (labour.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-cell">No workers registered yet. Click "Add Labour Info".</td></tr>`;
      return;
    }

    tbody.innerHTML = labour.map(item => {
      return `
        <tr data-labour-id="${item._id}">
          <td>${escHtml(item.name)}</td>
          <td>${escHtml(item.phone)}</td>
          <td>${escHtml(item.role)}</td>
          <td>${escHtml(item.city)}</td>
          <td>
            <button class="del-btn labour-del-btn" data-id="${item._id}">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </td>
        </tr>`;
    }).join('');

    document.querySelectorAll('#labourTableBody .labour-del-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteLabour(btn.dataset.id, btn));
    });
  } catch (err) {
    console.error('Labour fetch error:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="loading-cell" style="color:#e74c3c">Failed to load labour records.</td></tr>`;
  }
}

async function deleteLabour(id, btn) {
  if (!confirm('Delete this labour record? This cannot be undone.')) return;

  btn.disabled = true;
  btn.textContent = 'Deleting…';

  try {
    const res = await fetch(`${API_BASE}/api/admin/labour/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.error || result.msg || 'Delete failed');
    }

    const row = document.querySelector(`tr[data-labour-id="${id}"]`);
    if (row) row.remove();

    const remaining = document.querySelectorAll('#labourTableBody tr[data-labour-id]').length;
    if (remaining === 0) {
      const tbody = document.getElementById('labourTableBody');
      tbody.innerHTML = `<tr><td colspan="5" class="loading-cell">No workers registered yet. Click "Add Labour Info".</td></tr>`;
    }

    showToast('Labour record deleted.', 'success');
  } catch (err) {
    console.error('Labour delete error:', err);
    showToast('Failed to delete worker.', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
  }
}

// ══════════════════════════════════════════════
// LOAD STAT CARDS
// ══════════════════════════════════════════════
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const { stats } = await res.json();

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val ?? '—';
    };

    set('statTotal',    stats.total);
    set('statNew',      stats.new);
    set('statInProg',   stats.inProgress);
    set('statResolved', stats.resolved);

  } catch { /* silently ignore optional stat errors */ }
}

// ══════════════════════════════════════════════
// UPDATE STATUS
// ══════════════════════════════════════════════
async function updateStatus(id, selectEl) {
  const status = selectEl.value;
  selectEl.dataset.status = status;

  try {
    const res = await fetch(`${API_BASE}/api/admin/enquiries/${id}/status`, {
      method:  'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });

    if (!res.ok) throw new Error('Server rejected update');
    showToast(`Status updated to "${status}"`, 'success');
    loadStats();

  } catch (err) {
    console.error('Status update error:', err);
    showToast('Failed to update status.', 'error');
  }
}

// ══════════════════════════════════════════════
// DELETE ENQUIRY
// ══════════════════════════════════════════════
async function deleteEnquiry(id, btn) {
  if (!confirm('Delete this enquiry? This cannot be undone.')) return;

  btn.disabled    = true;
  btn.textContent = 'Deleting…';

  try {
    const res = await fetch(`${API_BASE}/api/admin/enquiries/${id}`, {
      method:  'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Delete failed');

    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) row.remove();

    const countEl   = document.getElementById('enquiryCount');
    const remaining = document.querySelectorAll('#adminTableBody tr[data-id]').length;
    if (countEl) countEl.textContent = remaining;

    showToast('Enquiry deleted.', 'success');
    loadStats();

  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete. Please try again.', 'error');
    btn.disabled    = false;
    btn.innerHTML   = '<i class="fa-solid fa-trash"></i> Delete';
  }
}

// ══════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════
function logout() {
  localStorage.clear();
  window.location.href = 'auth-portal.html';
}

// ══════════════════════════════════════════════
// TOAST NOTIFICATION
// ══════════════════════════════════════════════
let toastTimer = null;
function showToast(msg, type = 'info') {
  let toast = document.getElementById('adminToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'adminToast';
    document.body.appendChild(toast);
  }

  const colors = {
    success: '#0a9e6a',
    error:   '#e74c3c',
    info:    '#2f3bb6'
  };

  toast.textContent      = msg;
  toast.style.background = colors[type] || colors.info;
  toast.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ══════════════════════════════════════════════
// ESCAPE HTML (prevent XSS)
// ══════════════════════════════════════════════
function escHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}