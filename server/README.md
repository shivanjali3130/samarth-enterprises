Samarth Enquiries Server

This is a simple Express server to receive enquiries from the website, save them to `enquiries.json`, and optionally send an email notification via SMTP.

Setup

1. Install dependencies:

```powershell
cd "c:\Users\walke\OneDrive\Desktop\samarth enterprises\server"
npm install
```

2. (Optional) Configure SMTP — copy `.env.example` to `.env` and fill the SMTP_* and TO_EMAIL values.

4. Admin registration secret

	- To prevent unauthorized admin accounts, set an `ADMIN_SECRET` environment variable (or add it to your `.env`). The server will reject any registration that requests role `admin` unless the correct secret is provided.

	Example `.env` entries:

	```
	JWT_SECRET=your_jwt_secret_here
	ADMIN_SECRET=some_strong_secret_here
	```

3. Start the server:

```powershell
node server.js
```

The server listens on port `3000` by default. It exposes:
- POST `/api/enquiry` — accept JSON { name, phone, email, service, message }
- GET `/api/enquiries` — returns saved enquiries JSON

Notes
- `enquiries.json` is created in the `server` folder and stores submissions.
- If SMTP variables are set, the server will attempt to send an email on each submission.
