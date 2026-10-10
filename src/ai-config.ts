#!/usr/bin/env node

/**
 * ai-git config - 配置管理命令
 * 用于通过 CLI 设置 AI 接口地址、token、模型等，并测试模型连接。
 *
 * 用法:
 *   ai-git config                交互式配置（推荐）
 *   ai-git config set           交互式配置（推荐）
 *   ai-git config set <key> <value>  设置单项
 *   ai-git config get [key]     查看配置
 *   ai-git config list          列出全部配置
 *   ai-git config test [model]  测试 AI 连接
 *   ai-git config unset <key>   删除配置项
 *   ai-git config --help        查看帮助
 */
import chalk from "chalk";
import { stdin as input, stdout as output } from "node:process";
import { emitKeypressEvents } from "node:readline";
import readline from "node:readline/promises";
import {
  CONFIG_PATH,
  getActiveProvider,
  projectProvider,
  PROVIDER_PRESETS,
  ProviderEntry,
  readStoredConfig,
  resolveConfig,
  saveConfig,
  type StoredConfig,
} from "./config";
import { applyLocaleFromArgs, t } from "./i18n";
import { requestAi } from "./utils/ai";

export const CONFIG_KEYS: {
  key: keyof StoredConfig;
  label: string;
  default?: string;
}[] = [
  { key: "aiUrl", label: "config.keyUrl" },
  { key: "aiApiKey", label: "config.keyToken" },
  { key: "aiModel", label: "config.keyModel" },
  { key: "timeout", label: "config.keyTimeout", default: "30000" },
  { key: "MAX_CHARS", label: "config.keyMaxChars", default: "120000" },
  { key: "language", label: "config.keyLang", default: "zh" },
  { key: "ignoreEnv", label: "config.keyIgnoreEnv", default: "false" },
];

const ACTIONS = [
  "set",
  "get",
  "list",
  "test",
  "unset",
  "add",
  "use",
  "select",
  "remove",
] as const;
type Action = (typeof ACTIONS)[number];

