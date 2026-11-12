# 🎭 `emous` — Hyperlocal Anonymous Visual Feed & Viral Inbox (Web + Mobile + Unified API)

`emous` is a hybrid web and mobile anonymous community ecosystem built with a bold urban streetwear event-flyer aesthetic (`#0D0D11` Off-Black, `#FF1E8E` Neon Pink, `#CCFF00` Acid Lime, `#FFE600` Electric Yellow).

## 🏛️ Monorepo Architecture

| Workspace | Tech Stack | Role |
| :--- | :--- | :--- |
| [`/shared`](./shared/index.ts) | TypeScript | Shared design tokens, curated gradients, Unsplash streetwear photo pack, Adjective-Noun handle generator, and DTO types. |
| [`/server`](./server/src/index.ts) | Node.js + Express + Mongoose | Unified REST API (`/api/v1`) serving both Web and Mobile. Includes MongoDB `2dsphere` `$near` (5-mile radius) queries, 30-day TTL inbox auto-burn (`expireAfterSeconds: 2592000`), 3-flag crowdsourced auto-hide, and an automatic zero-config local persistence engine when `MONGODB_URI` is not set. |
| [`/web`](./web/src/app/page.tsx) | Next.js (App Router) + Tailwind CSS | **Screen 3** Viral Receiver Landing Page (`/ask/[handle]`) with confetti & emoji explosion, Sticky Growth Loop footer, plus Web Visual Feed, Inbox Dashboard, and HTML5 Canvas 9:16 Story PNG Generator. |
| [`/mobile`](./mobile/App.tsx) | Expo (React Native) | **Screens 1, 2 & 4** Mobile App with Global/Near Me (5-mile GPS via `expo-location`), 🎲 Card Shuffler, 1-Tap Copy Link Dashboard, and `react-native-view-shot` 9:16 IG/Snapchat Story Share Generator. |

---

## 🚀 Quick Start

### 1. Start the Unified Backend API (`http://localhost:4000`)
```bash
cd server
npm install
npm run test:api   # Runs automated verification of all 7 MVP features
npm run dev        # Starts the API server on port 4000
```

### 2. Start the Next.js Web App (`http://localhost:3000`)
```bash
cd web
npm install
npm run dev
```
- **Home Feed & Inbox Dashboard**: `http://localhost:3000`
- **Viral Web Receiver Landing Page**: `http://localhost:3000/ask/GoldenWizard`

### 3. Start the Expo React Native Mobile App
```bash
cd mobile
npm install
npx expo start
```
