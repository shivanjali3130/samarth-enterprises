const http = require('http');

function post(path, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  try {
    console.log('Registering test user...');
    const reg = await post('/api/auth/register', { name: 'Test User', email: 'testuser@example.local', password: 'Password1' });
    console.log('Register response:', reg.status, reg.body);

    console.log('Logging in...');
    const log = await post('/api/auth/login', { email: 'testuser@example.local', password: 'Password1' });
    console.log('Login response:', log.status, log.body);

    // Try admin login if exists
    console.log('Attempting admin login (admin@test.local)');
    const alog = await post('/api/auth/login', { email: 'admin@test.local', password: 'Password1' });
    console.log('Admin login response:', alog.status, alog.body);
  } catch (err) {
    console.error('Test error:', err);
  }
})();
