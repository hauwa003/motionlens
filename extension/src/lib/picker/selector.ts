/**
 * Build a CSS selector that uniquely locates an element on the page.
 * Prefers a unique id; otherwise walks up the tree adding :nth-of-type
 * disambiguation where siblings share a tag.
 */
export function buildSelector(element: Element): string {
  if (element.id && isUnique(`#${CSS.escape(element.id)}`)) {
    return `#${CSS.escape(element.id)}`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    let part = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(
        (child) => child.tagName === current!.tagName,
      );
      if (sameTagSiblings.length > 1) {
        part += `:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`;
      }
    }

    parts.unshift(part);
    current = parent;
  }

  return parts.join(" > ");
}

function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}
