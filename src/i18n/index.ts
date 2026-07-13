/**
 * i18n - 国际化模块
 * 支持中英文切换
 */
import { en } from "./locales/en";
import { zh } from "./locales/zh";

export type Locale = "zh" | "en";

export type TranslationKeys = typeof zh;

const translations: Record<Locale, TranslationKeys> = {
  zh,
  en,
};

let currentLocale: Locale = detectLocale();

function detectLocale(): Locale {
  const envLang = process.env.AI_GIT_LANG;
  if (envLang === "en" || envLang === "zh") return envLang;

  const systemLang = process.env.LANG || process.env.LC_ALL || "";
  if (systemLang.toLowerCase().startsWith("zh")) return "zh";
  return "en";
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function parseLocaleArg(args: string[]): Locale | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-L" || arg === "--lang") {
      const value = args[i + 1];
      if (value === "zh" || value === "en") {
        return value;
      }
    } else if (arg.startsWith("--lang=")) {
      const value = arg.slice(7);
      if (value === "zh" || value === "en") {
        return value;
      }
    }
  }
  return null;
}

export function stripLocaleArgs(args: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-L" || arg === "--lang") {
      i++;
      continue;
    }
    if (arg.startsWith("--lang=")) continue;
    result.push(arg);
  }
  return result;
}

type DeepString = string | DeepString[] | { [key: string]: DeepString };

function getNested(
  obj: Record<string, unknown>,
  path: string,
): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * 获取翻译文本
 * @param key 翻译键，支持点号表示嵌套路径，例如 "report.title"
 */
export function t(key: string): string {
  const dict = translations[currentLocale] as unknown as Record<
    string,
    unknown
  >;
  const fallback = translations.en as unknown as Record<string, unknown>;

  const value = getNested(dict, key);
  if (value !== undefined) return value;

  const fb = getNested(fallback, key);
  if (fb !== undefined) return fb;

  return key;
}

export function applyLocaleFromArgs(args: string[]): string[] {
  const parsed = parseLocaleArg(args);
  if (parsed) setLocale(parsed);
  return stripLocaleArgs(args);
}

export const availableLocales: Locale[] = ["zh", "en"];