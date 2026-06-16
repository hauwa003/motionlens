import type { SelectedElementInfo } from "~lib/messaging";
import { buildSelector } from "~lib/picker/selector";

/**
 * Element picker overlay — hover highlight, click to select (multi-select),
 * tooltip with element info, Escape to clear/cancel.
 *
 * All visuals live inside a closed shadow root on a single host element with
 * pointer-events disabled, so the target page's DOM and behavior are never
 * touched beyond that one inert host node.
 */

const HOVER_COLOR = "#8b5cf6"; // accent-violet
const SELECTED_COLOR = "#34d399"; // accent-emerald
const RECORDING_COLOR = "#f87171"; // accent-red

export interface PickerCallbacks {
  onSelectionChange: (selection: SelectedElementInfo[]) => void;
  /** Escape pressed with nothing selected — the user wants out. */
  onCancel: () => void;
}

export function describeElement(element: Element): SelectedElementInfo {
  const rect = element.getBoundingClientRect();
  return {
    selector: buildSelector(element),
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    classes: Array.from(element.classList),
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  };
}

export class ElementPicker {
  private host: HTMLDivElement | null = null;
  private hoverBox!: HTMLDivElement;
  private tooltip!: HTMLDivElement;
  private selectionLayer!: HTMLDivElement;

  private hovered: Element | null = null;
  private selected = new Set<Element>();
  private enabled = false;
  private paused = false;

  constructor(private callbacks: PickerCallbacks) {}

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.paused = false;
    this.mount();
    this.attachInteraction();

    window.addEventListener("scroll", this.redraw, { capture: true, passive: true });
    window.addEventListener("resize", this.redraw, { passive: true });
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    this.detachInteraction();
    window.removeEventListener("scroll", this.redraw, true);
    window.removeEventListener("resize", this.redraw);

