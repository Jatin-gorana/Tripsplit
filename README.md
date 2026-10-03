# TripSplit ✈️💸

Minimalistic, mobile-first Progressive Web App (PWA) for friends to track shared trip expenses and see in real time who has paid more and who should pay next.

---

## 🌟 Features

- **Real-Time Balance & Next-to-Pay**: Automatically tracks member spending, fair shares, and highlights who is next to pay.
- **Voice Expense Input**: Built-in Speech Recognition (`en-IN` & `hi-IN` toggle) using Web Speech API with transcript parsing for amount, category, and members. Always presents pre-filled form confirmation.
- **PWA & Offline App Shell**: Service worker caches static app shell so the app loads offline. Clear offline status banner disables write actions when disconnected.
- **Optimal Settle-Up**: Greedy algorithm matching debtors and creditors to give the minimum number of cash transfers.
- **Guest Members & Link Claiming**: Supports guest members added by name, with seamless invite links (`/join/CODE`) to claim profiles.
- **Single Service Monorepo**: Express serves built React PWA client from `/client/dist` for seamless one-click cloud deployment.

---

## 🛠️ Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + React Router + `vite-plugin-pwa`
- **Backend**: Node.js + Express, plain SQL (`pg` package, no ORM)
- **Database**: Neon PostgreSQL via `DATABASE_URL` (pooled connection, SSL required)
- **Auth**: Email & password with `bcryptjs` and 7-day JWT (`jsonwebtoken`)
- **Validation**: `zod` schema validation on all API requests

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- Free Neon PostgreSQL Database instance ([neon.tech](https://neon.tech))

### 2. Environment Variables
Create a `.env` file in the root directory (refer to `.env.example`):

```env
DATABASE_URL=postgresql://user:password@ep-example-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=super-secret-jwt-key-change-in-production
PORT=5000
```

### 3. Initialize Database Schema
Run the initialization script to apply `schema.sql`:

```bash
npm run db:init
```

### 4. Seed Demo Data
Seed a sample trip ("Goa Beach Vacation"), 4 members, and 8 sample expenses:

```bash
npm run seed
```

**Demo Login Credentials:**
- **Email:** `demo@tripsplit.app`
- **Password:** `password123`
- **Invite Code:** `GOA123`

---

## 💻 Local Development & Testing

Run unit tests for core math & settle-up logic:
```bash
npm run test
```

Start both Express backend and Vite frontend concurrently:
```bash
npm run dev
```
- Frontend: `http://localhost:3000`
- API Backend: `http://localhost:5000`

---

## 📦 Production Build & Cloud Deployment

Build the frontend client:
```bash
npm run build
```

Start the unified server in production:
```bash
npm run start
```

Express will serve API routes under `/api/*` and static React PWA assets from `/client/dist/*` with SPA fallback routing.

### Deploying to Render / Railway
1. Push repository to GitHub.
2. Create a Web Service on Render or Railway.
3. Set Build Command: `npm install && npm run build`
4. Set Start Command: `npm run start`
5. Configure Environment Variables (`DATABASE_URL`, `JWT_SECRET`, `PORT`).
