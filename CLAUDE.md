# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Express 5 + TypeScript REST API for the Write Nest English learning platform. Uses Prisma ORM with PostgreSQL and Google Gemini for AI content generation and grading.

## Commands

```bash
npm run dev                   # nodemon on port 3010
npm run build                 # tsc compile
npm start                     # run compiled JS

npx prisma migrate dev        # apply schema changes + generate client
npx prisma generate           # generate client only (no migration)
npx prisma studio             # visual DB browser
npx prisma migrate status     # check migration state
```

## Environment Variables (`.env`)

```
DATABASE_URL="postgresql://english_user:dev_password_123@localhost:5433/english_learning_dev"
JWT_SECRET="..."
GEMINI_API_KEY="..."
PORT=3010
NODE_ENV=development
```

## Architecture

### Middleware Stack (`src/index.ts`)

Applied in order:
1. `trust proxy` — required for Cloud Run IP detection
2. CORS whitelist: `localhost:5173`, `localhost:5174`, `writenest.net`, Firebase hosting URLs
3. JSON body parser
4. `logger` — logs method, URL, sanitized body (redacts `password`/`token`), response status + duration
5. `generalLimiter` (100 req/15min) applied globally

Route-specific limiters applied at mount:
- `/content` + `contentLimiter` (10 req/hour)

`authLimiter` (5 req/15min) is applied per-route inside `routes/auth.ts` on `POST /register`, `POST /login`, `POST /admin/login`, and `POST /resend-verification`. Other auth routes (`verify-email`, `refresh`, `logout`) use only the `generalLimiter`.

### File Map

```
src/
├── index.ts                   # App setup + route registration
├── routes/
│   ├── auth.ts                # Register, login, admin login
│   ├── content.ts             # Essay/reading generation, explain
│   ├── submit.ts              # Essay grading, reading scoring
│   ├── user.ts                # Profile, history, search, dashboard, privacy
│   └── admin.ts               # User CRUD, password reset, usage limits
├── middleware/
│   ├── auth.ts                # JWT verification → req.user
│   ├── requireAdmin.ts        # Role check (use after auth)
│   ├── rateLimit.ts           # Three-tier rate limiters
│   └── logger.ts              # Request/response logger
├── services/
│   └── gemini.ts              # Gemini API wrapper
└── utils/
    ├── prisma.ts              # Singleton PrismaClient
    ├── limit.ts               # Atomic usage limit check + decrement
    └── topicGenerator.ts      # Topic variety management
```

### Auth Middleware (`src/middleware/auth.ts`)

```typescript
interface AuthRequest extends Request {
  user?: { userId: string; role: string }
}
```

Extracts `Authorization: Bearer <token>`, verifies with `JWT_SECRET`, attaches `req.user`. Returns 401 (missing) or 403 (invalid).

Protected routes: `authenticateToken` middleware applied per-router.
Admin routes: additionally apply `requireAdmin` which checks `req.user.role === 'admin'`.

### Gemini Service (`src/services/gemini.ts`)

Model: `gemini-2.5-flash-preview`

Two methods:
- `generateContent(prompt, level?, temperature)` — returns plain text
- `generateJSON(prompt, level?, temperature)` — strips markdown code fences, parses JSON

Both append grade-level guidance if `level` provided. Error mapping:
- `RESOURCE_EXHAUSTED` → `API_RATE_LIMIT` error
- `PERMISSION_DENIED` → `API_AUTH_ERROR`
- `INVALID_ARGUMENT` → `API_INVALID_REQUEST`

Default generation params: `topK: 40`, `topP: 0.95`. Temperature varies by use case:
- Topic generation: `1.3` (high variety)
- Essay grading / reading questions: `1.0` (balanced)

### Usage Limits (`src/utils/limit.ts`)

`checkAndDecrementLimit(userId, type)`:
- Wraps in Prisma transaction (atomic read + write)
- Creates limit record if missing (default: 1 attempt)
- `-1` = unlimited (always returns `true`, no decrement)
- Returns `false` if `remainingAttempts === 0`

Always call this before AI generation in `content.ts` routes. Decremented again in `submit.ts` — design intentional: generation and submission each cost one attempt.

