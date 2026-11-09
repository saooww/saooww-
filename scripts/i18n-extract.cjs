// Collects every tr("…") text and every Russian plural triple into src/i18n/keys.json.
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../src");
const CY = /[А-Яа-яЁё]/;
const texts = new Set();
const plurals = new Set();
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|)$/.test(f) && !p.includes("i18n/locales")) {
      const src = fs.readFileSync(p, "utf8");
      const sf = ts.createSourceFile(p, src, ts.ScriptTarget.Latest, true, p.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      (function visit(n) {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === "tr" || n.expression.text === "t") && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) texts.add(n.arguments[0].text);
        if (ts.isArrayLiteralExpression(n) && n.elements.length === 3 && n.elements.every((e) => ts.isStringLiteral(e) && CY.test(e.text))) plurals.add(n.elements.map((e) => e.text).join("|"));
        ts.forEachChild(n, visit);
      })(sf);
    }
  }
})(ROOT);
// Keep the existing order (translations are matched to keys by line number)
// and add new texts at the end; texts no longer used stay, harmlessly.
const file = path.join(ROOT, "i18n/keys.json");
const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { texts: [], plurals: [] };
const merge = (prev, now) => [...prev, ...[...now].filter((k) => !prev.includes(k)).sort()];
const out = { texts: merge(old.texts, texts), plurals: merge(old.plurals, plurals) };
const added = out.texts.length - old.texts.length;
fs.writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
if (added) console.log("new texts from line", old.texts.length, ":", out.texts.slice(old.texts.length));
console.log("texts", out.texts.length, "plurals", out.plurals.length, "chars", out.texts.join("").length);
