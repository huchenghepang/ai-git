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
import { requestAi } from "./utils/ai";
import {
  AICodeReviewParser,
  SimpleCommitParser,
  type Issue,
  type Recommendation,
} from "./utils/score";
// 替换原有的 clipboard 导入

// 创建一个包装函数来处理中文
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const cleanText = text.replace(/\u0000/g, "");
    const { execSync } = await import("node:child_process");
    const platform = process.platform;

    if (platform === "win32") {
      // Windows
      execSync("clip.exe", { input: cleanText });
    } else if (platform === "darwin") {
      // macOS
      execSync("pbcopy", { input: cleanText });
    } else if (platform === "linux") {
      // Linux - 使用系统命令
      if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
        console.warn(chalk.yellow("⚠️ 警告: 未检测到图形界面，无法使用剪贴板"));
        return false;
      }

      // 优先使用 xclip (X11)
      try {
        execSync("which xclip", { stdio: "ignore" });
        execSync("xclip -selection clipboard", { input: cleanText });
        return true;
      } catch {
        // 尝试 xsel (X11)
        try {
          execSync("which xsel", { stdio: "ignore" });
          execSync("xsel --clipboard --input", { input: cleanText });
          return true;
        } catch {
          // 尝试 wl-copy (Wayland)
          try {
            execSync("which wl-copy", { stdio: "ignore" });
            execSync("wl-copy", { input: cleanText });
            return true;
          } catch {
            console.error(chalk.red("❌ 复制失败: 未找到剪贴板工具"));
            console.log(
              chalk.blue("💡 请安装: sudo pacman -S xclip  (Arch Linux)"),
            );
            console.log(
              chalk.blue("   或: sudo apt install xclip  (Ubuntu/Debian)"),
            );
            return false;
          }
        }
      }
    } else {
      console.warn(chalk.yellow(`⚠️ 不支持的操作系统: ${platform}`));
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(chalk.red("❌ 复制失败:"), error.message);
    return false;
  }
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// 1. 配置与常量
// ============================================
const CONFIG = {
  aiAnalysis: false,
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
    chalk.red("空仓库，HEAD 不存在");
    throw new Error("空仓库，HEAD 不存在");
  }

  let report = `# Git 变更分析报告\n`;
  report += `- 生成时间: ${new Date().toLocaleString()}\n`;
  report += `- 仓库: ${path.basename(await git.revparse(["--show-toplevel"]))}\n`;
  report += `- 分支: ${await git.revparse(["--abbrev-ref", "HEAD"])}\n\n`;

  report += `## 一、变更概览\n### 统计信息\n\`\`\`\n${shortstat}\n\`\`\`\n\n`;
  report += `### 变更文件列表\n\`\`\`\n${nameStatus}\n\`\`\`\n\n`;
  report += `## 二、代码变更详情 (git diff --cached)\n\`\`\`diff\n${diffContent}\n\`\`\`\n\n`;

  if (CONFIG.includeFullFiles) {
    report += `## 三、涉及文件的完整内容（仅暂存区文件）\n\n`;

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

        let content = fs.readFileSync(file, "utf8");

        const lines = content.split("\n").length;
        const lang = getFileLang(file);

        if (CONFIG.redactSensitive) content = redactContent(content);

        report += `### 文件: ${file} [${status}, ${lines} 行]\n\`\`\`${lang}\n`;
        if (lines > CONFIG.maxFileSize) {
          report += content.split("\n").slice(0, CONFIG.maxFileSize).join("\n");
          report += `\n// ... [截断，共 ${lines} 行，仅显示前 ${CONFIG.maxFileSize} 行]\n`;
        } else {
          report += content;
        }
        report += `\n\`\`\`\n\n`;
      } catch (error) {
        console.error("读取文件失败:", error);
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
  console.log(chalk.blue("⚙️  正在调用 AI 分析代码变更..."));

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
      throw new Error("AI 返回为空");

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
      console.log(chalk.green("📊 AI 代码审查结果摘要"));
      console.log(chalk.green("==========================================="));
      console.log(chalk.blue(`💡 建议的 Commit Message:`), commitMsg);
      console.log(chalk.blue(`⭐ 代码质量评分:`), `${score}/100`);

      switch (recommendation) {
        case "approve":
          console.log(chalk.blue("✅ 推荐结论: 可以提交 (approve)"));
          break;
        case "conditional":
          console.log(chalk.yellow("⚠️ 推荐结论: 条件通过 (conditional)"));
          break;
        case "reject":
          console.log(chalk.red("❌ 推荐结论: 不建议提交 (reject)"));
          break;
        default:
          console.log(chalk.blue("📝 推荐结论:"), recommendation);
      }

      // 显示代码亮点
      if (strengths.length > 0) {
        console.log(chalk.green("\n✨ 代码亮点:"));
        strengths.forEach((s) => console.log(`  - ${s}`));
      }

      // 显示问题
      if (issues.length > 0) {
        const highIssues = issues.filter((i) => i.severity === "high");
        const mediumIssues = issues.filter((i) => i.severity === "medium");
        const lowIssues = issues.filter((i) => i.severity === "low");

        if (highIssues.length > 0) {
          console.log(chalk.red("\n❌ 高优先级问题:"));
          highIssues.forEach((i) =>
            console.log(`  - ${i.file}:${i.line} - ${i.message}`),
          );
        }

        if (mediumIssues.length > 0) {
          console.log(chalk.yellow("\n⚠️ 中优先级问题:"));
          mediumIssues.forEach((i) =>
            console.log(`  - ${i.file}:${i.line} - ${i.message}`),
          );
        }

        if (lowIssues.length > 0) {
          console.log(chalk.blue("\nℹ️ 低优先级问题:"));
          lowIssues.forEach((i) =>
            console.log(`  - ${i.file}:${i.line} - ${i.message}`),
          );
        }
      }

      console.log(chalk.green("===========================================\n"));

      // 追加到 Markdown 报告
      let aiSection = `\n## 五、AI 代码审查报告\n\n`;
      aiSection += `### 💡 建议的 Commit Message\n\`\`\`bash\n${commitMsg}\n\`\`\`\n\n`;
      aiSection += `### 📊 结果摘要\n`;
      aiSection += `- 总分: ${score}/100\n`;
      aiSection += `- 推荐: ${recommendation}\n`;
      aiSection += `- 摘要: ${summary}\n\n`;

      // 添加代码亮点
      if (strengths.length > 0) {
        aiSection += `### ✨ 代码亮点\n`;
        strengths.forEach((s) => {
          aiSection += `- ${s}\n`;
        });
        aiSection += `\n`;
      }

      // 添加问题列表
      if (issues.length > 0) {
        aiSection += `### ⚠️ 发现的问题\n\n`;
        aiSection += `| 严重程度 | 文件 | 行号 | 问题描述 | 修复建议 |\n`;
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

      aiSection += `### 📝 AI 原始返回 (JSON)\n<details>\n<summary>点击展开原始 JSON</summary>\n\n\`\`\`json\n${aiRawResult}\n\`\`\`\n</details>\n`;

      fs.appendFileSync(outputFile, aiSection, "utf-8");
      if (recommendation === "approve") {
        await copyToClipboard(commitMsg);
        console.log(chalk.green("✅ 已复制到剪贴板！"));
      }
    } else {
      // 非 JSON 模式，使用简化解析器
      commitMsg = SimpleCommitParser.fromString(aiRawResult);

      // 控制台输出
      console.log(chalk.green("\n==========================================="));
      console.log(chalk.green("📊 AI 分析结果"));
      console.log(chalk.green("==========================================="));
      console.log(chalk.blue(`💡 建议的 Commit Message:`), commitMsg);
      console.log(chalk.green("===========================================\n"));

      // 追加到 Markdown 报告
      let aiSection = "\n## 五、AI 分析结果\n\n";
      aiSection += `### 💡 建议的 Commit Message\n\`\`\`bash\n${commitMsg}\n\`\`\`\n\n`;

      fs.appendFileSync(outputFile, aiSection, "utf-8");

      // 询问是否复制到剪贴板
      const can = await promptUserForCopy(commitMsg);
      if (can) {
        await copyToClipboard(commitMsg);
        console.log(chalk.green("✅ 已复制到剪贴板！"));
      }
    }

    console.log(chalk.green("✅ AI 分析结果已追加到报告"));
  } catch (error: any) {
    console.error(chalk.red("❌ AI 分析或解析失败:"), error.message);
    // 如果解析失败，把原始结果也追加进去供人工排查
    fs.appendFileSync(
      outputFile,
      `\n## 五、AI 代码审查报告 (解析失败)\n\`\`\`text\n错误: ${error.message}\n\n原始返回:\n${error.rawResult || "无"}\n\`\`\`\n`,
      "utf-8",
    );
  }
}

