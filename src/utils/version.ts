import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 读取 package.json 中的版本号。
 * 兼容三种运行/打包路径：
 * - 源码运行: src/utils/version.ts -> 项目根 ../../package.json
 * - dist 编译后: dist/*.js -> 项目根 ../package.json
 * - 兜底：同目录下 package.json
 */
export function getVersion(): string {
  const pkgPaths = [
    join(__dirname, "..", "..", "package.json"),
    join(__dirname, "..", "package.json"),
    join(__dirname, "package.json"),
  ];
  for (const p of pkgPaths) {
    try {
      if (existsSync(p)) {
        const pkg = JSON.parse(readFileSync(p, "utf8"));
        if (pkg && pkg.version) return pkg.version;
      }
    } catch {
      // 继续尝试下一个
    }
  }
  return "unknown";
}