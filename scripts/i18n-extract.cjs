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
const out = { texts: [...texts].sort(), plurals: [...plurals].sort() };
fs.writeFileSync(path.join(ROOT, "i18n/keys.json"), JSON.stringify(out, null, 1) + "\n");
console.log("texts", out.texts.length, "plurals", out.plurals.length, "chars", out.texts.join("").length);