function maskSecret(value: string): string {
  if (value.length <= 8) return "********";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

function isSecretKey(key: string): boolean {
  return key === "aiApiKey";
}

function printHelp(): void {
  console.log(chalk.bold(t("config.title")));
  console.log(t("config.usage"));
  console.log("");
  console.log(chalk.bold(`${t("config.optionsTitle")}:`));
  console.log(`  ${t("config.cmdSet")}`);
  console.log(`  ${t("config.cmdSetVal")}`);
  console.log(`  ${t("config.cmdAdd")}`);
  console.log(`  ${t("config.cmdUse")}`);
  console.log(`  ${t("config.cmdList")}`);
  console.log(`  ${t("config.cmdRemove")}`);
  console.log(`  ${t("config.cmdTest")}`);
  console.log(`  ${t("config.cmdUnset")}`);
  console.log(`  ${t("config.cmdGet")}`);
  console.log("");

  // 提供商列表
  const activeCfg = readStoredConfig();
  const providers = Array.isArray(activeCfg.providers)
    ? activeCfg.providers
    : [];
  if (providers.length > 0) {
    const active = getActiveProvider(activeCfg);
    console.log(chalk.bold(`${t("config.providersTitle")}:`));
    providers.forEach((p, i) =>
      console.log(
        `  ${i + 1}) ${active && active.id === p.id ? chalk.yellow("● ") : ""}${p.name}  (${p.url})`,
      ),
    );
    console.log("");
  }

  console.log(chalk.bold(`${t("config.keys")}:`));
  for (const c of CONFIG_KEYS) {
    console.log(`  ${t(c.label)}`);
  }
}

function printConfig(
  stored: StoredConfig,
  resolved: ReturnType<typeof resolveConfig> = resolveConfig(),
): void {
  const env = (k: string) => {
    const map: Record<string, string> = {
      aiUrl: "AI_URL",
      aiApiKey: "AI_API_KEY",
      aiModel: "AI_MODEL",
      timeout: "AI_TIMEOUT",
      MAX_CHARS: "MAX_CHARS",
    };
    return map[k];
  };

  const providers = Array.isArray(stored.providers) ? stored.providers : [];
  if (providers.length > 0) {
    const active = getActiveProvider(stored);
    console.log(chalk.bold(`${t("config.providers")}:`));
    providers.forEach((p, i) => {
      const isActive = active && active.id === p.id;
      console.log(
        `  ${isActive ? chalk.yellow("●") : " "} ${i + 1}. ${p.name}${
          isActive ? chalk.yellow(` ${t("config.active")}`) : ""
        }`,
      );
      console.log(`       ${chalk.gray("URL")} ${p.url}`);
      if (p.model) console.log(`       ${chalk.gray("model")} ${p.model}`);
    });
    console.log("");
  }

  for (const c of CONFIG_KEYS) {
    const raw = stored[c.key];
    const resolvedVal = (resolved as Record<string, any>)[c.key];
    const envKey = env(c.key as string);
    const overridden =
      !stored.ignoreEnv &&
      envKey &&
      process.env[envKey] !== undefined &&
      process.env[envKey] !== "";

    let valueStr: string;
    if (raw === undefined || raw === "") {
      valueStr = chalk.gray(`(${t("config.notSet")})`);
    } else if (isSecretKey(c.key)) {
      valueStr = chalk.yellow(maskSecret(String(raw)));
    } else {
      valueStr = chalk.cyan(String(raw));
    }

    const effective =
      resolvedVal === undefined || resolvedVal === ""
        ? ""
        : isSecretKey(c.key)
          ? maskSecret(String(resolvedVal))
          : String(resolvedVal);

    console.log(
      `  ${chalk.bold(String(c.key))} = ${valueStr}${
        overridden
          ? chalk.gray(` ${t("config.envOverride")}${envKey}=${effective})`)
          : ""
      }`,
    );
  }
  console.log("");
  console.log(
    `${chalk.bold(t("config.filePath"))}: ${chalk.cyan(CONFIG_PATH)}`,
  );
}

function setSpecific(key: string, value: string): void {
  const stored = readStoredConfig();
  const validKeys = CONFIG_KEYS.map((c) => c.key as string);

  if (!validKeys.includes(key)) {
    console.error(chalk.red(`❌ ${t("config.invalidKey")}: ${key}`));
    printHelp();
    process.exit(1);
  }

  if (key === "timeout" || key === "MAX_CHARS") {
    const num = Number.parseInt(value);
    if (Number.isNaN(num) || num <= 0) {
      console.error(chalk.red(`❌ ${key} ${t("common.error")}: 数字格式无效`));
      process.exit(1);
    }
    (stored as any)[key] = num;
  } else if (key === "language") {
    if (value !== "zh" && value !== "en") {
      console.error(chalk.red(`❌ ${key}: zh 或 en`));
      process.exit(1);
    }
    (stored as any)[key] = value;
  } else if (key === "ignoreEnv") {
    if (value !== "true" && value !== "false") {
      console.error(chalk.red(`❌ ${key}: true 或 false`));
      process.exit(1);
    }
    (stored as any)[key] = value === "true";
  } else {
    (stored as any)[key] = value;
  }

  saveConfig(stored);
  console.log(
    chalk.green(
      `✅ ${t("config.setDone")}: ${key} = ${
        isSecretKey(key) ? maskSecret(value) : value
      }`,
    ),
  );
  console.log(`${chalk.gray(t("config.savedTo"))}: ${CONFIG_PATH}`);
}

/**
 * 交互式方向键选择（↑/↓ 移动、回车确认）。
 * 非 TTY 环境下自动降级为「输入数字」方式，保证脚本/管道可用。
 * 返回选中项的索引；用户按 Ctrl+C / Ctrl+D 时返回 -1。
 */
