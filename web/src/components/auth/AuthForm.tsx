"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Globe2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SITE_URL } from "@/lib/env";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/app";
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isRegister = mode === "register";
  const passwordValid = /[A-Z]/.test(password) && /\d/.test(password) && password.length >= 8;
  const canSubmit =
    email.includes("@") &&
    passwordValid &&
    (!isRegister || (displayName.trim().length >= 2 && password === confirmPassword));

  function isEmailNotConfirmed(value: unknown) {
    return value instanceof Error && value.message.toLowerCase().includes("email not confirmed");
  }

  async function resendConfirmationEmail() {
    setError(null);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (resendError) throw resendError;
      setMessage("Đã gửi lại email xác nhận. Hãy kiểm tra inbox/spam.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Không thể gửi lại email xác nhận.");
    }
  }

  async function tryAutoConfirmEmail() {
    const response = await fetch("/api/auth/auto-confirm-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(
        payload?.error?.message ??
          "Email not confirmed. Confirm the email inbox, or disable Confirm email in Supabase Auth settings.",
      );
    }
  }

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        if (isRegister) {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
              data: { display_name: displayName },
            },
          });
          if (signUpError) throw signUpError;
          setMessage("Tài khoản đã được tạo. Nếu Supabase bật email confirmation, hãy kiểm tra inbox.");
          router.refresh();
          router.push(next);
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          if (isEmailNotConfirmed(signInError)) {
            try {
              await tryAutoConfirmEmail();
              const { error: retryError } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              if (retryError) throw retryError;
              setMessage("Email đã được auto-confirm cho MVP. Đang vào app...");
              router.refresh();
              router.push(next);
              return;
            } catch (autoConfirmError) {
              setError(
                autoConfirmError instanceof Error
                  ? autoConfirmError.message
                  : "Email not confirmed. Hãy xác nhận email trong inbox.",
              );
              return;
            }
          }
          throw signInError;
        }
        router.refresh();
        router.push(next);
      } catch (authError) {
        setError(authError instanceof Error ? authError.message : "Không thể xác thực.");
      }
    });
  }

  function signInWithGoogle() {
    setError(null);
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (oauthError) throw oauthError;
      } catch (authError) {
        setError(authError instanceof Error ? authError.message : "Không thể mở Google OAuth.");
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl items-center justify-center px-4 py-10">
      <div className="grid w-full gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden min-h-[620px] border border-rune/30 bg-deep/70 p-8 shadow-rune lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-10 flex items-center gap-4">
              <div className="grid size-13 place-items-center border border-rune/50 text-rune-bright">
                <ShieldCheck className="size-7" />
              </div>
              <div>
                <p className="font-display text-2xl text-text-primary">Nhiem Vu He Thong</p>
                <p className="text-xs uppercase tracking-[0.35em] text-text-dim">Quest System</p>
              </div>
            </div>
            <h1 className="max-w-md font-display text-5xl leading-tight text-gold">
              Dang nhap va nhan nhiem vu hom nay.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-text-dim">
              AI chia plan lon thanh cac quest co the thuc hien, con ban chi can quay lai moi ngay va danh dau tien do.
            </p>
          </div>
          <div className="grid gap-3 border border-white/10 p-5 text-sm text-text-dim">
            <p className="text-rune-bright">He thong bao ve API key va XP o server.</p>
            <p>Cloud sync qua Supabase Auth va Postgres RLS.</p>
            <p>Quest Day khong tu nhay khi ban bo lo ngay.</p>
          </div>
        </section>

        <section className="border border-rune/35 bg-deep/80 p-6 shadow-rune sm:p-8">
          <div className="mb-8">
            <p className="font-display text-3xl text-text-primary">
              {isRegister ? "Dang ky tai khoan" : "Dang nhap"}
            </p>
            <p className="mt-2 text-sm text-text-dim">
              {isRegister
                ? "Tao tai khoan de luu quest va XP len cloud."
                : "Tro lai hanh trinh va tiep tuc Quest Day hien tai."}
            </p>
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isPending}
            className="flex h-12 w-full items-center justify-center gap-3 border border-white/15 bg-white/[0.04] text-sm font-semibold text-text-primary transition hover:border-rune hover:text-rune-bright disabled:opacity-50"
          >
            <Globe2 className="size-4" />
            Tiep tuc voi Google
          </button>

          <div className="my-7 flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-text-muted">
            <div className="h-px flex-1 bg-white/10" />
            hoac
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) submit();
            }}
          >
            {isRegister ? (
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                  Ten hien thi
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="h-12 w-full border border-white/10 bg-void/70 px-4 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-rune"
                  placeholder="Minh Nguyen"
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                Email
              </span>
              <div className="flex h-12 items-center border border-white/10 bg-void/70 px-4 focus-within:border-rune">
                <Mail className="mr-3 size-4 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-full flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                  placeholder="you@example.com"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                Mat khau
              </span>
              <div className="flex h-12 items-center border border-white/10 bg-void/70 px-4 focus-within:border-rune">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-full flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                  placeholder="It nhat 8 ky tu, 1 chu hoa, 1 so"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="text-text-muted transition hover:text-text-primary"
                  aria-label={showPassword ? "An mat khau" : "Hien mat khau"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>

            {isRegister ? (
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
                  Nhap lai mat khau
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-12 w-full border border-white/10 bg-void/70 px-4 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-rune"
                  placeholder="Nhap lai mat khau"
                />
              </label>
            ) : null}

            {!passwordValid && password.length > 0 ? (
              <p className="text-xs text-ember">Mat khau can toi thieu 8 ky tu, co chu hoa va so.</p>
            ) : null}
            {isRegister && confirmPassword && password !== confirmPassword ? (
              <p className="text-xs text-ember">Mat khau xac nhan chua khop.</p>
            ) : null}
            {message ? <p className="text-sm text-ice">{message}</p> : null}
            {error ? <p className="text-sm text-ember">{error}</p> : null}
            {error?.toLowerCase().includes("email not confirmed") ||
            error?.includes("AUTH_AUTO_CONFIRM_EMAIL") ? (
              <button
                type="button"
                onClick={() => void resendConfirmationEmail()}
                disabled={!email.includes("@") || isPending}
                className="text-sm text-rune-bright underline underline-offset-4 disabled:text-text-muted"
              >
                Gửi lại email xác nhận
              </button>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit || isPending}
              className="flex h-13 w-full items-center justify-center gap-2 border border-gold/60 bg-gold/18 font-display text-base text-gold transition hover:bg-gold/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-text-muted"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {isRegister ? "Tao tai khoan" : "Dang nhap"}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-text-dim">
            {isRegister ? "Da co tai khoan?" : "Chua co tai khoan?"}{" "}
            <Link
              href={isRegister ? `/login?next=${encodeURIComponent(next)}` : `/register?next=${encodeURIComponent(next)}`}
              className="text-rune-bright underline underline-offset-4"
            >
              {isRegister ? "Dang nhap" : "Dang ky"}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
