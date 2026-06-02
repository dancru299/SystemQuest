# Quest System Web

Next.js cloud MVP for **Nhiem Vu He Thong / Quest System**.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase Auth, Postgres, RLS
- AI provider router for Gemini, OpenAI, and Anthropic quest generation
- Zod validation, Zustand-ready client state, localStorage offline mission queue

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Create a Supabase project and apply `supabase/migrations/202606020001_initial_schema.sql`.
3. Enable Email auth and Google OAuth in Supabase Auth providers.
4. Set `NEXT_PUBLIC_SITE_URL` to the local or deployed app URL.
5. Install and run:

```bash
npm install
npm run dev
```

When no AI API key is configured in local development, `/api/quests/analyze` returns a deterministic mock quest so the UI can still be exercised.

## Email Confirmation

The PRD expects unverified users to still enter the app and see a reminder banner. Supabase Auth blocks password login when **Confirm email** is enabled. Use one of these modes:

- Recommended for this MVP: Supabase Dashboard -> Authentication -> Providers -> Email -> turn **Confirm email** off.
- Temporary local/MVP helper: set `AUTH_AUTO_CONFIRM_EMAIL=true` with `SUPABASE_SERVICE_ROLE_KEY`; when login fails with `Email not confirmed` but the password is correct, the server confirms that user and retries login.
- Production strict mode: keep email confirmation on and require users to confirm the inbox before login.

## AI Provider Order

The runtime uses the first configured provider in this order:

1. Gemini (`GEMINI_API_KEY`, default model `gemini-3.5-flash`)
2. OpenAI (`OPENAI_API_KEY`, default model `gpt-4.1-mini`)
3. Anthropic (`ANTHROPIC_API_KEY`, default model `claude-sonnet-4-20250514`)

Set `AI_PROVIDER_PRIORITY=gemini,openai,anthropic` to override env priority, or use `/admin` to store system-wide provider settings in Supabase.

## Admin

Add the first admin email to `ADMIN_EMAILS`, then sign in with that email and open `/admin`. The admin page can update provider priority, model names, prompt, temperature, max tokens, and database-backed API keys. API keys are masked in the browser and read only by server routes.

For production, prefer environment variables or a secrets manager for long-lived keys. Database-backed keys are available for MVP operator control and should be protected by Supabase RLS plus the service-role-only admin API.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
```
