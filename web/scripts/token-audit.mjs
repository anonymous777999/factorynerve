#!/usr/bin/env node
/**
 * Scans web/src for legacy token violations. Fails if counts exceed baseline.
 * Run: node web/scripts/token-audit.mjs
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "src");
const BASELINE = {
  "var(--muted)": 500,
  "var(--text)": 200,
  "var(--border)": 200,
  "var(--accent)": 150,
  "rounded-[2rem]": 80,
  "text-rose-": 50,
  "rounded-3xl": 80,
};

const PATTERNS = Object.keys(BASELINE);

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      await walk(full, files);
    } else if (/\.(tsx|ts|css)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const counts = Object.fromEntries(PATTERNS.map((p) => [p, 0]));

const files = await walk(ROOT);
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const pattern of PATTERNS) {
    const re =
      pattern === "var(--text)"
        ? /var\(--text\)(?!-)/
        : pattern === "var(--border)"
          ? /var\(--border\)(?!-)/
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = text.match(re);
    if (matches) counts[pattern] += matches.length;
  }
}

console.log("Token Audit Results:");
let failed = false;
for (const pattern of PATTERNS) {
  const count = counts[pattern];
  const base = BASELINE[pattern];
  const ok = count <= base;
  if (!ok) failed = true;
  console.log(`  ${pattern}: ${count} (baseline: ${base}) ${ok ? "ok" : "FAIL"}`);
}
process.exit(failed ? 1 : 0);
