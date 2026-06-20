const app = require('./api/index');
const http = require('http');
const server = http.createServer(app);
server.listen(5001, async () => {
  try {
    const res = await fetch('http://127.0.0.1:5001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name:'Test User', email:'testuser@example.com', password:'password123', role:'user' })
    });
    console.log('status', res.status);
    console.log('body', await res.text());
  } catch (err) {
    console.error('fetch error', err);
  } finally {
    server.close();
  }
});
