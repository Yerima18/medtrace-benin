# MedTrace Benin

A QR code-based medicine traceability system to combat counterfeit drugs in Benin and West Africa.

## Features

- **QR code generation** — distributors register medicine batches and get unique per-unit QR codes
- **Instant verification** — anyone can scan a QR code to verify authenticity
- **Fraud detection** — multiple patient scans of the same code are flagged automatically
- **Supply chain tracking** — shipment status flows from distributor → pharmacy → patient
- **Role-based access** — admin, distributor, pharmacy, and patient roles
- **AI security insights** — Gemini-powered analysis of suspicious scan patterns (admin)
- **Admin user management** — activate/deactivate accounts
- **CSV export** — download QR code lists as CSV

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (better-sqlite3) with versioned migrations |
| Auth | JWT via httpOnly cookies + bcrypt |
| Validation | Zod |
| Security | helmet, express-rate-limit, CORS |
| AI | Google Gemini (optional) |
| Testing | Vitest + supertest |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set a strong JWT_SECRET and admin credentials

# 3. Start development server
npm run dev
```

The app runs at `http://localhost:3000`.

The default admin account is created from `.env` values on first run.

### Running Tests

```bash
npm test
```

### Production Build

```bash
npm run build
NODE_ENV=production npm start
```

### Docker

```bash
# Build and run with docker-compose
cp .env.example .env
# Edit .env with production values
docker-compose up -d
```

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `JWT_SECRET` | Secret for signing JWT tokens (use a long random string) | Yes |
| `ADMIN_EMAIL` | Admin account email (seeded on first run) | Yes |
| `ADMIN_PASSWORD` | Admin account password | Yes |
| `GEMINI_API_KEY` | Google Gemini API key (enables AI insights) | No |
| `DB_PATH` | SQLite database file path | No (default: `medtrace.db`) |
| `PORT` | HTTP port | No (default: `3000`) |

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login (sets httpOnly cookie) |
| `POST` | `/api/auth/logout` | Logout (clears cookie) |
| `GET`  | `/api/auth/me` | Get current user |
| `POST` | `/api/auth/forgot-password` | Request password reset |
| `POST` | `/api/auth/reset-password` | Reset password with token |

### Medicines
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/api/medicines` | Any | List all medicines |
| `POST` | `/api/medicines/register` | Distributor/Admin | Register batch + generate QR codes |
| `GET`  | `/api/medicines/batch/:id/qrcodes` | Distributor/Admin | Get QR codes for batch |
| `GET`  | `/api/medicines/batch/:id/qrcodes/export` | Distributor/Admin | Download QR codes as CSV |
| `POST` | `/api/medicines/batch/:id/ship` | Distributor/Admin | Mark batch as shipped to pharmacy |
| `POST` | `/api/medicines/batch/:id/receive` | Pharmacy/Admin | Confirm receipt of batch |

### Verification
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/scans/verify` | Public | Verify a QR code |

### Dashboard
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/dashboard/stats` | Admin | System-wide statistics |
| `GET` | `/api/dashboard/distributor-stats` | Distributor | Distributor statistics |
| `GET` | `/api/dashboard/pharmacy-stats` | Pharmacy | Pharmacy statistics |
| `POST` | `/api/dashboard/alerts/:id/resolve` | Admin | Mark alert as resolved |

### Admin
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/users` | Admin | List all users |
| `PATCH` | `/api/admin/users/:id/status` | Admin | Activate/deactivate user |
| `GET` | `/api/admin/scan-logs` | Admin | View scan audit log |
| `GET` | `/api/admin/ai-insights` | Admin | AI-powered security analysis |

## User Roles

| Role | Capabilities |
|---|---|
| **admin** | Full access: users, medicines, dashboard, AI insights |
| **distributor** | Register batches, generate/export QR codes, ship to pharmacies |
| **pharmacy** | Confirm receipts, scan medicines, view pharmacy stats |
| **patient** | Scan QR codes to verify medicines |

## License

MIT
