import type { AppConfig } from "./types/config";
import { parseAiUrl } from "./utils/parse-url";

if (!process.env.AI_API_KEY || !process.env.AI_URL) {
  throw new Error("AI_API_KEY, AI_URL cannot be empty");
}
const AiConfig: AppConfig = {
  aiApiKey: process.env.AI_API_KEY,
  aiModel: process.env.AI_MODEL || "deepseek-v4-flash",
  aiUrl: parseAiUrl(process.env.AI_URL),
  timeout: Number.parseInt(process.env.AI_TIMEOUT || "30000"),
};

export default AiConfig;
