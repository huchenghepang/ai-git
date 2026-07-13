# ai-git 🚀

AI-powered Git context analyzer — 自动分析 Git 暂存区变更，生成详细的 Markdown 报告，并支持 AI 生成 Commit Message 和代码审查。

[![GitHub](https://img.shields.io/badge/GitHub-huchenghepang/ai--git-blue?logo=github)](https://github.com/huchenghepang/ai-git)
[![npm version](https://img.shields.io/npm/v/@huchenghe/ai-git)](https://www.npmjs.com/package/@huchenghe/ai-git)
[![License](https://img.shields.io/npm/l/@huchenghe/ai-git)](LICENSE)

## 功能特性

- ✅ **Git 变更分析** — 自动分析 `git diff --cached` 暂存区变更
- ✅ **Markdown 报告** — 生成结构化的变更分析报告
- ✅ **敏感信息脱敏** — 自动检测并脱敏密码、Token、API Key 等敏感信息
- ✅ **交互模式** — 可选择性地包含特定文件
- ✅ **AI 集成** — 自动调用 AI 生成 Commit Message 和代码审查
- ✅ **剪贴板复制** — 自动复制报告或 Commit Message 到剪贴板
- ✅ **独立 AI 工具** — 提供独立的 `ai-run` 命令直接调用 AI 接口
- ✅ **多语言支持** — 支持中文（zh）和英文（en），可自动检测系统语言或手动设置

## 安装

### 全局安装（推荐）

```bash
npm install -g @huchenghe/ai-git
# 或
pnpm add -g @huchenghe/ai-git
```

安装后即可在任何 Git 仓库中使用 `ai-git` 命令。

### 项目内安装

```bash
npm install --save-dev @huchenghe/ai-git
# 或
pnpm add -D @huchenghe/ai-git
```

### 从源码安装

```bash
git clone https://github.com/huchenghepang/ai-git.git
cd ai-git
bun install
bun run build
npm link
```

## 快速开始

### 1. Git 变更分析

在任意 Git 仓库中，先暂存文件：

```bash
git add <file>
# 或
git add .
```

然后运行：

```bash
ai-git
```

这将分析暂存区变更并生成 Markdown 报告，同时自动复制到系统剪贴板。

### 2. 使用 AI 生成 Commit Message

单次会话设置环境变量：

```bash
export AI_API_KEY="your-api-key"
export AI_URL="https://api.deepseek.cn"
export AI_MODEL="deepseek-v4-flash"
```

全局设置 在 `~/.bashrc` 或 `~/.zshrc` 中添加：

```bash
export AI_API_KEY="your-api-key"
export AI_URL="https://api.deepseek.cn"
export AI_MODEL="deepseek-v4-flash"
```

然后运行：

```bash
ai-git -u
```

AI 会自动分析代码变更并生成符合 Conventional Commits 规范的 Commit Message。

### 3. 使用 JSON 格式进行 AI 代码审查

```bash
ai-git -e -u -j
```

这将输出详细的 JSON 格式代码审查报告，包含：
- 各维度评分（代码规范、复杂度、安全性、可维护性、测试覆盖、性能）
- 代码亮点和问题列表
- 综合评分和建议

## 命令参考

| 命令 | 说明 |
|------|------|
| `ai-git` | Git 变更上下文分析器（默认） |
| `ai-git-review` | 快捷命令：`ai-git -e -u -j` 一键完整 AI 审查 |
| `ai-run` | 独立的 AI 请求工具 |

### `ai-git` — Git 变更分析器

```bash
ai-git [选项]
```

| 选项 | 说明 |
|------|------|
| `-a` | 包含完整文件内容（不截断） |
| `-f <number>` | 设置文件最大行数（默认: 50000） |
| `-l <number>` | 设置 diff 上下文行数（默认: 3） |
| `-i` | 交互模式（选择要包含的文件） |
| `-o <path>` | 指定输出文件路径 |
| `-m <format>` | 输出格式（默认: md） |
| `-r` | 禁用敏感信息脱敏 |
| `-s` | 跳过敏感信息检测 |
| `-u` | 上传到 AI 进行分析 |
| `-j` | 强制 AI 输出 JSON 格式（需同时使用 `-u`） |
| `-L`, `--lang <zh|en>` | 设置输出语言（zh=中文，en=英文，默认自动检测系统语言） |
| `-h` | 显示帮助信息 |

**使用示例：**

```bash
# 基本分析
ai-git

# 交互模式选择文件
ai-git -i

# 指定输出文件
ai-git -o ./my-report.md

# AI 生成 commit message
ai-git -u

# AI 代码审查（JSON 格式）
ai-git -u -j

# 交互模式 + AI 审查
ai-git -i -u -j

# 包含完整文件内容
ai-git -a

# 切换语言为英文
ai-git -L en

# 切换语言为中文
ai-git --lang zh

# 英文 + AI 代码审查
ai-git -L en -u -j
```

### `ai-git-review` — 快捷命令：一键 AI 代码审查 🚀

等价于 `ai-git -e -u -j`，一步完成完整 AI 代码审查。

```bash
ai-git-review
```

直接输出 JSON 格式的代码审查报告，包含评分、问题列表、亮点和建议。

### `ai-run` — 独立 AI 请求工具

```bash
ai-run [选项] <prompt>
ai-run [选项] --file <path>
```

| 选项 | 说明 |
|------|------|
| `--json`, `--forceJson` | 强制输出 JSON 格式 |
| `--file <path>`, `-f <path>` | 从文件读取 prompt 内容 |
| `--help`, `-h` | 显示帮助信息 |

**使用示例：**

```bash
# 直接传入 prompt
ai-run "请写一首诗"

# 从文件读取
ai-run --file ./prompt.txt

# 强制 JSON 输出
ai-run --json "分析这段代码"
```

## 多语言设置 🌐

ai-git 支持**中文（zh）**和**英文（en）**两种语言，界面文本（终端输出、帮助信息、报告标题、提示文案等）会根据当前语言设置切换。

### 设置方式（优先级从高到低）

1. **命令行参数（最高优先级）**
   ```bash
   # 使用英文
   ai-git -L en
   ai-git --lang en

   # 使用中文
   ai-git -L zh
   ai-git --lang zh

   # 与其他参数组合使用
   ai-git -L en -u -j       # 英文 AI 代码审查
   ai-git -L zh -i           # 中文交互模式
   ```

2. **环境变量 `AI_GIT_LANG`**
   ```bash
   # 当前会话生效
   export AI_GIT_LANG=en
   ai-git

   # 单次命令生效
   AI_GIT_LANG=en ai-git -u
   ```

3. **系统语言自动检测（默认）**
   - 若 `LANG` / `LC_ALL` 以 `zh` 开头（如 `zh_CN.UTF-8`）→ 使用中文
   - 其他情况 → 使用英文

### 受影响的内容

| 项目 | 说明 |
|------|------|
| 终端输出 | 提示信息、成功/失败文案、帮助信息（`-h`） |
| Markdown 报告 | 报告标题、各章节标题、状态说明、截断提示 |
| AI 提示词模板 | 发送给 AI 的生成指令（commit message / code review） |
| 代码审查解析器 | 失败时的默认回退文案 |

### 支持的语言列表

| 值 | 语言 | 说明 |
|----|------|------|
| `zh` | 中文 | 简体中文界面 |
| `en` | 英文 | English interface |

### 开发者：添加新语言（项目贡献指南）

翻译资源位于 `src/i18n/locales/` 目录，结构如下：

```
src/i18n/
├── index.ts          # 核心 i18n 模块（语言检测、参数解析、t() 翻译函数）
└── locales/
    ├── zh.ts         # 中文翻译
    └── en.ts         # 英文翻译
```

添加新语言的步骤：

1. 在 `src/i18n/locales/` 下新建 `xx.ts`（xx 为语言代码，如 `ja`/`ko`/`fr`）
2. 参考 `zh.ts` 或 `en.ts`，翻译所有 key（`report.*`、`ai.*`、`cli.*` 等）
3. 在 `src/i18n/index.ts` 中注册：
   ```typescript
   import { xx } from "./locales/xx";

   const translations: Record<Locale, TranslationKeys> = {
     zh,
     en,
     xx, // 新增
   };

   export type Locale = "zh" | "en" | "xx";
   ```
4. 在 `detectLocale()` 中添加相应的系统语言匹配规则
5. 执行 `bun run build` 构建并测试

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AI_API_KEY` | AI 服务 API 密钥 | —（必填） |
| `AI_URL` | AI 服务地址（如 `https://api.openai.com`） | —（必填） |
| `AI_MODEL` | AI 模型名称 | `deepseek-v4-flash` |
| `AI_TIMEOUT` | 请求超时时间（毫秒） | `30000` |
| `MAX_CHARS` | AI 请求最大字符数 | `120000` |

### 环境变量配置示例

```bash
# 方式 1: 直接 export
export AI_API_KEY="sk-xxxxx"
export AI_URL="https://api.openai.com/v1"
export AI_MODEL="gpt-4"

# 方式 2: 单行执行
AI_API_KEY="sk-xxxxx" AI_URL="https://api.openai.com/v1" ai-git -u
```

## 输出示例

运行 `ai-git` 后，会在 `logs/commit/` 目录下生成类似如下的 Markdown 报告：

```markdown
# Git 变更分析报告
- 生成时间: 2026-06-11 12:00:00
- 仓库: my-project
- 分支: feature/new-feature

## 一、变更概览
### 统计信息
 3 files changed, 150 insertions(+), 20 deletions(-)

### 变更文件列表
M       src/utils/ai.ts
A       src/utils/parse-url.ts
M       src/index.ts

## 二、代码变更详情 (git diff --cached)
...
```

## 开发指南

### 本地开发

```bash
# 克隆项目
git clone https://github.com/huchenghepang/ai-git.git
cd ai-git

# 安装依赖
bun install

# 启动开发模式
bun src/index.ts
```

### 发布到 npm

```bash
# 一键发布（交互式选择版本）
bun run release

# 或直接指定版本类型
bun run release -- patch    # 补丁版本 1.0.0 → 1.0.1
bun run release -- minor    # 小版本    1.0.0 → 1.1.0
bun run release -- major    # 大版本    1.0.0 → 2.0.0
bun run release -- 2.0.0    # 自定义版本号

# 该命令会自动完成：
#   1. 检查 Git 工作区是否干净
#   2. 更新版本号
#   3. 执行构建
#   4. 发布到 npm
#   5. Git 打标签并推送
```

### 本地测试

发布前可在本地全局测试：

```bash
# 方式 1: 直接链接
npm link
# 然后在任意目录测试
ai-git --help

# 方式 2: 使用 .tgz 包
npm pack
npm install -g ./ai-git-1.0.0.tgz
```

## 技术栈

- [Bun](https://bun.com) — 运行时与构建工具
- [TypeScript](https://www.typescriptlang.org/) — 类型安全
- [simple-git](https://github.com/steveukx/git-js) — Git 操作
- [chalk](https://github.com/chalk/chalk) — 终端输出样式
- [clipboardy](https://github.com/sindresorhus/clipboardy) — 剪贴板操作
- [minimatch](https://github.com/isaacs/minimatch) — 文件匹配

## 许可证

[MIT](LICENSE)