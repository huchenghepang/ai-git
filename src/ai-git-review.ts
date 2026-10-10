#!/usr/bin/env node

/**
 * ai-git-review - Quick command: Full AI code review
 * Equivalent to ai-git -e -u -j
 */
import { runContext } from "./git-context";
import { applyLocaleFromArgs, getLocale, t } from "./i18n";
import { getVersion } from "./utils/version";

const VERSION = getVersion();

// Handle -v / --version and -h / --help before running
const rawArgs = process.argv.slice(2);
if (rawArgs.includes("--version") || rawArgs.includes("-v")) {
  console.log(VERSION);
  process.exit(0);
}
const localeArgs = applyLocaleFromArgs(rawArgs);
if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
  console.log(`
ai-git-review - ${t("cli.reviewShortcut")} ${VERSION}

${t("cli.reviewShortcutDesc")}: ai-git -e -u -j

${t("cli.options")}:
  -v, --version  ${t("cli.optionVersion")}
  -h, --help     ${t("cli.optionHelp")}

${t("cli.moreInfo")}: https://github.com/huchenghepang/ai-git
${t("lang.current")}: ${getLocale()}
  `);
  process.exit(0);
}

// Preset -e -u -j parameters, reuse main entry's argument parsing logic
process.argv.push("-e", "-u", "-j");

try {
  await runContext();
} catch (error) {
  console.error(`❌ ${t("common.error")}:`, error);
  process.exit(1);
}