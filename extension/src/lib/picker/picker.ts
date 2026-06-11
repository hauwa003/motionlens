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

const HOVER_COLOR = "#a78bfa";
const SELECTED_COLOR = "#34d399";

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
    this.tooltip.textContent = `${truncate(label, 60)}  ${info.rect.width} × ${info.rect.height}`;
    this.tooltip.style.display = "block";
    this.tooltip.style.left = `${Math.max(4, rect.left)}px`;
    const above = rect.top > 28;
    this.tooltip.style.top = above ? `${rect.top - 26}px` : `${rect.bottom + 4}px`;
  }

  private drawSelection(): void {
    this.selectionLayer.replaceChildren();

    for (const element of this.selected) {
      if (!element.isConnected) {
        this.selected.delete(element);
        continue;
      }
      const box = document.createElement("div");
      box.style.cssText = `position: fixed; pointer-events: none; border: 2px solid ${SELECTED_COLOR}; border-radius: 2px;`;
      positionBox(box, element.getBoundingClientRect());
      this.selectionLayer.appendChild(box);
    }
  }

  private mount(): void {
    this.host = document.createElement("div");
    this.host.style.cssText =
      "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";

    const shadow = this.host.attachShadow({ mode: "closed" });

    this.hoverBox = document.createElement("div");
    this.hoverBox.style.cssText = `position: fixed; pointer-events: none; display: none; border: 2px solid ${HOVER_COLOR}; background: ${HOVER_COLOR}1a; border-radius: 2px;`;

    this.tooltip = document.createElement("div");
    this.tooltip.style.cssText =
      "position: fixed; pointer-events: none; display: none; max-width: 60vw; overflow: hidden; " +
      "background: #09090b; color: #e4e4e7; border: 1px solid #27272a; border-radius: 6px; " +
      "padding: 3px 8px; font: 11px/1.5 ui-monospace, monospace; white-space: pre;";

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