// ============================================
// 5. 参数解析与主流程
// ============================================
function parseArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "-a": {
        CONFIG.includeFullFiles = true;
        CONFIG.maxFileSize = 999_999;
        break;
      }
      case "-e": {
        CONFIG.aiAnalysis = true;
        break;
      }
      case "-f": {
        const temp = args[++i];
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
        const temp = args[++i];
        if (temp) {
          CONFIG.diffContext = Number.parseInt(temp);
        }
        break;
      }
      case "-m": {
        const temp = args[++i];
        if (temp) {
          CONFIG.outputFormat = temp;
        }
        break;
      }
      case "-o": {
        const temp = args[++i];
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
      case "-h": {
        console.log("用法: node git-context.js [选项]");
        console.log(
          "选项: -a(完整) -f(截断行数) -l(diff上下文) -o(输出文件) -m(格式) -i(交互) -s(跳过检测) -r(跳过脱敏) -e(AI分析) -u(上传AI) -j(强制输出 JSON)",
        );
        process.exit(0);
      }
    }
  }
}

export async function runContext() {
  parseArgs();
  const git = simpleGit();

  if (!(await git.checkIsRepo())) {
    console.error(chalk.red("❌ 错误: 当前目录不是 Git 仓库"));
    process.exit(1);
  }

  let tempStagedFiles = await git.diff(["--cached", "--name-only"]);
  let stagedFiles = tempStagedFiles.split("\n").filter(Boolean);

  if (stagedFiles.length === 0) {
    console.log(chalk.yellow("⚠️ 没有暂存的文件"));
    process.exit(0);
  }

  // 交互模式
  if (CONFIG.interactive) {
    const rl = readline.createInterface({ input, output });
    console.log(chalk.blue("\n📋 暂存文件列表:"));
    stagedFiles.forEach((f, i) => console.log(`  ${i + 1}) ${f}`));
    const answer = await rl.question(
      "请输入要包含的文件编号（空格分隔，或 a 全选）: ",
    );
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
    chalk.green(`[Git 变更分析器] 检测到 ${stagedFiles.length} 个暂存文件`),
  );

  // 获取 Git 数据
  const diffContent = await git.diff(["--cached", `-U${CONFIG.diffContext}`]);
  const shortstat = await git.diff(["--cached", "--shortstat"]);
  const nameStatus = await git.diff(["--cached", "--name-status"]);

  // 生成报告
  console.log(chalk.blue("⚙️  生成 Markdown 报告..."));
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

  fs.writeFileSync(CONFIG.outputFile, report, "utf-8");

  // 复制到剪贴板
  try {
    await copyToClipboard(report);
    console.log(chalk.green("✅ 已成功复制到系统剪贴板！"));
  } catch {
    console.log(chalk.yellow("⚠️ 自动复制失败，请手动复制"));
  }

  console.log(chalk.green(`✅ 报告生成完成: ${CONFIG.outputFile}`));

  // AI 分析
  if (CONFIG.uploadToAi) {
    await performAiAnalysis(report, CONFIG.outputFile, CONFIG.forceJson, {
      model: AiConfig.aiModel,
      aiApiKey: AiConfig.aiApiKey,
      aiModel: AiConfig.aiModel,
      aiUrl: AiConfig.aiUrl,
      timeout: AiConfig.timeout,
    });
  }
}

