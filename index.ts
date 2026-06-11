#!/usr/bin/env node

/**
 * ai-git - AI-powered Git context analyzer
 *
 * CLI 入口文件。
 * 使用方式：
 *   ai-git        - 运行 Git 变更分析器
 *   ai-git --help - 显示帮助信息
 */

import { runContext } from "./src/git-context";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  ai-git - AI-powered Git 变更分析工具 🚀

  用法:
    ai-git [选项]          分析当前 Git 仓库的暂存区变更
    ai-run [选项] <prompt>  直接调用 AI 接口

  命令:
    ai-git     Git 变更上下文分析器（默认）
    ai-run     独立的 AI 请求工具

  环境变量:
    AI_API_KEY    AI 服务 API 密钥（必填）
    AI_URL        AI 服务地址（必填）
    AI_MODEL      AI 模型名称（默认: deepseek-v4-flash）
    AI_TIMEOUT    请求超时时间（默认: 30000ms）
    MAX_CHARS     最大字符数（默认: 120000）

  更多信息请查看: https://github.com/huchenghepang/ai-git
  `);
  process.exit(0);
}

try {
  await runContext();
} catch (error) {
  console.error("❌ 错误:", error);
  process.exit(1);
}