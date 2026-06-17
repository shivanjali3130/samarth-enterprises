// Tab and Form Switching Logic
function showForm(event, formId) {
    if (event) {
        // Prevent default anchor behavior if called from a link
        const anchor = event.target.closest('a');
        if (anchor) event.preventDefault();
    }

    // 1. Hide all forms
    const forms = document.querySelectorAll('.auth-form');
    forms.forEach(form => form.classList.remove('active'));

    // 2. Deactivate all tab buttons
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => btn.classList.remove('active'));
    
    // 3. Show selected form
    const targetForm = document.getElementById(formId + 'Form');
    if (targetForm) {
        targetForm.classList.add('active');
    } else {
        console.warn('showForm: target form not found for', formId);
    }
    
    // 4. If the trigger was a top tab button, highlight it
    const button = event && (event.currentTarget || event.target.closest('.tab-btn'));
    if (button && button.classList.contains('tab-btn')) {
        button.classList.add('active');
    }
}

// Utility for showing messages
const msgBox = document.getElementById('messageBox');
function showMessage(text, color) {
    if (msgBox) {
        msgBox.style.display = 'block';
        msgBox.textContent = text;
        msgBox.style.color = color;
        // Auto-hide message after 5 seconds
        setTimeout(() => { msgBox.style.display = 'none'; }, 5000);
    }
}

// Attach auth portal events after DOM is ready
function initAuthPortal() {
    document.getElementById('userTabBtn').addEventListener('click', (e) => showForm(e, 'userLogin'));
    document.getElementById('adminTabBtn').addEventListener('click', (e) => showForm(e, 'adminLogin'));

    document.querySelectorAll('[data-show-form]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showForm(e, link.dataset.showForm);
        });
    });

    document.getElementById('userLoginForm').addEventListener('submit', (e) => handleLogin(e, 'user'));
    document.getElementById('adminLoginForm').addEventListener('submit', (e) => handleLogin(e, 'admin'));

    document.getElementById('userSignupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('uRegName').value,
            email: document.getElementById('uRegEmail').value,
            password: document.getElementById('uRegPass').value,
            role: 'user'
        };
        await handleRegistration(data, 'userLogin');
    });

    document.getElementById('adminSignupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('aRegName').value,
            email: document.getElementById('aRegEmail').value,
            password: document.getElementById('aRegPass').value,
            role: 'admin'
        };
        await handleRegistration(data, 'adminLogin');
    });

    checkAdminExists();
}

async function checkAdminExists() {
    try {
        const res = await fetch('/api/auth/admin-exists');
        const data = await res.json();
        if (res.ok && data.adminExists === false) {
            showMessage('No admin account exists yet. Please register an admin.', 'red');
            showForm(null, 'adminSignup');
        }
    } catch (err) {
        console.error('Admin exists check failed:', err);
    }
}

// Initialize auth portal when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthPortal);
} else {
    initAuthPortal();
}

// Helper for Registration
async function handleRegistration(data, successTargetForm) {
    try {
        const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});

        const result = await res.json();

        if (res.ok) {
            showMessage("Registration successful!", "green");
            setTimeout(() => showForm(null, successTargetForm), 2000);
        } else {
            // This shows the actual error from your server (like "Email already exists")
            showMessage(result.msg || "Registration failed", "red");
        }
    } catch (err) {
        // This triggers if the server is OFF
        showMessage("Connection error: Is your server.js running?", "red");
    }
}

// 3. Handle Logins (Admin and User)
async function handleLogin(e, role) {
    e.preventDefault();
    try {
        // Get form data
        const email = e.target.querySelector('input[type="email"]').value.trim().toLowerCase();
        const password = e.target.querySelector('input[type="password"]').value;
        
        const data = { email, password };
        
        console.log('🔐 Attempting login as', role);
        const res = await fetch('/api/auth/login', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (res.ok) {
            // Check if role matches
            if (result.role === role) {
                showMessage("Login successful! Redirecting...", "green");
                localStorage.setItem('token', result.token);
                localStorage.setItem('role', result.role);
                localStorage.setItem('email', result.email);
                localStorage.setItem('name', result.name);
                localStorage.setItem('userName', result.name);
                if (role === 'user') {
                    localStorage.setItem('samarth_session', JSON.stringify({
                        id: result.id,
                        name: result.name,
                        email: result.email
                    }));
                }

                setTimeout(() => {
                    if (role === 'admin') {
                        window.location.href = '/admin-dashboard.html';
                    } else {
                        window.location.href = '/my-enquiries.html';
                    }
                }, 1500);
            } else {
                showMessage(`You are not authorized as ${role}`, "red");
            }
        } else {
            showMessage(result.msg || "Login failed", "red");
        }
    } catch (err) {
        console.error('Login error:', err);
        showMessage("Connection error: Is the server still running?", "red");
    }
}

document.getElementById('userLoginForm').addEventListener('submit', (e) => handleLogin(e, 'user'));
document.getElementById('adminLoginForm').addEventListener('submit', (e) => handleLogin(e, 'admin'));