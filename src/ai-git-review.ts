#!/usr/bin/env node

/**
 * ai-git-review - Quick command: Full AI code review
 * Equivalent to ai-git -e -u -j
 */
import { runContext } from "./git-context";
import { applyLocaleFromArgs, t } from "./i18n";

// Preset -e -u -j parameters, reuse main entry's argument parsing logic
process.argv.push("-e", "-u", "-j");

// Apply locale before running
const localeArgs = process.argv.slice(2);
applyLocaleFromArgs(localeArgs);

try {
  await runContext();
} catch (error) {
  console.error(`❌ ${t("common.error")}:`, error);
  process.exit(1);
}