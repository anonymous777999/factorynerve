import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../src", import.meta.url));
const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const STRICT = process.argv.includes("--strict");

const checks = [
  { label: "Avoid 100vw / w-screen", pattern: /\b100vw\b|\bw-screen\b|\bw-\[100vw\]/g },
  {
    label: "Mobile min-width requires ResponsiveScrollArea review",
    pattern: /\bmin-w-\[[^\]]+\]/g,
    shouldReport: (line) => !/\b(?:sm|md|lg|xl|2xl):min-w-\[[^\]]+\]/.test(line),
  },
  { label: "Risky transform overflow", pattern: /\btranslate-x-full\b|\b-translate-x-full\b|\btranslateX\(/g },
  {
    label: "Raw horizontal overflow wrappers",
    pattern: /\boverflow-x-auto\b/g,
    shouldReport: (_line, file) => !/globals\.css$|responsive-scroll-area\.tsx$/.test(file),
  },
  {
    label: "Absolute/fixed offsets need viewport review",
    pattern: /\b(?:absolute|fixed)\b.*(?:left-\[-|right-\[-|top-\[-|bottom-\[-|translate-x-full|-translate-x-full|w-\[min\([^)]*(?:100%|100vw)|calc\(100vw)/g,
  },
];

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (/\.(tsx|ts|css)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

const issues = [];
for (const file of walk(ROOT)) {
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const check of checks) {
      if (check.pattern.test(line) && (!check.shouldReport || check.shouldReport(line, file))) {
        issues.push({
          file: relative(APP_ROOT, file),
          line: index + 1,
          label: check.label,
          source: line.trim(),
        });
      }
      check.pattern.lastIndex = 0;
    }
  });
}

if (!issues.length) {
  console.log("No mobile overflow audit patterns found.");
  process.exit(0);
}

console.log("Mobile overflow audit findings:");
for (const issue of issues) {
  console.log(`- ${issue.file}:${issue.line} [${issue.label}] ${issue.source}`);
}

console.log(`\nTotal findings: ${issues.length}`);
if (STRICT) {
  process.exit(1);
}
