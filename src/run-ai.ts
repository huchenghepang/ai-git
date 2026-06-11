import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import AppConfig from "./config";
import { requestAi } from "./utils/ai";

async function main() {
  try {
    // 解析命令行参数
    const args = process.argv.slice(2);
    let forceJson = false;
    let prompt = "";
    let filePath = "";

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--forceJson" || args[i] === "--json") {
        forceJson = true;
      } else if (args[i] === "--file" || args[i] === "-f") {
        const temp = args[i + 1];
        if (temp && typeof temp === "string") {
          filePath = temp;
        }
        i++;
      } else if (args[i] === "--help" || args[i] === "-h") {
        console.log(`
用法: node run-ai.js [选项] <prompt>
   或: node run-ai.js [选项] --file <path>

选项:
  --forceJson, --json    强制输出 JSON 格式
  --file, -f <path>      从指定文件读取 prompt 内容 (解决命令行参数过长问题)
  --help, -h             显示帮助信息

示例:
  node run-ai.js "请写一首诗"
  node run-ai.js --json "分析这段代码"
  node run-ai.js --file ./report.md
  node run-ai.js --json --file ./large-report.md
        `);
        return;
      } else {
        // 收集所有非选项参数作为 prompt (兼容旧版直接传文本的方式)
        prompt = args.slice(i).join(" ");
        break;
      }
    }

    // 如果指定了文件，则从文件读取内容
    if (filePath) {
      const absolutePath = resolve(filePath);
      if (!existsSync(absolutePath)) {
        console.error(`❌ 错误: 找不到文件 ${absolutePath}`);
        process.exit(1);
      }
      try {
        prompt = readFileSync(absolutePath, "utf8");
        console.error(
          `📖 已从文件读取内容: ${absolutePath} (${prompt.length} 字符)`,
        );
      } catch (error: any) {
        console.error(`❌ 错误: 读取文件失败 - ${error.message}`);
        process.exit(1);
      }
    }

    if (!prompt) {
      console.error("❌ 错误: 必须提供 prompt 文本或使用 --file 指定文件");
      console.error(
        "用法: node run-ai.js [--forceJson] <prompt> 或 node run-ai.js --file <path>",
      );
      process.exit(1);
    }


    const MAX_CHARS = AppConfig.MAX_CHARS;
    if (prompt.length > MAX_CHARS) {
      console.error(
        `⚠️ 警告: 内容过长 (${prompt.length} 字符)，已截断至 ${MAX_CHARS} 字符以防超出 AI 上下文限制`,
      );
      prompt = `${prompt.slice(0, Math.max(0, MAX_CHARS))}\n\n... [内容已截断]`;
    }

    console.error(
      `📤 发送请求... (forceJson: ${forceJson}, 内容长度: ${prompt.length} 字符)`,
    );
    const result = await requestAi(
      prompt,
      { forceJson },
      {
        model: AppConfig.aiModel,
        apiKey: AppConfig.aiApiKey,
        url: AppConfig.aiUrl,
        timeout: AppConfig.timeout,
      },
    );
    console.log(result);
  } catch (error: any) {
    console.error("❌ 错误:", error.message);
    process.exit(1);
  }
}

main();
