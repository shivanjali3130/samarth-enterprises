# 🔒 Security Implementation Guide

## What Was Fixed

### 1. **Exposed Credentials** ✅
**Problem:** `.env` file with passwords was in the repository
**Solution:** 
- Created `.gitignore` to prevent `.env` from being committed
- Created `.env.example` with placeholder values
- **ACTION REQUIRED:** Never commit `.env` file to git!

### 2. **Restricted CORS** ✅
**Problem:** CORS allowed requests from any origin
**Solution:** 
- Updated to only allow `http://localhost:3000` (or set your domain)
- Modify `ALLOWED_ORIGIN` in `.env` for production

### 3. **Rate Limiting** ✅
**Problem:** No protection against spam/DDoS attacks
**Solution:** 
- Added rate limiter: Max 100 requests per 15 minutes per IP
- Returns 429 error when exceeded

### 4. **Input Validation & Sanitization** ✅
**Problem:** User inputs could contain XSS/injection attacks
**Solution:** 
- Validates email and phone format
- Sanitizes all inputs (removes HTML/JS characters)
- Limits input length (name: 100 chars, message: 1000 chars)

### 5. **API Authentication** ✅
**Problem:** Anyone could access all enquiries via `/api/enquiries`
**Solution:** 
- Now requires `X-API-Key` header
- Generate a strong API key in `.env`

### 6. **Security Headers** ✅
**Solution:** 
- Added HSTS (force HTTPS)
- Added X-Content-Type-Nosniff
- Added X-XSS-Protection
- Content Security Policy enabled

### 7. **Request Size Limit** ✅
**Solution:** 
- Limited JSON payloads to 10KB
- Prevents large file upload attacks

---

## How to Use in Production

### Step 1: Secure Your Environment
```bash
# Copy the example file
cp .env.example .env

# Edit with your real credentials
nano .env  # or use VS Code
```

### Step 2: Generate Credentials
```env
PORT=3000

# Your MongoDB connection
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# Your SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password

TO_EMAIL=contact@samarthenterprises.com

# Generate a strong API key (use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
API_KEY=your-very-long-random-string-here

# Your production domain
ALLOWED_ORIGIN=https://www.samarthenterprises.com
```

### Step 3: Fetch Enquiries Securely
To view submissions, use your API key:

```bash
curl -X GET http://localhost:3000/api/enquiries \
  -H "X-API-Key: your-api-key-here"
```

Or in JavaScript:
```javascript
const apiKey = "your-api-key-here";
fetch('/api/enquiries', {
  headers: { 'X-API-Key': apiKey }
})
.then(r => r.json())
.then(data => console.log(data));
```

---

## Additional Recommendations

### ✅ Already Implemented
- HTTPS headers (HSTS, X-XSS-Protection, X-Content-Type-Nosniff)
- Content Security Policy
- Rate limiting
- Input sanitization
- API authentication

### 🔧 For Future Enhancement
1. **Add HTTPS certificate** - Use Let's Encrypt with Node.js
2. **Database backup** - Regular MongoDB backups
3. **Logging & Monitoring** - Log all API requests
4. **Email verification** - Verify user emails before submission
5. **Admin dashboard** - Password-protected admin panel to view enquiries
6. **WAF** - Use Cloudflare or similar for DDoS protection

---

## Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] `.env` is NOT committed to git
- [ ] Strong `API_KEY` is generated
- [ ] `ALLOWED_ORIGIN` is set to your domain
- [ ] Database credentials are strong
- [ ] SMTP password is an app-specific password (not main password)
- [ ] Server is running (test with: `curl http://localhost:3000`)
- [ ] Rate limiting works (make 101 requests, should get 429 error)

---

## Testing Security

### Test Rate Limiting
```bash
for i in {1..101}; do curl http://localhost:3000/api/enquiry -X POST -H "Content-Type: application/json" -d '{"name":"Test","email":"test@test.com","phone":"1234567890"}'; done
```

### Test Input Sanitization
```bash
curl http://localhost:3000/api/enquiry -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "name":"<script>alert(1)</script>",
    "email":"test@test.com",
    "phone":"1234567890"
  }'
```

### Test API Key Authentication
```bash
# Without API key (should fail)
curl http://localhost:3000/api/enquiries

# With API key (should work)
curl http://localhost:3000/api/enquiries \
  -H "X-API-Key: your-api-key"
```

---

## Deployment Checklist

Before going to production:
1. Set `NODE_ENV=production`
2. Use a process manager (PM2, systemd, Docker)
3. Use reverse proxy (Nginx, Apache)
4. Enable SSL/HTTPS
5. Set up monitoring and alerts
6. Regular security updates for dependencies
7. Review logs for suspicious activity

