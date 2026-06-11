import { describe, expect, it } from "vitest";

import { createEmptyMotionGraph, MOTION_GRAPH_SCHEMA_VERSION } from "./index";

describe("createEmptyMotionGraph", () => {
  it("creates a graph with the current schema version and no nodes", () => {
    const graph = createEmptyMotionGraph("https://example.com", "hover");

    expect(graph.schemaVersion).toBe(MOTION_GRAPH_SCHEMA_VERSION);
    expect(graph.sourceUrl).toBe("https://example.com");
    expect(graph.trigger).toBe("hover");
    expect(graph.nodes).toEqual([]);
  });
});
