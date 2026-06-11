"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { createBrowserClient, supabaseConfigured, type AnalysisRow } from "@/lib/supabase";

/**
 * Dashboard — the user's synced analyses: list, share toggle, delete, and
 * the sync token the extension uses to push/pull.
 */

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function DashboardPage() {
  const configured = supabaseConfigured();
  const supabase = useMemo(() => (configured ? createBrowserClient() : null), [configured]);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => subscription.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session) return;
    void supabase
      .from("analyses")
      .select("*")
      .order("saved_at", { ascending: false })
      .then(({ data }) => setRows((data as AnalysisRow[]) ?? []));
  }, [supabase, session]);

  if (!configured) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-sm text-zinc-400">
        Supabase isn&apos;t configured. See web/.env.example.
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Loading…
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-zinc-400">
        <p>You&apos;re not signed in.</p>
        <Link href="/login" className="text-zinc-100 underline underline-offset-4">
          Sign in →
        </Link>
      </main>
    );
  }

  const toggleShare = async (row: AnalysisRow) => {
    if (!supabase) return;
    const share_id = row.share_id ? null : crypto.randomUUID().replaceAll("-", "");
    const { error } = await supabase.from("analyses").update({ share_id }).eq("id", row.id);
    if (!error) {
      setRows((current) =>
        current.map((candidate) =>
          candidate.id === row.id ? { ...candidate, share_id } : candidate,
        ),
      );
    }
  };

  const remove = async (row: AnalysisRow) => {
    if (!supabase) return;
    const { error } = await supabase.from("analyses").delete().eq("id", row.id);
    if (!error) setRows((current) => current.filter((candidate) => candidate.id !== row.id));
  };

  const copyToken = async () => {
    await navigator.clipboard.writeText(session.access_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Your analyses</h1>
        <button
          type="button"
          onClick={() => supabase && void supabase.auth.signOut()}
          className="text-xs text-zinc-500 transition-colors hover:text-zinc-200"
        >
          Sign out
        </button>
      </header>

      <section className="rounded-md border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="text-sm font-medium">Sync token</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Paste this into the MotionLens side panel (Sync section) to push and pull analyses. Tokens
          expire after about an hour — copy a fresh one when sync fails.
        </p>
        <button
          type="button"
          onClick={() => void copyToken()}
          className="mt-2 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-white"
        >
          {copied ? "Copied ✓" : "Copy sync token"}
        </button>
      </section>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nothing synced yet. In the extension side panel, open Sync and push your library.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/60 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-200">{hostnameOf(row.source_url)}</p>
                <p className="font-mono text-[11px] text-zinc-500">
                  {new Date(row.saved_at).toLocaleString()}
                  {row.tags.length > 0 ? ` · ${row.tags.join(", ")}` : ""}
                </p>
                {row.share_id && (
                  <Link
                    href={`/a/${row.share_id}`}
                    className="font-mono text-[11px] text-violet-300 underline-offset-2 hover:underline"
                  >
                    /a/{row.share_id.slice(0, 12)}…
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => void toggleShare(row)}
                className="shrink-0 rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
              >
                {row.share_id ? "Unshare" : "Share"}
              </button>
              <button
                type="button"
                onClick={() => void remove(row)}
                className="shrink-0 text-[11px] text-zinc-600 hover:text-red-300"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
