// One-off codemod: wraps Russian UI strings in tr() so they can be translated.
// node scripts/i18n-wrap.cjs [files…]   (default: the app's UI files)
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const CY = /[А-Яа-яЁё]/;
const ROOT = path.resolve(__dirname, "../src");
const SKIP = new Set(["lib/quickParse.ts", "lib/smart.ts", "lib/dates.ts", "store/seed.ts", "store/migrate.ts", "i18n/i18n.ts"]);
const EXTRA_TS = ["lib/insights.ts", "lib/story.ts", "lib/goals.ts", "lib/recurrence.ts", "lib/present.ts", "lib/tasks.ts", "lib/analytics.ts", "lib/money.ts", "lib/week.ts", "lib/ics.ts", "lib/backupFile.ts", "lib/rates.ts", "store/catalog.ts", "store/store.ts", "store/undo.ts", "store/boot.ts", "ui/palettes.ts", "ui/numFont.ts", "features/planner/actions.ts", "features/lock/lock.ts"];

function listFiles() {
  const out = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".tsx")) out.push(p);
    }
  })(ROOT);
  for (const f of EXTRA_TS) if (fs.existsSync(path.join(ROOT, f))) out.push(path.join(ROOT, f));
  return out.filter((f) => !SKIP.has(path.relative(ROOT, f).replace(/\\/g, "/")));
}

const q = (s) => JSON.stringify(s);
const isPluralForms = (arr) => arr.elements.length === 3 && arr.elements.every((e) => ts.isStringLiteral(e) && CY.test(e.text));
const insideTr = (node) => {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && (p.expression.text === "tr" || p.expression.text === "t")) return true;
    if (ts.isNewExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === "RegExp") return true;
  }
  return false;
};

function jsxTextValue(raw) {
  // JSX whitespace: lines are trimmed and joined with single spaces; edges with newlines vanish
  if (!raw.includes("\n")) return { text: raw.trim(), lead: /^\s/.test(raw), trail: /\s$/.test(raw) };
  const lines = raw.split("\n").map((l, i, a) => (i === 0 ? l.trimEnd() : i === a.length - 1 ? l.trimStart() : l.trim())).filter((l) => l.length);
  const text = lines.join(" ").trim();
  const lead = !raw.split("\n")[0].trim() ? false : /^\s/.test(raw);
  const last = raw.split("\n").slice(-1)[0];
  const trail = !last.trim() ? false : /\s$/.test(raw);
  return { text, lead, trail };
}

function transform(file) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const add = (node, text) => edits.push({ start: node.getStart(sf), end: node.getEnd(), text });

  (function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isArrayLiteralExpression(node) && isPluralForms(node)) return; // plural forms stay Russian — they are the key
    if (ts.isTaggedTemplateExpression(node)) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && (node.expression.text === "tr" || node.expression.text === "t")) return;

    if (ts.isJsxText(node) && CY.test(node.text)) {
      const { text, lead, trail } = jsxTextValue(node.getFullText(sf).slice(node.getLeadingTriviaWidth(sf)));
      if (text) {
        const start = node.getStart(sf);
        edits.push({ start: node.pos, end: node.end, text: `${lead ? '{" "}' : ""}{tr(${q(text)})}${trail ? '{" "}' : ""}` });
      }
      return;
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && CY.test(node.text) && !insideTr(node)) {
      const p = node.parent;
      if (ts.isPropertyAssignment(p) && p.name === node) return; // a key, not a text
      if (ts.isLiteralTypeNode(p)) return;
      if (ts.isCaseClause(p)) return;
      if (ts.isJsxAttribute(p)) add(node, `{tr(${q(node.text)})}`);
      else add(node, `tr(${q(node.text)})`);
      return;
    }
    if (ts.isTemplateExpression(node) && !insideTr(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
      if (parts.some((x) => CY.test(x))) {
        let fmt = node.head.text;
        const args = [];
        node.templateSpans.forEach((sp, i) => {
          fmt += `{${i}}` + sp.literal.text;
          args.push(sp.expression.getText(sf));
        });
        const wrapped = `tr(${q(fmt)}, ${args.join(", ")})`;
        add(node, ts.isJsxExpression(node.parent) || !ts.isJsxAttribute(node.parent) ? wrapped : `{${wrapped}}`);
        return; // inner expressions keep their own texts untranslated (rare)
      }
    }
    ts.forEachChild(node, visit);
  })(sf);

  if (!edits.length) return 0;
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  if (!/import \{[^}]*\btr\b[^}]*\} from "[^"]*i18n\/i18n"/.test(out)) {
    let rel = path.relative(path.dirname(file), path.join(ROOT, "i18n/i18n")).replace(/\\/g, "/");
    if (!rel.startsWith(".")) rel = "./" + rel;
    const imports = [...out.matchAll(/^import [^;]+;$/gms)];
    const at = imports.length ? imports[imports.length - 1].index + imports[imports.length - 1][0].length : 0;
    out = out.slice(0, at) + `${at ? "\n" : ""}import { tr } from "${rel}";` + (at ? "" : "\n") + out.slice(at);
  }
  fs.writeFileSync(file, out);
  return edits.length;
}

const files = process.argv.slice(2).length ? process.argv.slice(2).map((f) => path.resolve(f)) : listFiles();
let total = 0;
for (const f of files) {
  const n = transform(f);
  if (n) console.log(String(n).padStart(4), path.relative(ROOT, f));
  total += n;
}
console.log("wrapped", total);
