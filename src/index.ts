#!/usr/bin/env node

/**
 * ai-git CLI entry point
 * Git 变更上下文分析器
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runContext } from "./git-context";
import { applyLocaleFromArgs, getLocale, t } from "./i18n";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取 package.json 中的版本号（兼容源码运行和 dist 编译后两种路径）
function getVersion(): string {
  const pkgPaths = [
    join(__dirname, "..", "package.json"), // 源码运行: src/index.ts
    join(__dirname, "package.json"), // 安装后: dist/ai-git.js，package.json 在同级
    join(dirname(__dirname), "package.json"), // 备用：上一级
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

const VERSION = getVersion();

async function main() {
  let args = process.argv.slice(2);
  args = applyLocaleFromArgs(args);

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    process.exit(0);
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
  ${t("cli.title")}
  ${VERSION}

  ${t("cli.usage")}: ai-git [${t("cli.options").toLowerCase()}]

  ${t("cli.options")}:
    -a                 ${t("cli.optionFullContent")}
    -e                 ${t("cli.optionAiMode")}
    -E                 ${t("cli.optionAiModeDisable")}
    -f <number>        ${t("cli.optionMaxLines")}
    -i                 ${t("cli.optionInteractive")}
    -l <number>        ${t("cli.optionDiffContext")}
    -m <format>        ${t("cli.optionFormat")}
    -o <path>          ${t("cli.optionOutput")}
    -r                 ${t("cli.optionNoRedact")}
    -s                 ${t("cli.optionSkipSensitive")}
    -u                 ${t("cli.optionUploadAi")}
    -j                 ${t("cli.optionForceJson")}
    -n, --no-write     ${t("cli.optionNoWrite")}
    -L, --lang <zh|en> ${t("cli.optionLang")}
    -v, --version      ${t("cli.optionVersion")}
    -h, --help         ${t("cli.optionHelp")}

  ${t("cli.examples")}:
    ai-git                         ${t("cli.exampleBasic")}
    ai-git -i                      ${t("cli.exampleInteractive")}
    ai-git -u                      ${t("cli.exampleAi")}
    ai-git -u -j                   ${t("cli.exampleAiJson")}
    ai-git -o ./report.md          ${t("cli.exampleOutput")}

  ${t("cli.envVars")}:
    AI_API_KEY    ${t("cli.envApiKey")}
    AI_URL        ${t("cli.envUrl")}
    AI_MODEL      ${t("cli.envModel")}
    AI_TIMEOUT    ${t("cli.envTimeout")}
    MAX_CHARS     ${t("cli.envMaxChars")}

  ${t("cli.moreInfo")}: https://github.com/huchenghepang/ai-git
  ${t("lang.current")}: ${getLocale()}
  `);
    process.exit(0);
  }

  try {
    await runContext();
    process.exit(0);
  } catch (error) {
    console.error(`❌ ${t("common.error")}:`, error);
    process.exit(1);
  }
}

main();