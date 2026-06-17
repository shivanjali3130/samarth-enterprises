document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const errorBox = document.getElementById('errorBox');
    const loginBtn = document.querySelector('.login-btn');

    // Loading state
    loginBtn.innerText = "Verifying...";
    loginBtn.disabled = true;
    errorBox.style.display = 'none';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Save token and user info to LocalStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            localStorage.setItem('userName', data.name);

            // Redirect based on the role received from backend
            if (data.role === 'admin') {
                window.location.href = '/admin-dashboard.html';
            } else {
                window.location.href = '/my-enquiries.html';
            }
        } else {
            errorBox.textContent = data.msg || 'Invalid email or password';
            errorBox.style.display = 'block';
            loginBtn.innerText = "Login Now";
            loginBtn.disabled = false;
        }
    } catch (err) {
        console.error('Login error:', err);
        errorBox.textContent = 'Connection error. Please check your server.';
        errorBox.style.display = 'block';
        loginBtn.innerText = "Login Now";
        loginBtn.disabled = false;
    }
});