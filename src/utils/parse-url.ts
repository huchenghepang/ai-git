/**
 * 将 AI 服务的基础 URL 转换为聊天补全接口地址。
 *
 * @param url - AI 服务的基础 URL（如 `https://api.openai.com`）
 * @returns 完整的聊天补全 API 端点 URL（如 `https://api.openai.com/chat/completions`）
 *
 * @example
 * ```ts
 * parseAiUrl("https://api.openai.com");
 * // => "https://api.openai.com/chat/completions"
 *
 * parseAiUrl("https://api.deepseek.com/v1");
 * // => "https://api.deepseek.com/chat/completions"
 * ```
 */
export function parseAiUrl(url: string) {
  const urlObj = new URL(url);
  return `${urlObj.origin}/chat/completions`;
}
