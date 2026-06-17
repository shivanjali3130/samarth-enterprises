document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const errorBox = document.getElementById('errorBox');
    const btn = document.querySelector('.admin-btn');

    // Loading state
    btn.innerText = "Authenticating...";
    btn.disabled = true;
    errorBox.style.display = 'none';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        // Check if credentials are correct AND the user is an admin
        if (response.ok && data.role === 'admin') {
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            localStorage.setItem('userName', data.name);
            
            // Redirect to admin dashboard
            window.location.href = '/admin-dashboard.html';
        } else {
            // Show error if role is not admin or credentials fail
            errorBox.textContent = data.role !== 'admin' && response.ok 
                ? "Access Denied: You do not have admin privileges." 
                : (data.msg || "Invalid Admin Credentials");
            errorBox.style.display = 'block';
            btn.innerText = "Verify & Enter";
            btn.disabled = false;
        }
    } catch (err) {
        console.error('Login error:', err);
        errorBox.textContent = "Server connection failed. Please try again later.";
        errorBox.style.display = 'block';
        btn.innerText = "Verify & Enter";
        btn.disabled = false;
    }
});
