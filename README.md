# Course Nibo Bot 🎓

Premium Telegram Bot for selling digital courses & subscriptions with bKash/Nagad payment + Groq AI support.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your values
npm start
```

## Environment Variables

| Variable          | Required | Description                    |
|-------------------|----------|--------------------------------|
| BOT_TOKEN         | ✅       | From @BotFather                |
| ADMIN_ID          | ✅       | Your Telegram numeric ID       |
| BKASH_NUMBER      | ✅       | bKash Send Money number        |
| NAGAD_NUMBER      | ✅       | Nagad Send Money number        |
| SUPPORT_USERNAME  | ✅       | e.g. @Arif01563                |
| GROQ_API_KEY      | ❌       | Optional (AI replies)          |
| PORT              | ❌       | Default 3000                   |

## Deploy

Works perfectly on **Render**, Railway, or any Node.js host.
