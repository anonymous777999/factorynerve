import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../src", import.meta.url));
const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const STRICT = process.argv.includes("--strict");

// Files that legitimately define base styles / token values.
const ALLOW = [
  /components[\/]ui[\/]/,          // shadcn-style primitives define base styles
  /app[\/]globals\.css$/,           // the token source of truth
];
const isAllowed = (file) => ALLOW.some((re) => re.test(file));

const checks = [
  {
    label: "Raw hex color (use a token / Tailwind class)",
    pattern: /#[0-9a-fA-F]{6}\b/g,
    files: /\.(tsx|ts)$/,
    skipAllowed: true,
  },
  {
    label: "Raw rgba() (use a token)",
    pattern: /rgba\(/g,
    files: /\.(tsx|ts)$/,
    skipAllowed: true,
  },
  {
    label: "Raw <button> (use <Button> primitive)",
    pattern: /<button\b/g,
    files: /\.tsx$/,
    skipAllowed: true,
  },
  {
    label: "Blue accent leak (unify on --accent warm clay)",
    pattern: /#(5ba8ff|89bcf8|8ec4ff|82c0ff|9bc9ff|63b2ff|55a9ff|185fa5)\b|\b(?:text|bg|border|ring|from|to|via)-(?:sky|cyan|blue)-\d/gi,
    files: /\.(tsx|ts|css)$/,
    skipAllowed: false,
  },
  {
    label: "Sub-12px font size (min body 12px, prefer 14px)",
    pattern: /\btext-\[(?:[0-9]|10|11)px\]|\btext-\[0\.\d+rem\]/g,
    files: /\.(tsx|ts)$/,
    skipAllowed: false,
  },
  {
    label: "!important (fix specificity via cn()/tailwind-merge instead)",
    pattern: /!important|\b\w+-\[[^\]]*\]!|\s![a-z-]+-/g,
    files: /\.(tsx|ts|css)$/,
    skipAllowed: true,
  },
  {
    label: "Native <select> (use Radix Select primitive)",
    pattern: /<select\b/g,
    files: /\.tsx$/,
    skipAllowed: true,
  },
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walk(fullPath));
    } else if (/\.(tsx|ts|css)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

const issues = [];
const counts = {};
for (const file of walk(ROOT)) {
  const rel = relative(APP_ROOT, file);
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const check of checks) {
      if (!check.files.test(file)) continue;
      if (check.skipAllowed && isAllowed(file)) continue;
      if (check.pattern.test(line)) {
        counts[check.label] = (counts[check.label] || 0) + 1;
        issues.push({ file: rel, line: index + 1, label: check.label, source: line.trim() });
      }
      check.pattern.lastIndex = 0;
    }
  });
}

if (!issues.length) {
  console.log("Design-token audit: clean. No raw hex / rgba / raw-button / blue / tiny-text / !important / native-select found.");
  process.exit(0);
}

console.log("Design-token audit findings (by rule):");
for (const [label, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${label}`);
}
console.log(`\nTotal findings: ${issues.length}`);
if (STRICT) {
  console.log("\n--strict: failing build. First 40 findings:");
  for (const i of issues.slice(0, 40)) console.log(`- ${i.file}:${i.line} [${i.label}] ${i.source.slice(0, 100)}`);
  process.exit(1);
}
