# Installation Guide

Follow these steps to configure the AI Placement Assistant on your local development environment.

---

## 1. Prerequisites
- **Node.js**: Version 18.x or 20.x installed.
- **PostgreSQL**: Local database instance running or Supabase cloud postgres credentials.
- **Telegram Bot**: API Token from `@BotFather` and Chat ID from `@userinfobot` (if notifications are enabled).

---

## 2. Setup Procedure

### Clone and install dependencies
```bash
git clone https://github.com/user/placement-assistant.git
cd placement-assistant
npm install
```

### Environment variables configuration
Copy `.env.example` to `.env` and fill in database parameters:
```bash
cp .env.example .env
```

```ini
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://postgres:password@localhost:5432/placement_assistant
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### Run migrations
Execute standard migrations script initializing tables:
```bash
npm run migrate # Runs migrations schema
```

---

## 3. Launching

### Development mode
Launches development monitor reload:
```bash
npm run dev
```

### Production mode
Launches production runner:
```bash
npm start
```

---

## 4. Run Verification Tests
Verify configurations and connection checks by running the test suite:
```bash
npm test
```
