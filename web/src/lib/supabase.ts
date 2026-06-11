import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase clients. v1 uses Supabase for both the database and auth
 * (magic-link sign-in) — no separate auth provider needed.
 *
 * Required env vars (see .env.example):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Browser client — persists the session in localStorage. */
export function createBrowserClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Request-scoped client carrying a user's access token, so every query runs
 * under that user's row-level-security policies. Used by the sync API.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false },
    },
  );
}

/** Anonymous client for public share pages. */
export function createAnonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Row shape of public.analyses. */
export interface AnalysisRow {
  id: string;
  client_id: string;
  source_url: string;
  saved_at: string;
  graph: unknown;
  frameworks: unknown;
  tags: string[];
  share_id: string | null;
  created_at: string;
}
