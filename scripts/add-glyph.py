"""Add icons to the app's set: python3 scripts/add-glyph.py Name:PhosphorName[:ui] ...
Then run npm run glyphs to regenerate glyphData.ts."""
import json, pathlib, sys
spec_p = pathlib.Path("scripts/glyphs.json"); spec = json.loads(spec_p.read_text())
gl_p = pathlib.Path("src/ui/glyphs.tsx"); gl = gl_p.read_text()
for arg in sys.argv[1:]:
    name, ph, *flag = arg.split(":")
    ui = bool(flag and flag[0] == "ui")
    spec[name] = {"ph": ph, "weights": ["bold"] if ui else ["duotone"]}
    line = f'export const {name} = glyph("{name}", {"true" if ui else "false"});'
    if f"export const {name} =" not in gl: gl = gl.rstrip("\n") + "\n" + line + "\n"
spec_p.write_text(json.dumps(dict(sorted(spec.items())), indent=1, ensure_ascii=False) + "\n")
gl_p.write_text(gl)
