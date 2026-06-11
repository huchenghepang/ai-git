#!/usr/bin/env node

/**
 * Post-build script to add shebang to bundled JS files.
 * bun build strips shebang from entry files, so we need to add it back
 * for the CLI binaries to work correctly.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "..", "dist");

const files = ["ai-git.js", "ai-git-review.js", "ai-run.js"];

for (const file of files) {
  const filePath = path.join(distDir, file);

  if (!fs.existsSync(filePath)) {
    console.error(`⚠️  File not found: ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(filePath, "utf8");

  if (!content.startsWith("#!/usr/bin/env node")) {
    fs.writeFileSync(filePath, "#!/usr/bin/env node\n" + content);
    console.log(`✅  Added shebang to ${file}`);
  } else {
    console.log(`✅  Shebang already exists in ${file}`);
  }

  // Make sure the file is executable
  try {
    fs.chmodSync(filePath, 0o755);
    console.log(`✅  Made ${file} executable`);
  } catch {
    console.warn(`⚠️  Could not chmod ${file}`);
  }
}

console.log("🎉 Post-build complete!");