#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import AppConfig from "./config";
import { applyLocaleFromArgs, t } from "./i18n";
import { requestAi } from "./utils/ai";

async function main() {
  try {
    let args = process.argv.slice(2);
    args = applyLocaleFromArgs(args);

    // Parse command line arguments
    let forceJson = false;
    let prompt = "";
    let filePath = "";

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--forceJson" || args[i] === "--json") {
        forceJson = true;
      } else if (args[i] === "--file" || args[i] === "-f") {
        const temp = args[i + 1];
        if (temp && typeof temp === "string") {
          filePath = temp;
        }
        i++;
      } else if (args[i] === "--help" || args[i] === "-h") {
        console.log(`
${t("cli.usage")}: ${t("runAi.usagePrompt")}
   ${t("common.info").toLowerCase()}: ${t("runAi.usageFile")}

${t("cli.options")}:
  --forceJson, --json    ${t("runAi.optionForceJson")}
  --file, -f <path>      ${t("runAi.optionFile")}
  --help, -h             ${t("runAi.optionHelp")}

${t("cli.examples")}:
  node run-ai.js "${t("runAi.exampleBasic")}"
  node run-ai.js --json "${t("runAi.exampleJson")}"
  node run-ai.js --file ${t("runAi.exampleFile")}
  node run-ai.js --json --file ${t("runAi.exampleFileJson")}
        `);
        return;
      } else {
        // Collect all non-option arguments as prompt (compatible with old direct text passing)
        prompt = args.slice(i).join(" ");
        break;
      }
    }

    // If file specified, read content from file
    if (filePath) {
      const absolutePath = resolve(filePath);
      if (!existsSync(absolutePath)) {
        console.error(
          `❌ ${t("common.error")}: ${t("common.fileNotFound")} ${absolutePath}`,
        );
        process.exit(1);
      }
      try {
        prompt = readFileSync(absolutePath, "utf8");
        console.error(
          `📖 ${t("runAi.readFromFile")}: ${absolutePath} (${prompt.length} ${t("runAi.chars")})`,
        );
      } catch (error: any) {
        console.error(
          `❌ ${t("common.error")}: ${t("common.readFileFailed")} - ${error.message}`,
        );
        process.exit(1);
      }
    }

    if (!prompt) {
      console.error(`❌ ${t("common.error")}: ${t("runAi.needPrompt")}`);
      console.error(t("runAi.usageHint"));
      process.exit(1);
    }

    const MAX_CHARS = AppConfig.MAX_CHARS;
    if (prompt.length > MAX_CHARS) {
      console.error(
        `⚠️ ${t("runAi.contentTooLong")} (${prompt.length} ${t("runAi.chars")})，${t("runAi.truncatedHint")} ${MAX_CHARS} ${t("runAi.preventLimit")}`,
      );
      prompt = `${prompt.slice(0, Math.max(0, MAX_CHARS))}\n\n... [${t("runAi.contentTooLong")}]`;
    }

    console.error(
      `📤 ${t("runAi.sendingRequest")} (forceJson: ${forceJson}, ${t("runAi.contentLength")}: ${prompt.length} ${t("runAi.chars")})`,
    );
    const result = await requestAi(
      prompt,
      { forceJson },
      {
        model: AppConfig.aiModel,
        apiKey: AppConfig.aiApiKey,
        url: AppConfig.aiUrl,
        timeout: AppConfig.timeout,
      },
    );
    console.log(result);
  } catch (error: any) {
    console.error(`❌ ${t("common.error")}:`, error.message);
    process.exit(1);
  }
}

main();