function selectIndex(
  labels: string[],
  options: { title?: string; defaultIndex?: number } = {},
): Promise<number> {
  const { title, defaultIndex = 0 } = options;

  // 非交互环境降级：输入数字
  if (!input.isTTY || !output.isTTY) {
    if (title) console.log(chalk.bold(title));
    labels.forEach((l, i) => console.log(`  ${i + 1}) ${l}`));
    return (async () => {
      const rl = readline.createInterface({ input, output });
      const ans = await rl.question(`> `);
      rl.close();
      const n = Number.parseInt(ans, 10);
      if (Number.isNaN(n) || n < 1) {
        return Math.min(Math.max(defaultIndex, 0), labels.length - 1);
      }
      return Math.min(n - 1, labels.length - 1);
    })();
  }

  return new Promise((resolve) => {
    let index = Math.min(Math.max(defaultIndex, 0), labels.length - 1);
    const count = labels.length;

    const paint = (initial = false) => {
      // 重绘时从最后一行上移回第一项（共 count 项，间隔 count-1 行）
      if (!initial) output.write(`\x1b[${count - 1}A`);
      for (let i = 0; i < count; i++) {
        output.write("\x1b[2K");
        output.write(
          i === index
            ? chalk.cyan(`  ❯ ${labels[i]}`)
            : chalk.gray(`    ${labels[i]}`),
        );
        if (i < count - 1) output.write("\n");
      }
    };

    const finish = (value: number) => {
      input.off("keypress", onKey);
      input.setRawMode(false);
      // 光标当前位于列表最后一行，落一行到列表下方即可
      output.write("\n");
      resolve(value);
    };

    const onKey = (_str: string, key: { name?: string; ctrl?: boolean }) => {
      if (!key) return;
      if (key.name === "up" && index > 0) {
        index--;
        paint();
      } else if (key.name === "down" && index < count - 1) {
        index++;
        paint();
      } else if (key.name === "return" || key.name === "enter") {
        finish(index);
      } else if (key.name === "c" && key.ctrl) {
        finish(-1);
        process.exit(130);
      } else if (key.name === "d" && key.ctrl) {
        finish(-1);
        process.exit(0);
      }
    };

    if (title) console.log(chalk.bold(title));
    paint(true);
    input.setRawMode(true);
    input.resume();
    emitKeypressEvents(input);
    input.on("keypress", onKey);
  });
}

