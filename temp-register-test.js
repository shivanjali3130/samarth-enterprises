const app = require('./api/index');
const http = require('http');
const server = http.createServer(app);
server.listen(0, () => {
  const port = server.address().port;
  console.log('listening on', port);
  const data = JSON.stringify({ name: 'Test User', email: 'testuser@example.com', password: 'password123', role: 'user' });
  const options = {
    hostname: '127.0.0.1',
    port,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };
  const req = http.request(options, res => {
    console.log('status', res.statusCode, res.statusMessage);
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('body', body);
      server.close();
    });
  });
  req.on('error', err => {
    console.error('request error', err);
    server.close();
  });
  req.write(data);
  req.end();
});
