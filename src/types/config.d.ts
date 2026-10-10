/** 项目类型，用于选择内置的审查提示词侧重 */
export type ProjectType = "frontend" | "backend" | "other";

export interface AppConfig {
  aiApiKey: string;
  aiModel: string;
  aiUrl: string;
  timeout: number;
  MAX_CHARS: number;
  /** 目标项目类型，决定内置审查提示词的侧重 */
  projectType: ProjectType;
  /** 自定义提示词（追加到默认提示词之前，优先级别最高） */
  customPrompt: string;
}