async function interactiveWizard(targetKey?: string): Promise<void> {
  const stored = readStoredConfig();
  const resolved = resolveConfig(stored);
  let rl: ReturnType<typeof readline.createInterface> | null = null;

  try {
    if (!targetKey) {
      // 选择提供商（方向键选择，回车确认）
      const providerLabels = [
        ...PROVIDER_PRESETS.map((p) => `${p.name}  (${chalk.gray(p.url)})`),
        t("config.custom"),
        t("config.exit"),
      ];
      const providerIdx = await selectIndex(providerLabels, {
        title: chalk.bold(
          `\n${t("config.selectProvider")} (${t("config.arrowHint")})`,
        ),
      });
      if (providerIdx === -1 || providerIdx === providerLabels.length - 1) {
        return;
      }

      let baseUrl = "";
      let needKey = true;
      let defaultModel = "";
      rl = readline.createInterface({ input, output });
      if (providerIdx < PROVIDER_PRESETS.length) {
        const preset = PROVIDER_PRESETS[providerIdx];
        baseUrl = preset.url;
        needKey = preset.needKey;
        defaultModel = preset.models[0];
      } else {
        // 自定义输入地址
        baseUrl =
          (
            await rl.question(`${t("config.enterUrl")} (${resolved.aiUrl}): `)
          ).trim() || resolved.aiUrl;
        needKey = true;
      }

      // 模型选择
      let model = defaultModel;
      let apiKey = stored.aiApiKey ?? resolved.aiApiKey ?? "";

      if (needKey) {
        const keyAnswer = await rl.question(
          `${t("config.enterApiKey")}${apiKey ? ` (当前: ${maskSecret(apiKey)})` : ""}: `,
        );
        if (keyAnswer.trim()) apiKey = keyAnswer.trim();
      }

      const modelAnswer = await rl.question(
        `${t("config.enterModel")} (当前: ${resolved.aiModel}${model ? `, 默认: ${model}` : ""}): `,
      );
      if (modelAnswer.trim()) model = modelAnswer.trim();
      if (!model) model = resolved.aiModel;

      const timeoutAnswer = await rl.question(
        `${t("config.enterTimeout")} (${resolved.timeout}): `,
      );
      const timeout = Number.parseInt(timeoutAnswer) || resolved.timeout;

      rl.close();

      // 保存
      const next: StoredConfig = {
        ...stored,
        aiUrl: baseUrl,
        aiModel: model,
        timeout,
      };
      if (needKey) next.aiApiKey = apiKey;

      saveConfig(next);
      console.log(
        chalk.green(
          `\n✅ ${t("config.setDone")}: aiUrl/aiModel/aiApiKey/timeout`,
        ),
      );
      console.log(chalk.gray(`${t("config.savedTo")}: ${CONFIG_PATH}`));
      console.log(chalk.gray(`→ ${CONFIG_PATH}`));
      rl?.close();
      rl = null;
      return;
    }

    // 单项交互设置
    if (targetKey === "language") {
      const langIdx = await selectIndex(["zh (中文)", "en (English)"], {
        title: chalk.bold(
          `\n${t("config.selectLang")} (${t("config.arrowHint")})`,
        ),
        defaultIndex: stored.language === "en" ? 1 : 0,
      });
      if (langIdx >= 0) {
        (stored as any).language = langIdx === 1 ? "en" : "zh";
      }
    } else {
      rl = readline.createInterface({ input, output });
      if (targetKey === "aiUrl") {
        const answer = (
          await rl.question(`${t("config.enterUrl")} (${resolved.aiUrl}): `)
        ).trim();
        if (answer) (stored as any).aiUrl = answer;
      } else if (targetKey === "aiApiKey") {
        const answer = (
          await rl.question(
            `${t("config.enterApiKey")}${stored.aiApiKey ? ` (当前: ${maskSecret(stored.aiApiKey)})` : ""}: `,
          )
        ).trim();
        if (answer) (stored as any).aiApiKey = answer;
      } else if (targetKey === "aiModel") {
        const answer = (
          await rl.question(`${t("config.enterModel")} (${resolved.aiModel}): `)
        ).trim();
        if (answer) (stored as any).aiModel = answer;
      } else if (targetKey === "timeout") {
        const answer = await rl.question(
          `${t("config.enterTimeout")} (${resolved.timeout}): `,
        );
        const num = Number.parseInt(answer);
        if (!Number.isNaN(num) && num > 0) (stored as any).timeout = num;
      } else if (targetKey === "MAX_CHARS") {
        const answer = await rl.question(
          `${t("config.enterMaxChars")} (${resolved.MAX_CHARS}): `,
        );
        const num = Number.parseInt(answer);
        if (!Number.isNaN(num) && num > 0) (stored as any).MAX_CHARS = num;
      } else {
        console.error(chalk.red(`❌ ${t("config.invalidKey")}: ${targetKey}`));
        rl?.close();
        rl = null;
        process.exit(1);
      }
      rl?.close();
      rl = null;
    }

    saveConfig(stored);
    console.log(chalk.green(`✅ ${t("config.setDone")}: ${targetKey}`));
    console.log(chalk.gray(`${t("config.savedTo")}: ${CONFIG_PATH}`));
  } finally {
    if (rl) rl.close();
  }
}

