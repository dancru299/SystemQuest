export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl items-center px-5">
      <section className="border border-rune/35 bg-deep/85 p-8 shadow-rune">
        <p className="font-display text-3xl text-gold">Can cau hinh Supabase</p>
        <p className="mt-4 leading-7 text-text-dim">
          App da duoc build theo cloud MVP. De chay workflow that, tao file <code className="text-rune-bright">.env.local</code> trong thu muc <code className="text-rune-bright">web/</code> voi Supabase URL, anon key va AI provider keys.
        </p>
        <pre className="mt-6 overflow-x-auto border border-white/10 bg-void/80 p-4 text-xs leading-6 text-text-primary">
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_EMAILS=admin@example.com
AUTH_AUTO_CONFIRM_EMAIL=false
AI_PROVIDER_PRIORITY=gemini,openai,anthropic
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}
        </pre>
      </section>
    </main>
  );
}
