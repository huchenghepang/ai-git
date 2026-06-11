export interface AiRequestOptions {
  /**
   * 是否强制 JSON 输出
   */
  forceJson?: boolean;
  /**
   * 最大 输出token 数
   */
  maxTokens?: number;
  /**
   * 温度参数
   */
  temperature?: number;
}

export async function requestAi(
  prompt: string,
  options: AiRequestOptions = {},
  config: {
    model: string;
    apiKey: string;
    url: string;
    timeout: number;
  },
): Promise<string> {
  const { forceJson = false, maxTokens = 4096, temperature = 0.7 } = options;

  const body: {
    max_tokens: number;
    messages: { content: string; role: string }[];
    model: string;
    temperature: number;
    response_format?: { type: "json_object" };
    reasoning?: { enabled: boolean };
    thinking?: { type: "disabled" };
  } = {
    max_tokens: maxTokens,
    messages: [{ content: prompt, role: "user" }],
    model: config.model,
    temperature,
    // reasoning: { enabled: false },
  };
  //  if (config.model.includes("deepseek")) {
  //    body.reasoning = { enabled: false };
  //    // 或者使用其他参数名
  //    body.thinking = { type: "disabled" };
  //  }
  if (forceJson) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(config.url, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const json: any = await res.json();
  if (
    json &&
    json.choices &&
    Array.isArray(json.choices) &&
    json.choices.length > 0 &&
    json.choices[0].message &&
    json.choices[0].message.content
  ) {
    return json.choices[0].message.content;
  } else {
    throw new Error("AI response is not in expected format");
  }
}