async function testConnection(model?: string): Promise<void> {
  const stored = readStoredConfig();
  const resolved = resolveConfig(stored);

  const baseUrl = process.env.AI_URL || stored.aiUrl || "";
  const apiKey = process.env.AI_API_KEY || stored.aiApiKey || "";
  if (!baseUrl || !apiKey) {
    console.error(chalk.red(`❌ ${t("config.testNeedKey")}`));
    process.exit(1);
  }

  const modelName =
    model || process.env.AI_MODEL || stored.aiModel || resolved.aiModel;

  console.log(
    chalk.blue(
      `🔌 ${t("config.testSending")} model=${modelName}, url=${resolved.aiUrl}`,
    ),
  );
  try {
    const result = await requestAi(
      t("config.testPrompt"),
      { temperature: 0, maxTokens: 32 },
      {
        model: modelName,
        apiKey: resolved.aiApiKey,
        url: resolved.aiUrl,
        timeout: resolved.timeout,
      },
    );
    console.log(chalk.green(`\n✅ ${t("config.testOk")}`));
    console.log(chalk.gray(`  ${t("config.keyLabel")}: ${modelName}`));
    if (result) {
      const snippet = result.trim().slice(0, 120);
      console.log(chalk.gray(`  ${t("config.valueLabel")}: ${snippet}`));
    }
    process.exit(0);
  } catch (error: any) {
    console.error(chalk.red(`\n❌ ${t("config.testFail")}`));
    console.error(chalk.red(`  ${error?.message || error}`));
    process.exit(1);
  }
}

export async function runConfigCommand(args: string[]): Promise<void> {
  try {
    await runConfigCommandImpl(args);
  } catch (error: any) {
    console.error(
      chalk.red(`❌ ${t("common.error")}: ${error?.message || error}`),
    );
    process.exit(1);
  }
}

async function addProvider(): Promise<void> {
  const stored = readStoredConfig();
  const resolved = resolveConfig(stored);
  const providers = Array.isArray(stored.providers) ? stored.providers : [];

  const providerLabels = [
    ...PROVIDER_PRESETS.map((p) => `${p.name}  (${chalk.gray(p.url)})`),
    t("config.custom"),
    t("config.exit"),
  ];
  const providerIdx = await selectIndex(providerLabels, {
    title: chalk.bold(
      `\n${t("config.selectProvider")} (${t("config.arrowHint")})`,
    ),
  });
  if (providerIdx === -1 || providerIdx === providerLabels.length - 1) {
    return;
  }

  let baseUrl = "";
  let needKey = true;
  let defaultModel = "";
  let presetName = "";
  if (providerIdx < PROVIDER_PRESETS.length) {
    const preset = PROVIDER_PRESETS[providerIdx];
    baseUrl = preset.url;
    needKey = preset.needKey;
    defaultModel = preset.models[0];
    presetName = preset.name;
  }

  const rl = readline.createInterface({ input, output });
  const getLine = async (q: string) => {
    const a = await rl.question(q);
    return a.trim();
  };

  if (providerIdx >= PROVIDER_PRESETS.length) {
    baseUrl =
      (await getLine(`${t("config.enterUrl")} (${resolved.aiUrl}): `)) ||
      resolved.aiUrl;
    presetName = baseUrl;
  }

  const nameAnswer = await getLine(
    `${t("config.enterName")} (${presetName || baseUrl}): `,
  );
  if (nameAnswer) presetName = nameAnswer;

  let model = defaultModel;
  let apiKey = "";
  if (needKey) {
    apiKey = await getLine(`${t("config.enterApiKey")}: `);
  }
  const modelAnswer = await getLine(
    `${t("config.enterModel")} (${defaultModel || resolved.aiModel}): `,
  );
  if (modelAnswer) model = modelAnswer;
  if (!model) model = defaultModel || resolved.aiModel;

  const timeoutAnswer = await getLine(
    `${t("config.enterTimeout")} (${resolved.timeout}): `,
  );
  const timeout = Number.parseInt(timeoutAnswer) || resolved.timeout;
  rl.close();

  const id = `${(presetName || baseUrl).replace(/\s+/g, "-")}-${Date.now().toString(36)}`;
  const entry: ProviderEntry = {
    id,
    name: presetName,
    url: baseUrl,
    model,
    timeout,
    needKey,
  };
  if (needKey && apiKey) entry.apiKey = apiKey;

  providers.push(entry);
  stored.providers = providers;
  stored.activeProviderId = id;
  projectProvider(stored, entry);
  saveConfig(stored);

  console.log(chalk.green(`\n✅ ${t("config.addDone")}: ${entry.name}`));
  console.log(chalk.yellow(`   ${t("config.active")}: ${entry.name}`));
  console.log(chalk.gray(`${t("config.savedTo")}: ${CONFIG_PATH}`));
}

