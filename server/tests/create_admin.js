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
    console.log('Registering admin...');
    const reg = await post('/api/auth/register', { name: 'Admin User', email: 'admin@example.local', password: 'AdminPass1', role: 'admin' });
    console.log('Register response:', reg.status, reg.body);

    console.log('Logging in as admin...');
    const log = await post('/api/auth/login', { email: 'admin@example.local', password: 'AdminPass1' });
    console.log('Login response:', log.status, log.body);
  } catch (err) {
    console.error('Error:', err);
  }
})();
