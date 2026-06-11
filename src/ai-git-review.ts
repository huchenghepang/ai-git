#!/usr/bin/env node

/**
 * ai-git-review - 快捷命令：完整 AI 代码审查
 * 等价于 ai-git -e -u -j
 */
import { runContext } from "./git-context";

// 预置 -e -u -j 参数，复用主入口的参数解析逻辑
process.argv.push("-e", "-u", "-j");

try {
  await runContext();
} catch (error) {
  console.error("❌ 错误:", error);
  process.exit(1);
}