function warnEnvOverride(stored: StoredConfig): void {
  const overrides = ["AI_URL", "AI_MODEL", "AI_API_KEY"].filter(
    (k) => process.env[k] !== undefined && process.env[k] !== "",
  );
  if (overrides.length && !stored.ignoreEnv) {
    console.log(
      chalk.yellow(
        `⚠ ${t("config.envOverridesChosen")}: ${overrides.join(", ")}`,
      ),
    );
    console.log(chalk.gray(`   ${t("config.envFixHint")}`));
  }
}

function activateProvider(stored: StoredConfig, entry: ProviderEntry): void {
  stored.activeProviderId = entry.id;
  projectProvider(stored, entry);
  saveConfig(stored);
  console.log(chalk.green(`✅ ${t("config.useDone")}: ${entry.name}`));
  warnEnvOverride(stored);
}

async function setLanguageInteractive(stored: StoredConfig): Promise<void> {
  const langIdx = await selectIndex(["zh (中文)", "en (English)"], {
    title: chalk.bold(`\n${t("config.selectLang")} (${t("config.arrowHint")})`),
    defaultIndex: stored.language === "en" ? 1 : 0,
  });
  if (langIdx < 0) return;
  (stored as any).language = langIdx === 1 ? "en" : "zh";
  saveConfig(stored);
  console.log(
    chalk.green(`✅ ${t("config.setDone")}: language = ${stored.language}`),
  );
}

/**
 * 交互式选择当前使用的提供商；
 * 同时提供「新增一家」与「语言设置」入口，方便在配置时直接完成选择。
 */
async function useProviderInteractive(): Promise<void> {
  for (;;) {
    const stored = readStoredConfig();
    const providers = Array.isArray(stored.providers) ? stored.providers : [];

    if (providers.length === 0) {
      await addProvider();
      continue;
    }

    const labels = providers.map((p) => `${p.name}  (${p.url})`);
    const addLabel = t("config.useMenuAdd");
    const langLabel = t("config.useMenuLang");
    const exitLabel = t("config.exit");
    const all = [...labels, addLabel, langLabel, exitLabel];

    const active = getActiveProvider(stored);
    const activeIdx = active
      ? providers.findIndex((p) => p.id === active.id)
      : 0;
    const idx = await selectIndex(all, {
      title: chalk.bold(
        `\n${t("config.selectProviderUse")} (${t("config.arrowHint")})`,
      ),
      defaultIndex: Math.max(activeIdx, 0),
    });
    if (idx === -1 || idx === all.length - 1) return; // 退出
    if (idx === all.length - 3) {
      // 新增
      await addProvider();
      continue;
    }
    if (idx === all.length - 2) {
      // 语言设置
      await setLanguageInteractive(stored);
      continue;
    }
    // 选择已有提供商
    activateProvider(stored, providers[idx]);
    return;
  }
}

async function useProvider(arg?: string): Promise<void> {
  const stored = readStoredConfig();
  const providers = Array.isArray(stored.providers) ? stored.providers : [];
  if (providers.length === 0) {
    console.error(chalk.red(`❌ ${t("config.noProviders")}`));
    console.log(chalk.gray(`   ${t("config.addHint")}`));
    return;
  }

  if (arg) {
    const num = Number.parseInt(arg, 10);
    const found = Number.isNaN(num)
      ? providers.find((p) => p.id === arg || p.name === arg || p.url === arg)
      : providers[num - 1];
    if (!found) {
      console.error(chalk.red(`❌ ${t("config.providerNotFound")}: ${arg}`));
      return;
    }
    activateProvider(stored, found);
    return;
  }

  await useProviderInteractive();
}

