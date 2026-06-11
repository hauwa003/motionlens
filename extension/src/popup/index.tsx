import { useState } from "react";

import "~style.css";

function IndexPopup() {
  const [active, setActive] = useState(false);

  return (
    <div className="flex w-72 flex-col gap-4 bg-zinc-950 p-4 text-zinc-100">
      <header className="flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-tight">MotionLens</h1>
        <span
          className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400" : "bg-zinc-600"}`}
          aria-label={active ? "Active" : "Inactive"}
        />
      </header>

      <p className="text-xs text-zinc-400">See it. Decode it. Recreate it.</p>

      <button
        type="button"
        onClick={() => setActive((value) => !value)}
        className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 transition-colors hover:bg-white"
      >
        {active ? "Stop analyzing" : "Analyze this page"}
      </button>
    </div>
  );
}

export default IndexPopup;
