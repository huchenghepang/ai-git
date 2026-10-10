# ai-git 🚀

AI-powered Git context analyzer — 自动分析 Git 暂存区变更，生成详细的 Markdown 报告，并支持 AI 生成 Commit Message 和代码审查。

[![GitHub](https://img.shields.io/badge/GitHub-huchenghepang/ai--git-blue?logo=github)](https://github.com/huchenghepang/ai-git)
[![npm version](https://img.shields.io/npm/v/@huchenghe/ai-git)](https://www.npmjs.com/package/@huchenghe/ai-git)
[![License](https://img.shields.io/npm/l/@huchenghe/ai-git)](LICENSE)
[![en](https://img.shields.io/badge/English-README-informational)](README.en.md)

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

## 更新版本

### 全局安装（npm/pnpm）

```bash
# npm
npm update -g @huchenghe/ai-git

# 或 pnpm
pnpm update -g @huchenghe/ai-git
```

### 项目内安装

```bash
# npm
npm update @huchenghe/ai-git

# 或 pnpm
pnpm update @huchenghe/ai-git
```

### 检查当前版本

```bash
ai-git -v
# 或
npm list -g @huchenghe/ai-git
```

### 强制升级到最新版本

```bash
# npm
npm install -g @huchenghe/ai-git@latest

# 或 pnpm
pnpm add -g @huchenghe/ai-git@latest
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

> **推荐**：使用 `ai-git config` 交互式配置 AI 接口、Token 和模型，并可用 `ai-git config test` 测试连接（参考上文 `ai-git config` 章节）。

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
| `ai-git config` | 配置 AI 接口地址、Token、模型并测试连接 |
| `ai-git-review` | 快捷命令：`ai-git -e -u -j` 一键完整 AI 审查 |
| `ai-run` | 独立的 AI 请求工具 |

### `ai-git` — Git 变更分析器

```bash
ai-git [选项]
```

| 选项 | 说明 |
|------|------|
| `-a` | 包含完整文件内容（不截断） |
| `-e` | 启用 AI 分析模式（生成 commit message 提示词，**默认已启用**） |
| `-E` | 禁用 AI 分析模式（不添加 commit message 提示词） |
| `-f <number>` | 设置文件最大行数（默认: 50000） |
| `-l <number>` | 设置 diff 上下文行数（默认: 3） |
| `-i` | 交互模式（选择要包含的文件） |
| `-o <path>` | 指定输出文件路径 |
| `-m <format>` | 输出格式（默认: md） |
| `-r` | 禁用敏感信息脱敏 |
| `-s` | 跳过敏感信息检测 |
| `-u` | 上传到 AI 进行分析 |
| `-j` | 强制 AI 输出 JSON 格式（需同时使用 `-u`） |
| `-n`, `--no-write` | 不将报告写入文件（仅复制到剪贴板） |
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

### `ai-git config` — 配置管理与连接测试 ⚙️

无需手动编辑环境变量，通过 CLI 交互式配置 AI 接口地址、Token 和模型，并可测试连接。配置会持久化保存到 `~/.ai-git/config.json`。

```bash
# 交互式配置（推荐，内置常用提供商可选，也可自定义）
ai-git config
# 等价写法
ai-git config set

# 设置单项
ai-git config set aiUrl https://api.deepseek.com
ai-git config set aiApiKey sk-xxxx
ai-git config set aiModel deepseek-chat
ai-git config set timeout 30000
ai-git config set MAX_CHARS 120000
ai-git config set language zh

# 查看配置
ai-git config list         # 显示全部
ai-git config get aiModel  # 查看单项

# 删除配置项
ai-git config unset aiApiKey

# 测试 AI 连接（验证地址 + Token + 模型是否可用）
ai-git config test
ai-git config test deepseek-chat

# === 多提供商管理 ===
# 新增一家 AI 提供商（交互式选择并填写，自动设为当前使用）
ai-git config add
# 切换当前使用的提供商
ai-git config use            # 无参：方向键列出选择
ai-git config use 1          # 按序号快速切换
ai-git config use "OpenAI"   # 按名称/地址/id 快速切换
# 删除某家提供商
ai-git config remove 2
```

| 子命令 | 说明 |
|------|------|
| （无参数） | 默认进入交互式向导（选择提供商、输入 Token、模型、超时） |
| `set` | 交互式向导，等价于无参数；也可 `set <key> <value>` 设置单项 |
| `get [key]` | 查看配置（缺省显示全部，含被环境变量覆盖的提示） |
| `list` | 列出全部配置项与已保存的提供商（标记当前使用项） |
| `test [model]` | 发送真实请求测试 AI 连接是否正常 |
| `unset <key>` | 删除某个配置项 |
| `add` | 新增一家 AI 提供商（方向键选择，可保存多家） |
| `use [name\|index]` | 切换当前使用的提供商（无参时方向键列表选择） |
| `remove <name\|index>` | 删除某家已保存的提供商 |

> **多提供商说明**：`ai-git config add` 可保存多家 AI 服务（如 DeepSeek、OpenAI、Ollama 等），当前使用项用 `●` 标记。切换使用项后，所有 AI 调用（分析、Commit、审查）与 `ai-git config test` 都会自动跟随当前选中项，无需重新配置。
>
> **无参数 `ai-git config`**：直接进入「选择当前使用提供商」的交互菜单（方向键选择，可跳转新增一家或退出），不必再用单独的 `use` 子命令。

**环境变量说明**：默认优先级为 **环境变量（`AI_API_KEY`/`AI_URL`/`AI_MODEL`/`AI_TIMEOUT`/`MAX_CHARS`）> 配置文件 > 默认值**。
如果你已经全局设置了 `AI_URL`/`AI_MODEL`/`AI_API_KEY` 等环境变量，那么切换提供商、`config set` 的选择会被这些环境变量覆盖而「不生效」——这是设计使然（环境变量优先级更高）。

若希望**配置文件的选择生效**（忽略环境变量），运行：

```bash
# 让配置文件优先生效（忽略 AI_* 环境变量）
ai-git config set ignoreEnv true
# 恢复环境变量优先
ai-git config set ignoreEnv false
# 查看当前 ignoreEnv 状态
ai-git config get ignoreEnv
```

开启 `ignoreEnv` 后，`list` 不再显示「值被环境变量覆盖」，所有 AI 调用将严格使用 `config.json` 中当前激活的提供商。

也可使用独立命令 `ai-git-config`（等价于 `ai-git config`）。

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
| `AI_GIT_LANG` | 界面语言（`zh` 或 `en`） | 自动检测系统语言 |
| `AI_GIT_NO_WRITE` | 设为 `1` 或 `true` 时不将报告写入文件 | 未设置（即默认写入） |

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