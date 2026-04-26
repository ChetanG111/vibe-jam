import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const modelsDir = path.join(root, "src", "assets", "models");

const MAX_PER_FILE_BYTES = 250 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

if (!fs.existsSync(modelsDir)) {
  process.exit(0);
}

const entries = fs.readdirSync(modelsDir, { withFileTypes: true });
const files = entries
  .filter((e) => e.isFile())
  .map((e) => path.join(modelsDir, e.name))
  .filter((p) => {
    const lower = p.toLowerCase();
    return lower.endsWith(".glb") || lower.endsWith(".gltf");
  });

let totalBytes = 0;
const overs = [];

for (const filePath of files) {
  const stat = fs.statSync(filePath);
  totalBytes += stat.size;
  if (stat.size > MAX_PER_FILE_BYTES) {
    overs.push(
      `${path.relative(root, filePath)} is ${formatBytes(stat.size)} (max ${formatBytes(MAX_PER_FILE_BYTES)})`,
    );
  }
}

if (totalBytes > MAX_TOTAL_BYTES) {
  overs.push(
    `Total model bytes ${formatBytes(totalBytes)} exceeds max ${formatBytes(MAX_TOTAL_BYTES)}`,
  );
}

if (overs.length) {
  console.error("\nModel asset budget exceeded:\n");
  for (const line of overs) console.error(`- ${line}`);
  console.error(
    `\nBudgets: per-file ${formatBytes(MAX_PER_FILE_BYTES)}, total ${formatBytes(MAX_TOTAL_BYTES)}\n`,
  );
  process.exit(1);
}

