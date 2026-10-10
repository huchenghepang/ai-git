/**
 * 将 AI 服务的基础 URL 转换为聊天补全接口地址。
 * 保留基础路径（如 /v1、/compatible-mode/v1），避免丢掉服务商兼容端点所需的路径段。
 *
 * @param url - AI 服务的基础 URL（如 `https://api.openai.com/v1`）
 * @returns 完整的聊天补全 API 端点 URL（如 `https://api.openai.com/v1/chat/completions`）
 *
 * @example
 * ```ts
 * parseAiUrl("https://api.openai.com");
 * // => "https://api.openai.com/chat/completions"
 *
 * parseAiUrl("https://api.deepseek.com/v1");
 * // => "https://api.deepseek.com/v1/chat/completions"
 *
 * parseAiUrl("https://api.example.com/v1/chat/completions");
 * // => "https://api.example.com/v1/chat/completions"（已是完整地址，原样返回）
 * ```
 */
export function parseAiUrl(url: string) {
  const base = url.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}