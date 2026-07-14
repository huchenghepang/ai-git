#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

import chalk from "chalk";
import { minimatch } from "minimatch";
import simpleGit, { type SimpleGit } from "simple-git";
import AiConfig from "./config";
import { applyLocaleFromArgs, t } from "./i18n";
import { requestAi } from "./utils/ai";
import {
  AICodeReviewParser,
  SimpleCommitParser,
  type Issue,
  type Recommendation,
} from "./utils/score";

// 替换原有的 clipboard 导入

// 创建一个包装函数来处理中文
/**
 * 复制文本到剪贴板。
 * 策略：先写入 UTF-8 文件，再通过系统命令从文件读取 → 复制。
 * 这样可以避免 pipe 编码问题（尤其是 WSL 中的中文乱码）。
 */
async function copyToClipboard(text: string): Promise<boolean> {
  const cleanText = text.replace(/\u0000/g, "");
  const { execSync, spawn } = await import("node:child_process");
  const fs = await import("node:fs");
  const platform = process.platform;

  // 记录本次操作创建的临时文件/目录，成功后统一清理
  const tempFilesToClean: string[] = [];

  function cmdExists(cmd: string): boolean {
    try {
      execSync(`which ${cmd} 2>/dev/null || true`, { stdio: "ignore" });
      return true;
    } catch {
      try {
        spawn(cmd, ["--version"], { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    }
  }

  function cleanup(): void {
    for (const f of tempFilesToClean) {
      try {
        if (fs.existsSync(f)) fs.rmSync(f, { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    }
  }

  // ============== Windows ==============
  if (platform === "win32") {
    try {
      // PowerShell：用 -Command 执行 Set-Clipboard
      const ps = spawn("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$input | Set-Clipboard",
      ]);
      ps.stdin.write(cleanText);
      ps.stdin.end();
      return new Promise<boolean>((resolve) => {
        ps.on("error", () => resolve(false));
        ps.on("close", (code) => {
          if (code === 0) {
            cleanup();
            resolve(true);
          } else {
            try {
              execSync("clip", { input: cleanText });
              cleanup();
              resolve(true);
            } catch {
              resolve(false);
            }
          }
        });
        setTimeout(() => resolve(false), 5000);
      });
    } catch {
      try {
        execSync("clip", { input: cleanText });
        cleanup();
        return true;
      } catch {
        return false;
      }
    }
  }

  // ============== macOS ==============
  if (platform === "darwin") {
    try {
      execSync("pbcopy", { input: cleanText, timeout: CLIPBOARD_TIMEOUT });
      cleanup();
      return true;
    } catch {
      return false;
    }
  }

  // ============== Linux（含 WSL） ==============
  if (platform === "linux") {
    // —— 方案 A：WSL PowerShell + Base64（最可靠！绕开所有编码问题） ——
    // 核心思路：把文本用 Base64 编码（纯 ASCII），嵌到 PowerShell 命令里
    // PowerShell 侧解码 Base64 → UTF8 → 设置剪贴板
    // 这样完全绕开 Linux ↔ Windows pipe 的编码转换
    if (cmdExists("powershell.exe")) {
      try {
        // 转 UTF-8 字节 → Base64
        const utf8Bytes = Buffer.from(cleanText, "utf8");
        const b64 = utf8Bytes.toString("base64");

        // 1) 先尝试整串 Base64 嵌到命令里（适用于 < 8K 的大部分情况）
        if (b64.length < 8000) {
          execSync(
            `powershell.exe -NoProfile -NonInteractive -Command "[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')) | Set-Clipboard"`,
            { stdio: "ignore", timeout: 5000 },
          );
          cleanup();
          return true;
        }

        // 2) 内容太长：写 UTF-8 文件到 /mnt/c/Windows/Temp，让 PowerShell 读
        const tempName = `ai-git-clip-${Date.now()}.txt`;
        try {
          fs.mkdirSync("/mnt/c/Windows/Temp/ai-git-clip", { recursive: true });
          const tf = `/mnt/c/Windows/Temp/ai-git-clip/${tempName}`;
          fs.writeFileSync(tf, cleanText, "utf8");
          tempFilesToClean.push(tf);
          tempFilesToClean.push("/mnt/c/Windows/Temp/ai-git-clip");

          // 用 wslpath 转成 Windows 路径
          const winPath = execSync(`wslpath -w "${tf}"`, {
            encoding: "utf8",
          }).trim();

          execSync(
            `powershell.exe -NoProfile -NonInteractive -Command "Get-Content '${winPath}' -Raw -Encoding UTF8 | Set-Clipboard; Remove-Item '${winPath}' -Force"`,
            { stdio: "ignore", timeout: 5000 },
          );
          cleanup();
          return true;
        } catch {
          // 如果写 /mnt/c 失败，回退到方案 B
        }
      } catch {
        // 继续
      }
    }

    // —— 方案 B：WSL 回退 —— clip.exe（可能有中文乱码，但可以复制 ASCII）
    if (cmdExists("clip.exe")) {
      try {
        // 用 UTF-8 BOM 让 clip.exe 正确识别编码
        const withBom = "\ufeff" + cleanText;
        execSync("clip.exe", {
          input: withBom,
          timeout: 3000,
          stdio: "ignore",
        });
        cleanup();
        return true;
      } catch {
        try {
          execSync("clip.exe", {
            input: cleanText,
            timeout: 3000,
            stdio: "ignore",
          });
          cleanup();
          return true;
        } catch {
          // 继续
        }
      }
    }

    // —— 方案 C：原生 Linux 剪贴板工具 ——
    if (cmdExists("xclip")) {
      try {
        execSync("xclip -selection clipboard", {
          input: cleanText,
          timeout: CLIPBOARD_TIMEOUT,
        });
        cleanup();
        return true;
      } catch {
        // 继续
      }
    }
    if (cmdExists("xsel")) {
      try {
        execSync("xsel --clipboard --input", {
          input: cleanText,
          timeout: CLIPBOARD_TIMEOUT,
        });
        cleanup();
        return true;
      } catch {
        // 继续
      }
    }
    if (cmdExists("wl-copy")) {
      try {
        execSync("wl-copy", { input: cleanText, timeout: CLIPBOARD_TIMEOUT });
        cleanup();
        return true;
      } catch {
        // 继续
      }
    }

    return false;
  }

  return false;
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// 1. 配置与常量
// ============================================
const CLIPBOARD_TIMEOUT = 3000;

const CONFIG = {
  aiAnalysis: true,
  detectSensitive: true,
  diffContext: 3,
  includeFullFiles: true,
  interactive: false,
  maxFileSize: 50_000,
  outputDir: "logs/commit",
  outputFile: "",
  outputFormat: "md",
  redactSensitive: true,
  uploadToAi: false,
  /**
   * 是否强制输出 JSON 格式
   * @default false
   */
  forceJson: false,
  /**
   * 是否将报告写入文件
   * - 默认: true（写入）
   * - 环境变量 `AI_GIT_NO_WRITE=1` 或 `AI_GIT_NO_WRITE=true` 可禁用
   * - 命令行 `-n` / `--no-write` 可禁用（最高优先级）
   * @default true
   */
  writeFile:
    process.env.AI_GIT_NO_WRITE !== "1" &&
    process.env.AI_GIT_NO_WRITE !== "true",
};

const EXCLUDE_PATTERNS = [
  "*.lock",
  "*.log",
  "*.tmp",
  "*.swp",
  "*.bak",
  "node_modules/**",
  "dist/**",
  "build/**",
  ".env*",
  "*.min.js",
  "*.min.css",
  "*.key",
  "*.pem",
  "*.crt",
  "*.p12",
];

const SENSITIVE_PATTERNS = [
  /password["\s:=]+[^"\s,;]+/gi,
  /secret["\s:=]+[^"\s,;]+/gi,
  /token["\s:=]+[^"\s,;]+/gi,
  /api[_-]?key["\s:=]+[^"\s,;]+/gi,
  /private[_-]?key["\s:=]+[^"\s,;]+/gi,
  /access[_-]?key["\s:=]+[^"\s,;]+/gi,
  /(mongodb|redis|mysql|postgresql):\/\/[^@]+@/gi,
  /database[_-]?url["\s:=]+[^"\s,;]+/gi,
];

// ============================================
// 2. 核心工具函数
// ============================================

// 检查文件是否应被排除
function shouldIncludeFile(filePath: string) {
  return !EXCLUDE_PATTERNS.some((pattern) =>
    minimatch(filePath, pattern, { matchBase: true }),
  );
}

// 获取文件语言
function getFileLang(filePath: string) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const langMap: Record<string, string> = {
    css: "css",
    env: "dotenv",
    go: "go",
    html: "html",
    java: "java",
    js: "javascript",
    json: "json",
    jsx: "javascript",
    md: "markdown",
    py: "python",
    rs: "rust",
    scss: "css",
    sh: "bash",
    sql: "sql",
    ts: "typescript",
    tsx: "typescript",
    yaml: "yaml",
    yml: "yaml",
  };
  return langMap[ext] || "text";
}

// 内容脱敏
function redactContent(content: string) {
  let redacted = content;
  for (const regex of SENSITIVE_PATTERNS) {
    regex.lastIndex = 0;
    redacted = redacted.replace(regex, (match) => {
      const splitIndex = match.includes(":")
        ? match.indexOf(":") + 1
        : match.indexOf("@");
      if (splitIndex !== -1) {
        return `${match.slice(0, Math.max(0, splitIndex))}***REDACTED***`;
      }
      return "***REDACTED***";
    });
  }
  return redacted;
}

// ============================================
// 3. 报告生成
// ============================================
async function generateMarkdownReport(
  git: SimpleGit,
  stagedFiles: string[],
  diffContent: string,
  shortstat: string,
  nameStatus: string,
  forceJson: boolean = false,
  fullAnalysis: boolean = false,
) {
  let branchName = "main (no commits yet)";
  let repoName = path.basename(await git.revparse(["--show-toplevel"]));

  try {
    branchName = await git.revparse(["--abbrev-ref", "HEAD"]);
  } catch (error) {
    // 空仓库，HEAD 不存在
    chalk.red(t("report.emptyRepo"));
    throw new Error(t("report.emptyRepo"));
  }

  let report = `# ${t("report.title")}\n`;
  report += `- ${t("report.generatedAt")}: ${new Date().toLocaleString()}\n`;
  report += `- ${t("report.repo")}: ${path.basename(await git.revparse(["--show-toplevel"]))}\n`;
  report += `- ${t("report.branch")}: ${await git.revparse(["--abbrev-ref", "HEAD"])}\n\n`;

  report += `## ${t("report.section1")}\n### ${t("report.statsInfo")}\n\`\`\`\n${shortstat}\n\`\`\`\n\n`;
  report += `### ${t("report.fileList")}\n\`\`\`\n${nameStatus}\n\`\`\`\n\n`;
  report += `## ${t("report.section2")}\n\`\`\`diff\n${diffContent}\n\`\`\`\n\n`;

  if (CONFIG.includeFullFiles) {
    report += `## ${t("report.section3")}\n\n`;

    for (const file of stagedFiles) {
      if (!shouldIncludeFile(file)) continue;

      try {
        const statusMatch = nameStatus.match(
          new RegExp(
            `^([MAD])\\s+${file.replaceAll(".", String.raw`\.`)}$`,
            "m",
          ),
        );

        const status = statusMatch ? statusMatch[1] : "M";

        let content: string;
        if (status === "D") {
          content = t("report.fileDeleted");
        } else {
          if (!fs.existsSync(file)) {
            content = t("report.fileNotExist");
          } else {
            content = fs.readFileSync(file, "utf8");
          }
        }

        const lines = content.split("\n").length;
        const lang = status === "D" ? "text" : getFileLang(file);

        if (status !== "D" && CONFIG.redactSensitive)
          content = redactContent(content);

        report += `### ${t("report.fileLabel")}: ${file} [${status}, ${lines} ${t("report.linesLabel")}]\n\`\`\`${lang}\n`;
        if (status === "D" || lines <= CONFIG.maxFileSize) {
          report += content;
        } else {
          report += content.split("\n").slice(0, CONFIG.maxFileSize).join("\n");
          report += `\n// ... [${t("report.truncatedHint")} ${lines} ${t("report.linesLabel")}, ${t("report.truncatedSuffix")} ${CONFIG.maxFileSize} ${t("report.truncatedEnd")}]\n`;
        }
        report += `\n\`\`\`\n\n`;
      } catch (error) {
        console.error(`${t("common.readFileFailed")}:`, error);
        // 忽略读取失败的文件（如已删除的文件）
      }
    }
  }
  if (fullAnalysis) {
    report += generateAIPrompt(forceJson, fullAnalysis);
  }

  return report;
}

async function performAiAnalysis(
  reportContent: string,
  outputFile: string,
  forceJson: boolean,
  aiConfig: {
    model: string;
    aiApiKey: string;
    aiModel: string;
    aiUrl: string;
    timeout: number;
  },
) {
  console.log(chalk.blue(`⚙️  ${t("ai.calling")}`));

  try {
    // 1. 直接调用 AI 接口
    const aiRawResult = await requestAi(
      reportContent,
      { forceJson },
      {
        model: aiConfig.model,
        apiKey: aiConfig.aiApiKey,
        url: aiConfig.aiUrl,
        timeout: aiConfig.timeout,
      },
    );

    if (!aiRawResult || aiRawResult.trim() === "")
      throw new Error(t("ai.emptyResponse"));

    let commitMsg = "";
    let score = 0;
    let recommendation: Recommendation = "conditional";
    let summary = "";
    let strengths: string[] = [];
    let issues: Issue[] = [];

    // 如果强制输出 JSON，使用解析器解析
    if (forceJson) {
      // 使用 AICodeReviewParser 解析
      const parsed = AICodeReviewParser.fromString(aiRawResult);

      commitMsg = parsed.commit_message_suggestion;
      score = parsed.total_score;
      recommendation = parsed.recommendation;
      summary = parsed.summary;
      strengths = parsed.strengths;
      issues = parsed.issues;

      // 控制台友好输出
      console.log(chalk.green("\n==========================================="));
      console.log(chalk.green(`📊 ${t("ai.result.summary")}`));
      console.log(chalk.green("==========================================="));
      console.log(
        chalk.blue(`💡 ${t("ai.result.suggestedCommit")}:`),
        commitMsg,
      );
      console.log(
        chalk.blue(`⭐ ${t("ai.result.codeQuality")}:`),
        `${score}/100`,
      );

      switch (recommendation) {
        case "approve":
          console.log(
            chalk.blue(
              `✅ ${t("ai.result.recommendationLabel")}: ${t("ai.result.approve")}`,
            ),
          );
          break;
        case "conditional":
          console.log(
            chalk.yellow(
              `⚠️ ${t("ai.result.recommendationLabel")}: ${t("ai.result.conditional")}`,
            ),
          );
          break;
        case "reject":
          console.log(
            chalk.red(
              `❌ ${t("ai.result.recommendationLabel")}: ${t("ai.result.reject")}`,
            ),
          );
          break;
        default:
          console.log(
            chalk.blue(`📝 ${t("ai.result.recommendationLabel")}:`),
            recommendation,
          );
      }

      // 显示代码亮点
      if (strengths.length > 0) {
        console.log(chalk.green(`\n✨ ${t("ai.result.highlights")}:`));
        strengths.forEach((s) => console.log(`  - ${s}`));
      }

      // 显示问题
      if (issues.length > 0) {
        const highIssues = issues.filter((i) => i.severity === "high");
        const mediumIssues = issues.filter((i) => i.severity === "medium");
        const lowIssues = issues.filter((i) => i.severity === "low");

        if (highIssues.length > 0) {
          console.log(chalk.red(`\n❌ ${t("ai.result.highPriority")}:`));
          highIssues.forEach((i) =>
            console.log(`  - ${i.file}:${i.line} - ${i.message}`),
          );
        }

        if (mediumIssues.length > 0) {
          console.log(chalk.yellow(`\n⚠️ ${t("ai.result.mediumPriority")}:`));
          mediumIssues.forEach((i) =>
            console.log(`  - ${i.file}:${i.line} - ${i.message}`),
          );
        }

        if (lowIssues.length > 0) {
          console.log(chalk.blue(`\nℹ️ ${t("ai.result.lowPriority")}:`));
          lowIssues.forEach((i) =>
            console.log(`  - ${i.file}:${i.line} - ${i.message}`),
          );
        }
      }

      console.log(chalk.green("===========================================\n"));

      // 追加到 Markdown 报告
      let aiSection = `\n## ${t("ai.result.failedSection").replace(" (解析失败)", "")}\n\n`;
      aiSection += `### 💡 ${t("ai.result.suggestedCommit")}\n\`\`\`bash\n${commitMsg}\n\`\`\`\n\n`;
      aiSection += `### 📊 ${t("ai.result.summary").replace("摘要", "")}\n`;
      aiSection += `- ${t("ai.result.codeQuality")}: ${score}/100\n`;
      aiSection += `- ${t("ai.result.recommendationLabel")}: ${recommendation}\n`;
      aiSection += `- ${t("parser.noSummary").replace("无摘要", "Summary")}: ${summary}\n\n`;

      // 添加代码亮点
      if (strengths.length > 0) {
        aiSection += `### ✨ ${t("ai.result.highlights")}\n`;
        strengths.forEach((s) => {
          aiSection += `- ${s}\n`;
        });
        aiSection += `\n`;
      }

      // 添加问题列表
      if (issues.length > 0) {
        aiSection += `### ⚠️ ${t("ai.result.issues")}\n\n`;
        aiSection += `| ${t("ai.result.severity")} | ${t("ai.result.fileName")} | ${t("ai.result.lineNo")} | ${t("ai.result.description")} | ${t("ai.result.suggestion")} |\n`;
        aiSection += `|---------|------|------|---------|---------|\n`;
        issues.forEach((issue) => {
          const severityIcon =
            issue.severity === "high"
              ? "🔴"
              : issue.severity === "medium"
                ? "🟡"
                : "🔵";
          aiSection += `| ${severityIcon} ${issue.severity} | ${issue.file} | ${issue.line} | ${issue.message} | ${issue.suggestion} |\n`;
        });
        aiSection += `\n`;
      }

      aiSection += `### 📝 ${t("ai.result.originalJson")}\n<details>\n<summary>${t("ai.result.expandRaw")}</summary>\n\n\`\`\`json\n${aiRawResult}\n\`\`\`\n</details>\n`;

      if (outputFile) {
        fs.appendFileSync(outputFile, aiSection, "utf8");
      }
      if (recommendation === "approve") {
        const copyOk = await copyToClipboard(commitMsg);
        if (copyOk) {
          console.log(chalk.green(`✅ ${t("common.copied")}`));
        } else {
          console.log(chalk.yellow(`⚠️ ${t("common.copyFailed")}`));
        }
      }
    } else {
      // 非 JSON 模式，使用简化解析器
      commitMsg = SimpleCommitParser.fromString(aiRawResult);

      // 控制台输出
      console.log(chalk.green("\n==========================================="));
      console.log(chalk.green(`📊 ${t("ai.result.simpleResult")}`));
      console.log(chalk.green("==========================================="));
      console.log(
        chalk.blue(`💡 ${t("ai.result.suggestedCommit")}:`),
        commitMsg,
      );
      console.log(chalk.green("===========================================\n"));

      // 追加到 Markdown 报告
      let aiSection = `\n## ${t("ai.result.simpleResult")}\n\n`;
      aiSection += `### 💡 ${t("ai.result.suggestedCommit")}\n\`\`\`bash\n${commitMsg}\n\`\`\`\n\n`;

      if (outputFile) {
        fs.appendFileSync(outputFile, aiSection, "utf8");
      }

      // 询问是否复制到剪贴板
      const can = await promptUserForCopy(commitMsg);
      if (can) {
        const copyOk = await copyToClipboard(commitMsg);
        if (copyOk) {
          console.log(chalk.green(`✅ ${t("common.copied")}`));
        } else {
          console.log(chalk.yellow(`⚠️ ${t("common.copyFailed")}`));
        }
      }
    }

    console.log(chalk.green(`✅ ${t("ai.result.appendedToReport")}`));
  } catch (error: any) {
    console.error(error);
    console.error(chalk.red(`❌ ${t("ai.analysisFailed")}:`), error.message);
    if (outputFile) {
      fs.appendFileSync(
        outputFile,
        `\n## ${t("ai.result.failedSection")}\n\`\`\`text\n${t("common.error")}: ${error.message}\n\n${t("ai.rawResult")}:\n${error.rawResult || t("common.unknown")}\n\`\`\`\n`,
        "utf8",
      );
    }
  }
}

// ============================================
// 5. 参数解析与主流程
// ============================================
function parseArgs() {
  const args = process.argv.slice(2);
  // 应用语言设置（同时从 args 中移除语言参数）
  const filteredArgs = applyLocaleFromArgs(args);

  for (let i = 0; i < filteredArgs.length; i++) {
    switch (filteredArgs[i]) {
      case "-a": {
        CONFIG.includeFullFiles = true;
        CONFIG.maxFileSize = 999_999;
        break;
      }
      case "-e": {
        CONFIG.aiAnalysis = true;
        break;
      }
      case "-E": {
        CONFIG.aiAnalysis = false;
        break;
      }
      case "-f": {
        const temp = filteredArgs[++i];
        if (temp) {
          CONFIG.maxFileSize = Number.parseInt(temp);
        }
        break;
      }
      case "-i": {
        CONFIG.interactive = true;
        break;
      }
      case "-l": {
        const temp = filteredArgs[++i];
        if (temp) {
          CONFIG.diffContext = Number.parseInt(temp);
        }
        break;
      }
      case "-m": {
        const temp = filteredArgs[++i];
        if (temp) {
          CONFIG.outputFormat = temp;
        }
        break;
      }
      case "-o": {
        const temp = filteredArgs[++i];
        if (temp) {
          CONFIG.outputFile = temp;
        }
        break;
      }
      case "-r": {
        CONFIG.redactSensitive = false;
        break;
      }
      case "-s": {
        CONFIG.detectSensitive = false;
        break;
      }
      case "-u": {
        CONFIG.uploadToAi = true;
        break;
      }
      case "-j": {
        CONFIG.forceJson = true;
        break;
      }
      case "-n":
      case "--no-write": {
        CONFIG.writeFile = false;
        break;
      }
      case "-h": {
        // 已在 index.ts 中处理，这里只是防止进入主流程
        break;
      }
    }
  }
}

export async function runContext() {
  parseArgs();
  const git = simpleGit();

  if (!(await git.checkIsRepo())) {
    console.error(
      chalk.red(`❌ ${t("common.error")}: ${t("common.notGitRepo")}`),
    );
    process.exit(1);
  }

  let tempStagedFiles = await git.diff(["--cached", "--name-only"]);
  let stagedFiles = tempStagedFiles.split("\n").filter(Boolean);

  if (stagedFiles.length === 0) {
    console.log(chalk.yellow(`⚠️ ${t("common.noStagedFiles")}`));
    process.exit(0);
  }

  // 交互模式
  if (CONFIG.interactive) {
    const rl = readline.createInterface({ input, output });
    console.log(chalk.blue(`\n📋 ${t("interactive.stagedFiles")}:`));
    stagedFiles.forEach((f, i) => console.log(`  ${i + 1}) ${f}`));
    const answer = await rl.question(`${t("interactive.selectPrompt")}: `);
    rl.close();

    if (answer.toLowerCase() !== "a") {
      const indices = answer
        .split(" ")
        .map(Number)
        .filter((n) => !isNaN(n));
      stagedFiles = indices
        .map((i) => stagedFiles[i - 1])
        .filter((f): f is string => typeof f === "string");
    }
  }

  console.log(
    chalk.green(
      `[Git ${t("cli.title").split(" - ")[0].replace("ai-git", "")}] ${t("interactive.analyzing").replace("{count}", String(stagedFiles.length))}`,
    ),
  );

  // 获取 Git 数据
  const diffContent = await git.diff(["--cached", `-U${CONFIG.diffContext}`]);
  const shortstat = await git.diff(["--cached", "--shortstat"]);
  const nameStatus = await git.diff(["--cached", "--name-status"]);

  // 生成报告
  console.log(chalk.blue(`⚙️  ${t("interactive.generating")}`));
  const report = await generateMarkdownReport(
    git,
    stagedFiles,
    diffContent,
    shortstat,
    nameStatus,
    CONFIG.forceJson,
    CONFIG.aiAnalysis,
  );

  // 处理输出路径
  if (CONFIG.writeFile) {
    if (!CONFIG.outputFile) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
      const timestamp = new Date()
        .toISOString()
        .replaceAll(/[:.]/g, "-")
        .slice(0, 19);
      CONFIG.outputFile = path.join(
        CONFIG.outputDir,
        `git_context_${timestamp}.md`,
      );
    }

    fs.writeFileSync(CONFIG.outputFile, report, "utf8");
  }

  // 复制到剪贴板
  const copySuccess = await copyToClipboard(report);
  if (copySuccess) {
    console.log(chalk.green(`✅ ${t("common.copiedToClipboard")}`));
  } else {
    console.log(chalk.yellow(`⚠️ ${t("common.copyFailed")}`));
    console.log(
      chalk.blue(
        `💡 ${t("clipboard.installHint")}: sudo apt install xclip | sudo pacman -S xclip | sudo dnf install xclip`,
      ),
    );
  }

  if (CONFIG.writeFile) {
    console.log(
      chalk.green(
        `✅ ${t("interactive.reportGenerated")}: ${CONFIG.outputFile}`,
      ),
    );
  } else {
    console.log(chalk.blue(`ℹ️  ${t("interactive.reportWriteSkipped")}`));
  }

  // AI 分析
  if (CONFIG.uploadToAi) {
    await performAiAnalysis(
      report,
      CONFIG.writeFile ? CONFIG.outputFile : "",
      CONFIG.forceJson,
      {
        model: AiConfig.aiModel,
        aiApiKey: AiConfig.aiApiKey,
        aiModel: AiConfig.aiModel,
        aiUrl: AiConfig.aiUrl,
        timeout: AiConfig.timeout,
      },
    );
  }

  // 显式退出，确保终端不会挂起（防止未关闭的子进程或其他资源导致进程残留）
  process.exit(0);
}

/**
 * 生成简化的 commit message 提示词
 */
function generateCommitMessagePrompt(): string {
  return `
## ${t("ai.prompt.sectionTitle")}

${t("ai.prompt.commitMsgTitle")}

**${t("ai.prompt.formatReq")}**:
- ${t("ai.prompt.formatDesc")}: \`<type>(<scope>): <subject>\`
- ${t("ai.prompt.typeDesc")}
- ${t("ai.prompt.subjectDesc")}
- ${t("ai.prompt.bodyDesc")}

**${t("ai.prompt.outputReq")}**:
- ${t("ai.prompt.outputDesc1")}
- ${t("ai.prompt.outputDesc2")}
- ${t("ai.prompt.outputDesc3")}

**${t("ai.prompt.outputExample")}**:
feat(utils): add AI request and URL parsing utilities

- Add requestAi function for API calls
- Add parseAiUrl for endpoint generation
- Support force JSON output option
`;
}

/**
 * 根据配置生成对应的提示词
 * @param forceJson 是否强制 JSON 输出
 * @param fullAnalysis 是否包含完整分析（当 forceJson 为 true 时有效）
 * @returns 生成的提示词
 */
function generateAIPrompt(
  forceJson: boolean = false,
  fullAnalysis: boolean = true,
): string {
  if (forceJson) {
    return generateAIAnalysisPrompt(fullAnalysis);
  } else {
    return generateCommitMessagePrompt();
  }
}

/**
 * 生成 AI 代码审查的 JSON 格式提示词
 * @param includeFullAnalysis 是否包含完整的分析维度（默认 true）
 * @returns 完整的 AI 提示词
 */
function generateAIAnalysisPrompt(includeFullAnalysis: boolean = true): string {
  if (!includeFullAnalysis) {
    // 简化版：只生成 commit message
    return `
## ${t("ai.prompt.sectionTitle")}

${t("ai.prompt.commitMsgTitle")}

**${t("ai.prompt.formatReq")}**:
- ${t("ai.prompt.formatDesc")}: \`<type>(<scope>): <subject>\`
- ${t("ai.prompt.typeDesc")}
- ${t("ai.prompt.subjectDesc")}
- ${t("ai.prompt.bodyDesc")}

**${t("ai.prompt.outputReq")}**:
- ${t("ai.prompt.outputDesc1")}
- ${t("ai.prompt.outputDesc2")}
- ${t("ai.prompt.outputDesc3")}

**${t("ai.prompt.outputExample")}**:
feat(utils): add AI request and URL parsing utilities

- Add requestAi function for API calls
- Add parseAiUrl for endpoint generation
- Support force JSON output option
`;
  }

  // 完整版：包含代码质量评估的 JSON 格式输出
  return `
## ${t("ai.prompt.analysisTask")}

${t("ai.prompt.analysisIntro")}

### ${t("ai.prompt.evalDimensions")}

#### 1. ${t("ai.prompt.codeStandard")} (15 ${t("common.info").toLowerCase() === "info" ? "points" : t("common.info")})
- ${t("ai.prompt.codeStandardDesc")}

#### 2. ${t("ai.prompt.complexity")} (25 points)
- ${t("ai.prompt.complexityDesc")}

#### 3. ${t("ai.prompt.security")} (20 points)
- ${t("ai.prompt.securityDesc")}

#### 4. ${t("ai.prompt.maintainability")} (15 points)
- ${t("ai.prompt.maintainabilityDesc")}

#### 5. ${t("ai.prompt.testing")} (15 points)
- ${t("ai.prompt.testingDesc")}

#### 6. ${t("ai.prompt.performance")} (10 points)
- ${t("ai.prompt.performanceDesc")}

### ${t("ai.prompt.outputFormat")}

${t("ai.prompt.outputFormatDesc")}:

{
  "total_score": 85,
  "dimensions": {
    "code_standard": 12,
    "complexity": 20,
    "security": 18,
    "maintainability": 13,
    "testing": 12,
    "performance": 10
  },
  "score_breakdown": {
    "code_standard": {
      "score": 12,
      "reason": "Code standards follow best practices"
    },
    "complexity": {
      "score": 20,
      "reason": "Code complexity meets requirements"
    },
    "security": {
      "score": 18,
      "reason": "Code meets security standards"
    },
    "maintainability": {
      "score": 13,
      "reason": "Code maintainability meets requirements"
    },
    "testing": {
      "score": 12,
      "reason": "Code test coverage meets requirements"
    },
    "performance": {
      "score": 10,
      "reason": "Code performance impact meets requirements"
    }
  },
  "recommendation": "approve",
  "issues": [
    {
      "severity": "high",
      "file": "src/auth.js",
      "line": 45,
      "message": "Issue description",
      "suggestion": "Fix suggestion"
    }
  ],
  "strengths": ["Strength 1", "Strength 2"],
  "summary": "Overall evaluation summary",
  "commit_message_suggestion": "feat(scope): subject"
}

### ${t("ai.prompt.scoreStandard")}
- 90-100 ${t("ai.prompt.scoreExcellent")}
- 70-89 ${t("ai.prompt.scoreGood")}
- 50-69 ${t("ai.prompt.scorePass")}
- 0-49 ${t("ai.prompt.scoreFail")}

### ${t("ai.prompt.recommendation")}
- "approve": ${t("ai.result.codeQuality")} ≥80 ${t("common.info") === "Info" ? "and" : t("common.info")} no high-priority issues
- "conditional": ${t("ai.result.codeQuality")} 60-79 ${t("common.info") === "Info" ? "or" : t("common.info")} has medium-priority issues
- "reject": ${t("ai.result.codeQuality")} <60 ${t("common.info") === "Info" ? "or" : t("common.info")} has high-priority security issues

**${t("ai.prompt.importantNote")}**
`;
}

async function promptUserForCopy(text: string): Promise<boolean> {
  try {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(
      `${t("common.askCopy")}\n${text}\n${t("common.confirmCopy")}: `,
    );
    rl.close();
    return answer === "y" || answer === "yes" || answer === "Y";
  } catch (error) {
    console.error(`❌ ${t("common.error")}:`, error);
    return false;
  }
}