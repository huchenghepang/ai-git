#!/usr/bin/env node

/**
 * ai-git CLI entry point
 * Git 变更上下文分析器
 */
import { runContext } from "./git-context";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
  ai-git - AI-powered Git 变更分析工具 🚀

  用法: ai-git [选项]

  选项:
    -a                 包含完整文件内容（默认截断至 50,000 行）
    -e                 启用 AI 分析模式（生成 commit message）
    -f <number>        设置文件最大行数（默认: 50000）
    -i                 交互模式（选择要包含的文件）
    -l <number>        设置 diff 上下文行数（默认: 3）
    -m <format>        输出格式（默认: md）
    -o <path>          输出文件路径
    -r                 禁用敏感信息脱敏
    -s                 跳过敏感信息检测
    -u                 上传到 AI 进行分析（需要设置 AI_API_KEY 和 AI_URL）
    -j                 强制 AI 输出 JSON 格式（需同时使用 -u）
    -h                 显示帮助信息

  示例:
    ai-git                         分析暂存区变更并生成报告
    ai-git -i                      交互模式选择文件
    ai-git -u                      分析并调用 AI 生成 commit message
    ai-git -u -j                   使用 JSON 格式进行 AI 代码审查
    ai-git -o ./report.md          指定输出文件路径

  环境变量:
    AI_API_KEY    AI 服务 API 密钥（使用 -u 时必填）
    AI_URL        AI 服务地址（使用 -u 时必填）
    AI_MODEL      AI 模型名称（默认: deepseek-v4-flash）
    AI_TIMEOUT    请求超时时间（默认: 30000）
    MAX_CHARS     AI 请求最大字符数（默认: 120000）

  更多信息: https://github.com/huchenghepang/ai-git
  `);
    process.exit(0);
  }

  try {
    await runContext();
  } catch (error) {
    console.error("❌ 错误:", error);
    process.exit(1);
  }
}

main();
