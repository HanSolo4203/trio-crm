"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }

  return value;
}

function LoginCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-line bg-white p-8">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-sm font-semibold tracking-wide text-mint"
        >
          DH
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-navy">Dylan&apos;s CRM</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in with your email and password.
        </p>
        {children}
      </section>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        signInError.code === "invalid_credentials"
          ? "Wrong email or password."
          : "Could not sign in. Try again."
      );
      setSubmitting(false);
      return;
    }

    router.replace(safeNextPath(searchParams.get("next")));
    router.refresh();
  }

  return (
    <LoginCard>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-ink outline-none ring-mint/40 placeholder:text-muted/70 focus:border-navy focus:ring-2"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-ink outline-none ring-mint/40 placeholder:text-muted/70 focus:border-navy focus:ring-2"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </LoginCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoginCard>
          <p className="mt-8 text-sm text-muted">Loading…</p>
        </LoginCard>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
