/**
 * Rich text of notes: a small, safe subset of HTML.
 * Stored as `Note.html`; `Note.body` always keeps the plain-text twin (search, previews, old code).
 */

const BLOCK = /<\/(p|div|h[1-6]|li|blockquote|figure)>|<br\s*\/?>/gi;
const ENT: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/** Plain text of an HTML fragment, one line per block. Works without a DOM. */
export function htmlToText(html: string): string {
  return html
    .replace(/<figure[\s\S]*?<\/figure>/gi, "\n")
    .replace(BLOCK, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENT[m] ?? m)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain text → paragraphs, for notes written before rich text existed. */
export function textToHtml(text: string): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((l) => (l ? `<p>${esc(l)}</p>` : "<p><br></p>"))
    .join("");
}

export const TEXT_COLORS = ["#f5f3f0", "#ff4b57", "#f0b14e", "#3cc896", "#4f8cff", "#a678ff", "#e440d4"] as const;
export const MARK_COLORS = ["#ff4b57", "#f0b14e", "#3cc896", "#4f8cff", "#a678ff", "#e440d4"] as const;

const TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "H2", "H3", "P", "DIV", "BR", "UL", "OL", "LI", "BLOCKQUOTE", "SPAN", "FIGURE"]);
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\))$/i;
const ALIGN = new Set(["left", "center", "right"]);

function cleanStyle(el: HTMLElement): string {
  const out: string[] = [];
  const c = el.style.color;
  if (c && COLOR.test(c)) out.push(`color:${c}`);
  const b = el.style.backgroundColor;
  if (b && COLOR.test(b)) out.push(`background-color:${b}`);
  const a = el.style.textAlign;
  if (a && ALIGN.has(a)) out.push(`text-align:${a}`);
  return out.join(";");
}

function walk(src: Node, dst: Node, doc: Document) {
  src.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      dst.appendChild(doc.createTextNode(n.textContent ?? ""));
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as HTMLElement;
    const tag = el.tagName;
    if (tag === "FIGURE") {
      const id = el.getAttribute("data-photo");
      if (!id || !/^p-[\w-]+$/.test(id)) return;
      const f = doc.createElement("figure");
      f.setAttribute("data-photo", id);
      f.setAttribute("contenteditable", "false");
      dst.appendChild(f);
      return;
    }
    if (!TAGS.has(tag)) {
      // unknown wrapper (font, a, script…): keep its text, drop the tag
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME") return;
      walk(el, dst, doc);
      return;
    }
    const clone = doc.createElement(tag.toLowerCase());
    const st = cleanStyle(el);
    if (st) clone.setAttribute("style", st);
    walk(el, clone, doc);
    dst.appendChild(clone);
  });
}

/** Keeps only the tags and styles the editor itself can make. */
export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const out = doc.createElement("div");
  walk(doc.body, out, doc);
  return out.innerHTML;
}

/** Photos placed in the text, in order. */
export function photoIdsOf(html: string | undefined): string[] {
  if (!html) return [];
  return [...html.matchAll(/data-photo="(p-[\w-]+)"/g)].map((m) => m[1]);
}