    this.hovered = null;
    this.selected.clear();
    this.host?.remove();
    this.host = null;
  }

  /**
   * Stop intercepting mouse/keyboard so the user can interact with the page
   * naturally (recording mode). Selection outlines stay visible.
   */
  pause(): void {
    if (!this.enabled || this.paused) return;
    this.paused = true;
    this.detachInteraction();
    this.hovered = null;
    this.redraw();
  }

  /** Resume picking after a pause. */
  resume(): void {
    if (!this.enabled || !this.paused) return;
    this.paused = false;
    this.attachInteraction();
  }

  getSelection(): SelectedElementInfo[] {
    return Array.from(this.selected, describeElement);
  }

  /** Raw selected elements, for handing to the capture recorder. */
  getSelectedElements(): Element[] {
    return Array.from(this.selected);
  }

  /** Add an element to the selection by CSS selector (discovery panel). */
  selectBySelector(selector: string): boolean {
    if (!this.enabled) return false;
    let element: Element | null = null;
    try {
      element = document.querySelector(selector);
    } catch {
      return false;
    }
    if (!element || this.selected.has(element)) return false;
    this.selected.add(element);
    this.redraw();
    this.callbacks.onSelectionChange(this.getSelection());
    return true;
  }

  private attachInteraction(): void {
    document.addEventListener("mousemove", this.handleMouseMove, true);
    document.addEventListener("click", this.handleClick, true);
    window.addEventListener("keydown", this.handleKeyDown, true);
  }

  private detachInteraction(): void {
    document.removeEventListener("mousemove", this.handleMouseMove, true);
    document.removeEventListener("click", this.handleClick, true);
    window.removeEventListener("keydown", this.handleKeyDown, true);
  }

  clearSelection(): void {
    if (this.selected.size === 0) return;
    this.selected.clear();
    this.redraw();
    this.callbacks.onSelectionChange([]);
  }

  private handleMouseMove = (event: MouseEvent) => {
    const target = this.pageElementAt(event);
    if (target === this.hovered) return;
    this.hovered = target;
    this.redraw();
  };

  private handleClick = (event: MouseEvent) => {
    const target = this.pageElementAt(event);
    if (!target) return;

    // Selection clicks must not reach the page (read-only inspection).
    event.preventDefault();
    event.stopImmediatePropagation();

    if (this.selected.has(target)) {
      this.selected.delete(target);
    } else {
      this.selected.add(target);
    }
    this.redraw();
    this.callbacks.onSelectionChange(this.getSelection());
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (this.selected.size > 0) {
      this.clearSelection();
    } else {
      this.callbacks.onCancel();
    }
  };

  /** Resolve the event target, ignoring our own overlay and the page root. */
  private pageElementAt(event: MouseEvent): Element | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    if (this.host && (target === this.host || this.host.contains(target))) return null;
    if (target === document.documentElement || target === document.body) return null;
    return target;
  }

  private redraw = () => {
    if (!this.host) return;
    this.drawHover();
    this.drawSelection();
  };

  private drawHover(): void {
    const element = this.hovered;
    if (!element || !element.isConnected || this.selected.has(element)) {
      this.hoverBox.style.display = "none";
      this.tooltip.style.display = "none";
      return;
    }

    const rect = element.getBoundingClientRect();
    positionBox(this.hoverBox, rect);
    this.hoverBox.style.display = "block";

    const info = describeElement(element);
    const label =
      info.tag + (info.id ? `#${info.id}` : "") + info.classes.map((c) => `.${c}`).join("");

    // Two-line tooltip
    this.tooltip.innerHTML = "";
    const line1 = document.createElement("div");
    line1.textContent = truncate(label, 50);
    line1.style.cssText = "color: #34d399; font-weight: 500;";
    const line2 = document.createElement("div");
    line2.textContent = `${info.rect.width} × ${info.rect.height}`;
    line2.style.cssText = "color: #a1a1aa; font-size: 10px;";
    this.tooltip.appendChild(line1);
    this.tooltip.appendChild(line2);

    this.tooltip.style.display = "flex";
    this.tooltip.style.left = `${Math.max(4, rect.left)}px`;
    const above = rect.top > 44;
    this.tooltip.style.top = above ? `${rect.top - 42}px` : `${rect.bottom + 6}px`;

    // Dimension labels at bottom-right corner
    const dimLabel = this.hoverBox.querySelector("[data-dim]") as HTMLElement | null;
    if (dimLabel) {
      dimLabel.textContent = `${info.rect.width} × ${info.rect.height}`;
    }
  }

  private drawSelection(): void {
    this.selectionLayer.replaceChildren();

    let index = 0;
    for (const element of this.selected) {
      if (!element.isConnected) {
        this.selected.delete(element);
        continue;
      }
      index++;
      const rect = element.getBoundingClientRect();

      // Selection box with glow
      const box = document.createElement("div");
      const borderColor = this.paused ? RECORDING_COLOR : SELECTED_COLOR;
      box.style.cssText = `
        position: fixed;
        pointer-events: none;
        border: 2px solid ${borderColor};
        border-radius: 4px;
        box-shadow: 0 0 12px ${borderColor}40, inset 0 0 12px ${borderColor}10;
        ${this.paused ? "animation: motionlens-pulse 1.5s ease-in-out infinite;" : ""}
      `;
      positionBox(box, rect);

      // Corner dots (4px circles at each corner)
      const corners = [
        { top: "-3px", left: "-3px" },
        { top: "-3px", right: "-3px" },
        { bottom: "-3px", left: "-3px" },
        { bottom: "-3px", right: "-3px" },
      ];
      for (const pos of corners) {
        const dot = document.createElement("div");
        dot.style.cssText = `
          position: absolute;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: ${borderColor};
          ${Object.entries(pos).map(([k, v]) => `${k}: ${v}`).join("; ")};
        `;
        box.appendChild(dot);
      }

      // Selection index badge
      const badge = document.createElement("div");
      badge.textContent = String(index);
      badge.style.cssText = `
        position: absolute; top: -10px; right: -10px;
        width: 20px; height: 20px;
        display: flex; align-items: center; justify-content: center;
        border-radius: 50%;
        background: ${borderColor};
        color: #09090b;
        font: 600 10px/1 system-ui, sans-serif;
        box-shadow: 0 2px 8px ${borderColor}60;
      `;
      box.appendChild(badge);

      this.selectionLayer.appendChild(box);
    }

    // "REC" badge near first element when paused (recording mode)
    if (this.paused && this.selected.size > 0) {
      const firstElement = this.selected.values().next().value;
      if (firstElement && firstElement.isConnected) {
        const rect = firstElement.getBoundingClientRect();
        const recBadge = document.createElement("div");
        recBadge.textContent = "REC";
        recBadge.style.cssText = `
          position: fixed;
          pointer-events: none;
          left: ${rect.left}px;
          top: ${rect.top - 28}px;
          display: flex; align-items: center; gap: 4px;
          padding: 2px 8px;
          border-radius: 4px;
          background: ${RECORDING_COLOR}30;
          border: 1px solid ${RECORDING_COLOR}60;
          color: ${RECORDING_COLOR};
          font: 600 10px/1 system-ui, sans-serif;
          letter-spacing: 0.1em;
          animation: motionlens-pulse 1.5s ease-in-out infinite;
        `;
        this.selectionLayer.appendChild(recBadge);
      }
    }
  }

  private mount(): void {
    this.host = document.createElement("div");
    this.host.style.cssText =
      "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";

    const shadow = this.host.attachShadow({ mode: "closed" });

    // Inject keyframe animation for recording pulse
    const style = document.createElement("style");
    style.textContent = `
      @keyframes motionlens-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    `;
    shadow.appendChild(style);

    // Hover box with glow + gradient overlay + dimension label
    this.hoverBox = document.createElement("div");
    this.hoverBox.style.cssText = `
      position: fixed;
      pointer-events: none;
      display: none;
      border: 2px solid ${HOVER_COLOR};
      border-radius: 4px;
      background: linear-gradient(135deg, ${HOVER_COLOR}15, ${HOVER_COLOR}08);
      box-shadow: 0 0 16px ${HOVER_COLOR}30, inset 0 0 16px ${HOVER_COLOR}08;
    `;
    const dimLabel = document.createElement("div");
    dimLabel.setAttribute("data-dim", "");
    dimLabel.style.cssText = `
      position: absolute; bottom: -18px; right: 0;
      font: 10px/1 system-ui, sans-serif;
      color: #a1a1aa;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 3px;
      padding: 1px 4px;
      white-space: nowrap;
    `;
    this.hoverBox.appendChild(dimLabel);

    // Glassmorphic tooltip
    this.tooltip = document.createElement("div");
    this.tooltip.style.cssText = `
      position: fixed;
      pointer-events: none;
      display: none;
      flex-direction: column;
      max-width: 50vw;
      overflow: hidden;
      background: rgba(24, 24, 27, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 6px 10px;
      font: 12px/1.5 ui-monospace, monospace;
      white-space: pre;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    `;

    this.selectionLayer = document.createElement("div");

    shadow.append(this.selectionLayer, this.hoverBox, this.tooltip);
    document.documentElement.appendChild(this.host);
  }
}

function positionBox(box: HTMLElement, rect: DOMRect): void {
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
