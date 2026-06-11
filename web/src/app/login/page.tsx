"use client";

import { useMemo, useState } from "react";

import { createBrowserClient, supabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const configured = supabaseConfigured();
  const supabase = useMemo(() => (configured ? createBrowserClient() : null), [configured]);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const sendLink = async () => {
    if (!supabase || !email) return;
    setStatus("sending");
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (sendError) {
      setStatus("error");
      setError(sendError.message);
      return;
    }
    setStatus("sent");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to MotionLens</h1>

      {!configured ? (
        <p className="max-w-md text-sm text-zinc-400">
          Supabase isn&apos;t configured yet. Set{" "}
          <code className="rounded bg-zinc-900 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-zinc-900 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see{" "}
          <code className="rounded bg-zinc-900 px-1">web/.env.example</code>).
        </p>
      ) : status === "sent" ? (
        <p className="max-w-md text-sm text-zinc-400">
          Check your inbox — we sent a sign-in link to <strong>{email}</strong>.
        </p>
      ) : (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void sendLink()}
            placeholder="you@example.com"
            className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600"
          />
          <button
            type="button"
            disabled={status === "sending" || !email}
            onClick={() => void sendLink()}
            className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </main>
  );
}