function removeProvider(arg: string): void {
  const stored = readStoredConfig();
  const providers = Array.isArray(stored.providers) ? stored.providers : [];
  if (providers.length === 0) {
    console.error(chalk.red(`❌ ${t("config.noProviders")}`));
    return;
  }
  const num = Number.parseInt(arg, 10);
  const found = Number.isNaN(num)
    ? providers.find((p) => p.id === arg || p.name === arg || p.url === arg)
    : providers[num - 1];
  if (!found) {
    console.error(chalk.red(`❌ ${t("config.providerNotFound")}: ${arg}`));
    return;
  }
  const remaining = providers.filter((p) => p.id !== found.id);
  stored.providers = remaining.length ? remaining : undefined;
  if (stored.activeProviderId === found.id) {
    if (remaining.length) {
      stored.activeProviderId = remaining[0].id;
      projectProvider(stored, remaining[0]);
    } else {
      stored.activeProviderId = undefined;
      stored.aiUrl = undefined;
      stored.aiApiKey = undefined;
      stored.aiModel = undefined;
    }
  }
  saveConfig(stored);
  console.log(chalk.green(`✅ ${t("config.removeDone")}: ${found.name}`));
}

async function runConfigCommandImpl(args: string[]): Promise<void> {
  args = applyLocaleFromArgs(args);

  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    printHelp();
    process.exit(0);
  }

  // 无子命令时：交互式选择当前使用的提供商（可新增一家）
  if (args.length === 0) {
    await useProviderInteractive();
    process.exit(0);
  }

  const action = args[0] as Action;
  if (!ACTIONS.includes(action)) {
    console.error(chalk.red(`❌ ${t("config.invalidKey")}: ${action}`));
    printHelp();
    process.exit(1);
  }

  if (action === "list") {
    printConfig(readStoredConfig());
    process.exit(0);
  }

  if (action === "get") {
    const key = args[1];
    const stored = readStoredConfig();
    if (!key || key === "--all" || key === "-a") {
      printConfig(stored);
    } else {
      const resolved = resolveConfig(stored);
      const raw = (stored as any)[key];
      const eff = (resolved as any)[key];
      if (raw === undefined && eff === undefined) {
        console.log(chalk.gray(`${key} = (${t("config.notSet")})`));
      } else {
        const show = isSecretKey(key)
          ? maskSecret(String(raw ?? eff))
          : String(raw ?? eff);
        console.log(`${key} = ${show}`);
      }
    }
    process.exit(0);
  }

  if (action === "unset") {
    const key = args[1];
    if (!key) {
      console.error(chalk.red(`❌ 用法: ai-git config unset <key>`));
      process.exit(1);
    }
    const validKeys = CONFIG_KEYS.map((c) => c.key as string);
    if (!validKeys.includes(key)) {
      console.error(chalk.red(`❌ ${t("config.invalidKey")}: ${key}`));
      process.exit(1);
    }
    const stored = readStoredConfig();
    delete (stored as any)[key];
    saveConfig(stored);
    console.log(chalk.green(`✅ ${t("config.unsetDone")}: ${key}`));
    process.exit(0);
  }

  if (action === "test") {
    const model = args[1];
    await testConnection(model);
    return;
  }

  if (action === "add") {
    await addProvider();
    process.exit(0);
  }

  if (action === "use" || action === "select") {
    await useProvider(args[1]);
    process.exit(0);
  }

  if (action === "remove") {
    removeProvider(args[1]);
    process.exit(0);
  }

  // set
  const keyArg = args[1];
  const valueArg = args[2];
  if (keyArg) {
    if (valueArg !== undefined) {
      setSpecific(keyArg, valueArg);
      process.exit(0);
    } else {
      await interactiveWizard(keyArg);
    }
  } else {
    await interactiveWizard();
  }
  process.exit(0);
}