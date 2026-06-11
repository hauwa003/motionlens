import type { MotionGraph } from "@motionlens/motion-graph";

import { createAnonClient, supabaseConfigured, type AnalysisRow } from "@/lib/supabase";

/** Public share page for an analysis (Phase 17: analysis sharing). */

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;

  if (!supabaseConfigured()) {
    return <Message text="Supabase isn't configured on this deployment." />;
  }

  const supabase = createAnonClient();
  const { data } = await supabase
    .from("analyses")
    .select("*")
    .eq("share_id", shareId)
    .maybeSingle();

  const row = data as AnalysisRow | null;
  if (!row) return <Message text="This analysis doesn't exist or is no longer shared." />;

  const graph = row.graph as MotionGraph;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-8">
      <header>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Shared analysis</p>
        <h1 className="mt-1 break-all text-lg font-semibold tracking-tight">{row.source_url}</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Captured {new Date(row.saved_at).toLocaleString()} · on {graph.trigger} ·{" "}
          {graph.durationMs}ms · {graph.sequence.kind}
          {graph.sequence.kind === "stagger" && graph.sequence.staggerMs
            ? ` (${graph.sequence.staggerMs}ms)`
            : ""}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        {graph.nodes.map((node) => (
          <div key={node.id} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-mono text-xs text-emerald-300">{node.selector}</p>
              <p className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">
                {node.motionTypes.join(" · ")}
              </p>
            </div>
            <table className="mt-3 w-full text-left font-mono text-[11px] text-zinc-400">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-zinc-600">
                  <th className="pb-1 pr-3 font-normal">Property</th>
                  <th className="pb-1 pr-3 font-normal">From → To</th>
                  <th className="pb-1 pr-3 font-normal">Timing</th>
                  <th className="pb-1 font-normal">Easing</th>
                </tr>
              </thead>
              <tbody>
                {node.changes.map((change) => (
                  <tr key={change.property} className="border-t border-zinc-900">
                    <td className="py-1.5 pr-3 text-zinc-200">{change.property}</td>
                    <td
                      className="max-w-0 truncate py-1.5 pr-3"
                      title={`${change.from} → ${change.to}`}
                    >
                      {change.from} → {change.to}
                    </td>
                    <td className="py-1.5 pr-3">
                      {change.duration}ms{change.delay > 0 ? ` +${change.delay}ms` : ""}
                    </td>
                    <td className="py-1.5">{change.easing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <footer className="text-center text-xs text-zinc-600">
        Analyzed with MotionLens — See it. Decode it. Recreate it.
      </footer>
    </main>
  );
}

function Message({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-8 text-sm text-zinc-400">
      {text}
    </main>
  );
}
