import "~style.css";

function IndexSidePanel() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-zinc-950 p-6 text-center text-zinc-100">
      <h1 className="text-base font-semibold tracking-tight">MotionLens</h1>
      <p className="max-w-xs text-xs text-zinc-400">
        No analysis yet. Activate MotionLens from the toolbar and select an element to capture its
        motion.
      </p>
    </div>
  );
}

export default IndexSidePanel;
