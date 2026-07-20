# ueat server

Prototype Node.js backend for the Android App route described in `TechPrototype/` and `web/docs/`.

## Stack

- TypeScript
- Express
- PostgreSQL for the deployed prototype stage
- Unified JSON responses:
  - success: `{ "success": true, "data": ... }`
  - failure: `{ "success": false, "error": { "code": "...", "message": "..." } }`

## Scripts

```bash
npm run dev
npm run check
npm run build
npm run start
```

Local default:

```text
http://127.0.0.1:3000
```

Ubuntu deployment target:

```text
Nginx /api -> http://127.0.0.1:3000
```

## Implemented API skeleton

Health:

- `GET /health`

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/send-email-code`
- `POST /auth/verify-email`

Users:

- `GET /users/:userId`
- `PATCH /users/me`
- `DELETE /users/me`
- `GET /users/:userId/meal-cards`
- `GET /users/:userId/posts`
- `GET /users/:userId/following`
- `GET /users/:userId/followers`
- `GET /users/:userId/follow-summary`
- `POST /users/:userId/follow`
- `DELETE /users/:userId/follow`
- `POST /users/:userId/block`
- `DELETE /users/:userId/block`
- `GET /users/me/pet`
- `PATCH /users/me/pet`

Meal cards:

- `GET /meal-cards`
- `POST /meal-cards`
- `GET /meal-cards/:cardId`
- `PATCH /meal-cards/:cardId`
- `DELETE /meal-cards/:cardId`
- `POST /meal-cards/:cardId/invite`

`GET /meal-cards` returns active cards ranked for the current user when a valid `x-user-id` or bearer user id is present. The ranking logic lives in `src/modules/recommendation.ts`; the current algorithm is documented in `web/docs/14-home-meal-card-matching-algorithm.md`.

Posts and comments:

- `GET /posts`
- `POST /posts`
- `GET /posts/:postId`
- `PATCH /posts/:postId`
- `DELETE /posts/:postId`
- `POST /posts/:postId/like`
- `DELETE /posts/:postId/like`
- `POST /posts/:postId/favorite`
- `DELETE /posts/:postId/favorite`
- `GET /posts/:postId/comments`
- `POST /posts/:postId/comments`
- `PATCH /comments/:commentId`
- `DELETE /comments/:commentId`
- `POST /comments/:commentId/like`
- `DELETE /comments/:commentId/like`
- `POST /comments/:commentId/favorite`
- `DELETE /comments/:commentId/favorite`

Search:

- `GET /search?q=keyword`

Reports:

- `POST /reports`
- `GET /admin/reports`
- `PATCH /admin/reports/:reportId`

Chat:

- `GET /conversations`
- `POST /conversations`
- `GET /conversations/:conversationId/messages`
- `POST /conversations/:conversationId/read`
- `POST /conversations/:conversationId/typing`
- `POST /messages`
- `POST /messages/:messageId/revoke`

Uploads:

- `POST /uploads`
- `GET /uploads/:purpose/:userId/:fileName`

The current prototype upload API accepts JSON `{ fileName, mimeType, dataBase64, purpose }` and stores files under `UPLOAD_DIR` or `server/data/uploads` by default. It returns a stable media URL that can be saved on avatars, posts, meal cards, and chat messages.

For real object storage, provide an S3-compatible bucket or vendor details:

- provider: Cloudflare R2, AWS S3, Alibaba OSS, Tencent COS, Supabase Storage, etc.
- bucket name and region
- endpoint URL if S3-compatible
- access key ID and secret access key
- public base URL or CDN domain
- upload size limits and allowed MIME types

Notifications:

- `GET /notifications`
- `PATCH /notifications/:notificationId/read`
- `PATCH /notifications/read-all`

Pet companion:

- `GET /users/me/pet` returns the current account-level desktop pet state.
- `PATCH /users/me/pet` stores the full desktop pet JSON state for the current account.
- Pet state is stored in PostgreSQL table `user_pet_states` with `user_id`, `state JSONB`, and `updated_at`.
- The frontend keeps a local fallback, but the server is the source of truth for cross-device level, affinity, position, action, and daily reward state once the user is authenticated.

Account deletion:

- `DELETE /users/me` permanently deletes the current account after the frontend confirmation flow.
- User-owned cloud data is removed through PostgreSQL cascades, including profile, settings, pet state, meal cards, posts, comments, follows, notifications, chat membership, messages, exchange requests, and interaction rows.
- Before deleting the user row, the server reconciles denormalized like, favorite, and comment counters so remaining public content does not keep stale counts from the deleted account.

## Prototype auth

This prototype uses `x-user-id` or `Authorization: Bearer <userId>` as a temporary local identity boundary. Replace it with JWT or cookie sessions before production.

Seed users:

- `user-demo`
- `user-lin`

## Database source of truth

The deployed prototype now uses the configured PostgreSQL database as the source of truth:

```text
DATABASE_URL=postgres://...
```

Tables are created or migrated automatically when the cloud server starts. Local work should be limited to code edits plus `npm run check` / `npm run build`; API and persistence verification should be done against the configured deployment endpoint.

The old local SQLite file has been renamed out of `server/data` into:

```text
local-db-backups/ueat-dev.sqlite.local-backup
```

That backup is ignored by Git and is not part of deployment.

## Next backend steps

1. Keep tightening the frontend hooks that already read/write backend APIs, especially around edge cases and optimistic updates.
2. Add real password hashing and session or JWT auth.
3. Replace local JSON media upload storage with object storage or signed direct uploads.
4. Add request validation middleware such as Zod before public testing.
5. Add integration tests for the API contract consumed by `web/src/services`.
6. Add admin pages for reports and content moderation.

## Cloud deploy files

Deployment assets live in `server/deploy/`:

- `nginx-ueat.conf`
- `ueat-server.service`
- `install-ubuntu.sh`
- `activate-service.sh`
