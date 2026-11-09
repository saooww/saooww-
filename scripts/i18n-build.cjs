// Builds src/i18n/locales/<lang>.json from scripts/i18n/<lang>.NN.txt — one
// translation per line, in the order of src/i18n/keys.json — and
// scripts/i18n/<lang>.plurals.txt («дело|дела|дел = one:task; other:tasks»).
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "i18n");
const keys = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/i18n/keys.json"), "utf8"));
const LANGS = ["en", "es", "fr", "de", "pt", "tr", "zh", "ja", "hi"];
const ph = (s) => (s.match(/\{\d+\}/g) || []).sort().join(",");
let problems = 0;
for (const lang of LANGS) {
  const chunks = fs.readdirSync(DIR).filter((f) => new RegExp(`^${lang}\\.\\d+\\.txt$`).test(f)).sort();
  const lines = chunks.flatMap((f) => fs.readFileSync(path.join(DIR, f), "utf8").replace(/\n$/, "").split("\n"));
  const out = {};
  lines.forEach((line, i) => {
    const key = keys.texts[i];
    if (key === undefined) return;
    let v = line.trim();
    if (!v) return;
    // «∅» — deliberately empty (a Russian word ending that other languages don't have)
    if (v === "∅") {
      out[key] = "";
      return;
    }
    if (ph(v) !== ph(key)) {
      problems++;
      console.log(`${lang} #${i}: placeholders differ\n  ru: ${key}\n  ${lang}: ${v}`);
    }
    // same edge spaces as the Russian text: fragments are glued to their neighbours
    v = (key.match(/^\s*/)[0]) + v + (key.match(/\s*$/)[0]);
    out[key] = v;
  });
  const pf = path.join(DIR, `${lang}.plurals.txt`);
  if (fs.existsSync(pf)) {
    for (const row of fs.readFileSync(pf, "utf8").split("\n")) {
      const [k, rest] = row.split(" = ");
      if (!k || !rest) continue;
      out[k.trim()] = Object.fromEntries(rest.split(";").map((p) => p.trim().split(":").map((x) => x.trim())).filter((p) => p.length === 2));
    }
  }
  fs.writeFileSync(path.join(__dirname, `../src/i18n/locales/${lang}.json`), JSON.stringify(out) + "\n");
  console.log(`${lang}: ${Object.keys(out).length} of ${keys.texts.length + keys.plurals.length}`);
}
if (problems) process.exitCode = 1;
