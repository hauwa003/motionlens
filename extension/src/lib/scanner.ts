import { buildSelector } from "~lib/picker/selector";

/**
 * Page interaction scanner — discovers elements likely to have interactions:
 * stylesheet :hover/:focus/:active rules and elements with CSS transitions
 * or animations. Single-page seed of the Full Site Audit (Phase 20).
 */

export interface DiscoveredInteraction {
  selector: string;
  /** Why this element was flagged, e.g. ":hover rule", "css transition". */
  evidence: string[];
}

const PSEUDO_PATTERN = /:{1,2}(hover|focus|focus-visible|focus-within|active)/;
const ELEMENT_SCAN_CAP = 3000;

export function scanPageInteractions(maxResults = 25): DiscoveredInteraction[] {
  const found = new Map<Element, Set<string>>();

  const add = (element: Element, evidence: string) => {
    if (
      element === document.documentElement ||
      element === document.body ||
      !(element instanceof HTMLElement)
    ) {
      return;
    }
    const set = found.get(element) ?? new Set<string>();
    set.add(evidence);
    found.set(element, set);
  };

  // 1) Stylesheet rules with interactive pseudo-classes.
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules; // throws on cross-origin sheets
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      const match = rule.selectorText.match(PSEUDO_PATTERN);
      if (!match) continue;

      for (const part of rule.selectorText.split(",")) {
        if (!PSEUDO_PATTERN.test(part)) continue;
        const base = part.replace(/:{1,2}[a-z-]+(\([^)]*\))?/gi, "").trim();
        if (!base) continue;
        try {
          const element = document.querySelector(base);
          if (element) add(element, `:${match[1]} rule`);
        } catch {
          // Invalid selector after stripping — skip.
        }
      }
    }
  }

  // 2) Elements with transitions or animations declared.
  const elements = document.querySelectorAll("body *");
  const limit = Math.min(elements.length, ELEMENT_SCAN_CAP);
  for (let index = 0; index < limit; index++) {
    const element = elements[index]!;
    const style = getComputedStyle(element);
    const hasTransition =
      style.transitionDuration.split(",").some((duration) => parseFloat(duration) > 0) &&
      style.transitionProperty !== "none";
    if (hasTransition) add(element, "css transition");
    if (style.animationName !== "none") add(element, "css animation");
  }

  const results: DiscoveredInteraction[] = Array.from(found.entries(), ([element, evidence]) => ({
    selector: buildSelector(element),
    evidence: Array.from(evidence),
  }));

  // Most evidence first; stable beyond that.
  results.sort((a, b) => b.evidence.length - a.evidence.length);
  return results.slice(0, maxResults);
}