/**
 * 生成简化的 commit message 提示词
 */
function generateCommitMessagePrompt(): string {
  return `
## 四、AI 生成指令

请根据以上代码变更生成 Commit Message：

**格式要求：**
- 格式: \`<type>(<scope>): <subject>\`
- type: feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert
- subject: 中文或英文，≤50字符
- body: 2-4行说明变更原因

**输出要求：**
- 只输出 commit message
- 不要额外解释
- 不要代码块标记

**输出示例：**
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
## 四、AI 生成指令

请根据以上代码变更生成 Commit Message：

**格式要求：**
- 格式: \`<type>(<scope>): <subject>\`
- type: feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert
- subject: 中文或英文，≤50字符
- body: 2-4行说明变更原因

**输出要求：**
- 只输出 commit message
- 不要额外解释
- 不要代码块标记

**输出示例：**
feat(utils): add AI request and URL parsing utilities

- Add requestAi function for API calls
- Add parseAiUrl for endpoint generation
- Support force JSON output option
`;
  }

  // 完整版：包含代码质量评估的 JSON 格式输出
  return `
## 代码变更质量分析任务

你是一个专业的代码审查专家，请对以上 Git 暂存区的代码变更进行全面的质量评估。

### 评估维度（总分100分）

#### 1. 代码规范 (15分)
- 命名规范（变量、函数、类名是否清晰有意义）
- 缩进和格式是否统一
- 是否遵循语言最佳实践

#### 2. 代码复杂度 (25分)
- 圈复杂度是否过高
- 函数长度是否合理（建议 ≤50 行）
- 嵌套层级是否过深（建议 ≤3 层）

#### 3. 安全性 (20分)
- 是否有 SQL 注入/XSS 风险
- 敏感信息是否正确处理
- 输入验证是否充分

#### 4. 可维护性 (15分)
- 代码是否易于理解和修改
- 是否有适当的注释
- 是否有硬编码值

#### 5. 测试覆盖 (15分)
- 是否便于测试
- 是否有边界条件处理
- 错误处理是否完善

#### 6. 性能影响 (10分)
- 是否有明显的性能问题
- 算法复杂度是否合理

### 输出格式要求

请**严格**按以下 JSON 格式输出，不要包含任何额外解释、思考过程或 markdown 标记：

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
      "reason": "代码规范符合最佳实践"
    },
    "complexity": {
      "score": 20,
      "reason": "代码复杂度符合要求"
    },
    "security": {
      "score": 18,
      "reason": "代码符合安全规范"
    },
    "maintainability": {
      "score": 13,
      "reason": "代码可维护性符合要求"
    },
    "testing": {
      "score": 12,
      "reason": "代码测试覆盖符合要求"
    },
    "performance": {
      "score": 10,
      "reason": "代码性能影响符合要求"
    }
  },
  "recommendation": "approve",
  "issues": [
    {
      "severity": "high",
      "file": "src/auth.js",
      "line": 45,
      "message": "问题描述",
      "suggestion": "修复建议"
    }
  ],
  "strengths": ["代码亮点1", "代码亮点2"],
  "summary": "总体评价摘要",
  "commit_message_suggestion": "feat(scope): subject"
}

### 评分标准
- 90-100分：优秀，直接提交
- 70-89分：良好，建议修复中低优先级问题
- 50-69分：及格，必须修复高优先级问题
- 0-49分：不合格，不建议提交

### recommendation 说明
- "approve": 总分 ≥80 且无高优先级问题
- "conditional": 总分 60-79 或有中优先级问题
- "reject": 总分 <60 或存在高优先级安全问题

**重要：只输出纯 JSON 对象，不要输出任何其他内容（包括 markdown 代码块标记、思考过程、解释文字等）。**
`;
}

async function promptUserForCopy(text: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(
      `是否将以下内容复制到剪贴板？\n${text}\n(y/n): `,
    );
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}