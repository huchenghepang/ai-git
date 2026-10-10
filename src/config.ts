import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AppConfig, ProjectType } from "./types/config";
import { parseAiUrl } from "./utils/parse-url";

/**
 * 持久化配置文件结构（config.json）
 */
export interface StoredConfig {
  /** AI 服务 API 密钥（token） */
  aiApiKey?: string;
  /** AI 模型名称 */
  aiModel?: string;
  /** AI 服务基础地址（如 https://api.deepseek.com） */
  aiUrl?: string;
  /** 请求超时时间（ms） */
  timeout?: number;
  /** AI 请求最大字符数 */
  MAX_CHARS?: number;
  /** 默认语言 */
  language?: "zh" | "en";
  /** 是否忽略环境变量，让配置文件设置优先生效 */
  ignoreEnv?: boolean;
  /** 目标项目类型，用于内置审查提示词的侧重 */
  projectType?: ProjectType;
  /** 自定义审查提示词（最高优先级，追加在默认提示词之前） */
  customPrompt?: string;
  /** 已保存的多家 AI 提供商 */
  providers?: ProviderEntry[];
  /** 当前激活的提供商 id */
  activeProviderId?: string;
}

/** 单个已保存的 AI 提供商 */
export interface ProviderEntry {
  id: string;
  name: string;
  /** 基础地址 */
  url: string;
  /** API 密钥 */
  apiKey?: string;
  /** 模型 */
  model?: string;
  /** 超时（ms） */
  timeout?: number;
  /** 是否需要 API Key */
  needKey?: boolean;
}

/** 预置 AI 服务提供商，方便交互式选择 */
export interface ProviderPreset {
  name: string;
  url: string;
  /** 默认模型 */
  models: string[];
  /** 是否需要 API Key */
  needKey: boolean;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: "DeepSeek（深度求索）",
    url: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner"],
    needKey: true,
  },
  {
    name: "OpenAI",
    url: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
    needKey: true,
  },
  {
    name: "阿里云百炼 DashScope（Qwen）",
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-max", "qwen-turbo"],
    needKey: true,
  },
  {
    name: "硅基流动 SiliconFlow",
    url: "https://api.siliconflow.cn/v1",
    models: ["Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V3"],
    needKey: true,
  },
  {
    name: "智谱 GLM",
    url: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4-plus", "glm-4-air"],
    needKey: true,
  },
  {
    name: "OpenRouter（含 Claude/GPT/DeepSeek 等）",
    url: "https://openrouter.ai/api/v1",
    models: [
      "anthropic/claude-sonnet-4.6",
      "anthropic/claude-3-7-sonnet",
      "openai/gpt-4o",
    ],
    needKey: true,
  },
  {
    name: "Ollama（本地）",
    url: "http://localhost:11434/v1",
    models: ["llama3.1", "qwen2.5"],
    needKey: false,
  },
];

export const CONFIG_DIR =
  process.env.AI_GIT_CONFIG_DIR || join(homedir(), ".ai-git");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

/** 默认配置（当未设置任何值时的兜底） */
export function defaultConfig(): AppConfig {
  return {
    aiApiKey: "",
    aiModel: "deepseek-chat",
    aiUrl: parseAiUrl("https://api.deepseek.com"),
    timeout: 30_000,
    MAX_CHARS: 120_000,
    projectType: "other",
    customPrompt: "",
  };
}

/** 读取持久化配置文件，失败或不存在时返回空对象 */
export function readStoredConfig(): StoredConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return {};
    const raw = readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw || "{}") as StoredConfig;
  } catch {
    return {};
  }
}

/** 保存配置到文件 */
export function saveConfig(config: StoredConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
}

/** 获取当前激活的提供商（无激活或不存在时返回第一家） */
export function getActiveProvider(
  stored: StoredConfig,
): ProviderEntry | undefined {
  if (!Array.isArray(stored.providers) || stored.providers.length === 0) {
    return undefined;
  }
  return (
    stored.providers.find((p) => p.id === stored.activeProviderId) ??
    stored.providers[0]
  );
}

/**
 * 把某家提供商投影到顶层 legacy 字段（aiUrl/aiApiKey/aiModel/timeout），
 * 这样所有旧代码（resolveConfig、AI 调用等）无需改动即可跟随当前激活项。
 */
export function projectProvider(stored: StoredConfig, provider: ProviderEntry): void {
  stored.aiUrl = provider.url;
  stored.aiApiKey = provider.apiKey;
  stored.aiModel = provider.model;
  if (provider.timeout != null) stored.timeout = provider.timeout;
}

/**
 * 解析配置。
 * 优先级：环境变量 > 配置文件 > 默认值
 * 若配置中 ignoreEnv = true，则忽略环境变量，让配置文件优先生效。
 */
export function resolveConfig(stored?: StoredConfig): AppConfig {
  const s = stored ?? readStoredConfig();
  const defaultCfg = defaultConfig();

  const useEnv = !s.ignoreEnv;
  const envApiKey = useEnv ? process.env.AI_API_KEY : undefined;
  const envModel = useEnv ? process.env.AI_MODEL : undefined;
  const envUrl = useEnv ? process.env.AI_URL : undefined;
  const envTimeout = useEnv ? process.env.AI_TIMEOUT : undefined;
  const envMaxChars = useEnv ? process.env.MAX_CHARS : undefined;

  const baseUrl = envUrl ?? s.aiUrl ?? defaultCfg.aiUrl;
  const aiUrl = parseAiUrl(baseUrl);

  return {
    aiApiKey: envApiKey ?? s.aiApiKey ?? defaultCfg.aiApiKey,
    aiModel: envModel ?? s.aiModel ?? defaultCfg.aiModel,
    aiUrl,
    timeout: Number.parseInt(
      envTimeout ?? String(s.timeout ?? defaultCfg.timeout),
    ),
    MAX_CHARS: Number.parseInt(
      envMaxChars ?? String(s.MAX_CHARS ?? defaultCfg.MAX_CHARS),
    ),
    projectType: s.projectType ?? defaultCfg.projectType,
    customPrompt: s.customPrompt ?? defaultCfg.customPrompt,
  };
}

// 兼容旧用法：默认导出解析后的完整配置
const cachedConfig = resolveConfig();
export default cachedConfig;