#!/usr/bin/env node

/**
 * ai-git-config - 独立配置命令入口
 * 等价于 ai-git config
 */
import { runConfigCommand } from "./ai-config";

async function main(): Promise<void> {
  await runConfigCommand(process.argv.slice(2));
}

main();