> **Note:** Actually re-read `submit.ts` to confirm decrement happens there vs. only in `content.ts` — the pattern may have changed.

### Topic Generator (`src/utils/topicGenerator.ts`)

- 100 topics across 10 categories (10 each)
- 8 writing styles, 8 perspectives
- `selectRandomTopic(userId)` fetches last 20 used topics, avoids repeating categories
- `saveRecentTopic(userId, category, topic)` — non-blocking fire-and-forget
- `cleanupOldTopics()` — deletes records older than 30 days

### Database Schema

**Key models:**

`User` — `id` (UUID), `email` (unique), `password` (hashed), `nickname`, `avatar`, `role` (default `"user"`), `difficultyLevel` (default `"7th"`, range `"7th"`–`"12th"`), `isActive`

`UsageLimit` — `userId + testType` unique constraint. `remainingAttempts`: `-1` = unlimited, `0` = exhausted, `>0` = remaining. Types: `"essay"` | `"reading"`

`TestRecord` — `type` (`"essay"` | `"reading"`), `content` (article text), `questions` (JSON string, reading only), `answers` (JSON string), `score` (float), `feedback` (essay AI feedback)

`RecentTopic` — indexed on `(userId, createdAt)` for efficient recent-topic lookups

`UserPrivacySettings` — `dashboardVisibility` + `activitiesVisibility`: `"private"` (default) | `"public"`

### Route Reference

**Auth (`/auth`)**
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | — | Creates user + initial limits (1 essay, 1 reading) |
| POST | `/auth/login` | — | Returns JWT (24h) |
| POST | `/auth/admin/login` | — | Checks `role === 'admin'` + `isActive` |

**Content (`/content`)** — all require `authenticateToken`
| Method | Path | Notes |
|--------|------|-------|
| POST | `/content/essay/generate` | Checks limits, uses topic generator, temp=1.3 |
| POST | `/content/reading/generate` | Checks limits, returns `{article, questions[]}` |
| POST | `/content/explain` | Explains text; default lang: Chinese |

**Submit (`/submit`)** — all require `authenticateToken`
| Method | Path | Notes |
|--------|------|-------|
| POST | `/submit/essay` | Grades with Gemini (1.0–10.0), stores TestRecord |
| POST | `/submit/reading` | Scores answers, stores TestRecord |

**User (`/user`)** — all require `authenticateToken`
| Method | Path | Notes |
|--------|------|-------|
| GET | `/user/profile` | Stats + limits + last 10 TestRecords |
| PUT | `/user/settings` | nickname, avatar, difficultyLevel |
| GET | `/user/history` | All TestRecords |
| GET | `/user/search?q=` | Case-insensitive, max 20 results |
| GET | `/user/:userId/dashboard` | Public stats (403 if private) |
| GET | `/user/:userId/activities` | Paginated activities (respects privacy) |
| GET | `/user/privacy-settings` | Current user's privacy config |
| PUT | `/user/privacy-settings` | dashboardVisibility, activitiesVisibility |

**Admin (`/admin`)** — require `authenticateToken` + `requireAdmin`
| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/users` | All users with test/limit counts |
| GET | `/admin/users/:id` | Single user detail |
| PUT | `/admin/users/:id` | email, nickname, role, isActive |
| PUT | `/admin/users/:id/password` | Min 6 chars, bcrypt hash |
| GET | `/admin/users/:id/limits` | Usage limits |
| PUT | `/admin/users/:id/limits` | Array of `{testType, remainingAttempts}` |

### Error Response Conventions

- `400` — validation errors, bad input
- `401` — missing/invalid token, unauthenticated
- `403` — wrong role, private resource, account inactive
- `404` — resource not found
- `409` — email already exists (register/update)
- `429` — rate limit exceeded (from express-rate-limit)
- `500` — unhandled server error
- AI errors prefixed: `API_RATE_LIMIT`, `API_AUTH_ERROR`, `API_INVALID_REQUEST`

### Prisma Error Codes

- `P2002` — unique constraint violation (email duplicate)
- `P2025` — record not found (update/delete)
