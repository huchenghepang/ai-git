#!/usr/bin/env node

/**
 * ai-git CLI entry point
 * Git 变更上下文分析器
 */
import { runContext } from "./git-context";
import { applyLocaleFromArgs, getLocale, t } from "./i18n";

async function main() {
  let args = process.argv.slice(2);
  args = applyLocaleFromArgs(args);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
  ${t("cli.title")}

  ${t("cli.usage")}: ai-git [${t("cli.options").toLowerCase()}]

  ${t("cli.options")}:
    -a                 ${t("cli.optionFullContent")}
    -e                 ${t("cli.optionAiMode")}
    -f <number>        ${t("cli.optionMaxLines")}
    -i                 ${t("cli.optionInteractive")}
    -l <number>        ${t("cli.optionDiffContext")}
    -m <format>        ${t("cli.optionFormat")}
    -o <path>          ${t("cli.optionOutput")}
    -r                 ${t("cli.optionNoRedact")}
    -s                 ${t("cli.optionSkipSensitive")}
    -u                 ${t("cli.optionUploadAi")}
    -j                 ${t("cli.optionForceJson")}
    -L, --lang <zh|en> ${t("cli.optionLang")}
    -h                 ${t("cli.optionHelp")}

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
  } catch (error) {
    console.error(`❌ ${t("common.error")}:`, error);
    process.exit(1);
  }
}

main();