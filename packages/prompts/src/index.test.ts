import { createEmptyMotionGraph } from "@motionlens/motion-graph";
import { describe, expect, it } from "vitest";

import { generatePrompt, TARGET_PLATFORMS } from "./index";

describe("generatePrompt", () => {
  it("produces a prompt for every supported platform", () => {
    const graph = createEmptyMotionGraph("https://example.com", "hover");

    for (const platform of TARGET_PLATFORMS) {
      const prompt = generatePrompt(graph, platform);
      expect(prompt.platform).toBe(platform);
      expect(prompt.text).toContain("https://example.com");
      expect(prompt.text).toContain("hover");
    }
  });
});
