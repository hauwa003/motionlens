import { NextResponse, type NextRequest } from "next/server";

import { createUserClient, supabaseConfigured, type AnalysisRow } from "@/lib/supabase";

/**
 * Sync API for the extension. Auth: `Authorization: Bearer <supabase access
 * token>` — every query runs under that user's RLS policies.
 *
 * GET  → list the user's analyses
 * POST → upsert an array of analyses (deduped on client_id)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function tokenFrom(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!supabaseConfigured()) return json({ error: "Supabase is not configured." }, 503);
  const token = tokenFrom(request);
  if (!token) return json({ error: "Missing bearer token." }, 401);

  const supabase = createUserClient(token);
  const { data, error } = await supabase
    .from("analyses")
    .select("client_id, source_url, saved_at, graph, frameworks, tags, share_id")
    .order("saved_at", { ascending: false })
    .limit(200);

  if (error) return json({ error: error.message }, 400);
  return json({ analyses: data });
}

interface IncomingAnalysis {
  client_id: string;
  source_url: string;
  saved_at: string;
  graph: unknown;
  frameworks: unknown;
  tags: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!supabaseConfigured()) return json({ error: "Supabase is not configured." }, 503);
  const token = tokenFrom(request);
  if (!token) return json({ error: "Missing bearer token." }, 401);

  let payload: { analyses?: IncomingAnalysis[] };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const analyses = payload.analyses ?? [];
  if (!Array.isArray(analyses) || analyses.length === 0) {
    return json({ error: "Body must include a non-empty `analyses` array." }, 400);
  }
  if (analyses.length > 200) return json({ error: "Too many analyses (max 200)." }, 400);

  const supabase = createUserClient(token);

  // user_id is filled by the column default (auth.uid()) under RLS.
  const rows = analyses.map((analysis) => ({
    client_id: String(analysis.client_id),
    source_url: String(analysis.source_url),
    saved_at: analysis.saved_at,
    graph: analysis.graph,
    frameworks: analysis.frameworks ?? [],
    tags: analysis.tags ?? [],
  }));

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Invalid or expired token." }, 401);

  const { error } = await supabase.from("analyses").upsert(
    rows.map((row) => ({ ...row, user_id: userData.user.id })),
    { onConflict: "user_id,client_id" },
  );

  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, count: rows.length });
}

export type { AnalysisRow };
