import { readFileSync } from "node:fs";
const raw = readFileSync(process.env.H, "utf8").replace(/^\uFEFF/, "");
const j = JSON.parse(raw);
const out = [];
function walk(n) {
  const a = n.attributes || {};
  const t = (a.text || "").trim();
  const at = (a.accessibilityText || "").trim();
  const label = at || t;
  if (a.clickable === "true" || label) {
    out.push({ clickable: a.clickable, cls: (a.class||"").split(".").pop(), bounds: a.bounds, text: label.slice(0, 90) });
  }
  for (const c of (n.children || [])) walk(c);
}
walk(j);
for (const o of out) {
  if (o.text || o.clickable === "true") console.log(`${o.clickable==="true"?"CLICK":"     "} ${o.cls.padEnd(18)} ${o.bounds.padEnd(24)} ${o.text}`);
}
