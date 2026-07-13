# ai-git 🚀

AI-powered Git context analyzer — automatically analyzes `git diff --cached` changes in your staging area, generates a detailed Markdown report, and supports AI-generated Commit Messages and code review.

[![GitHub](https://img.shields.io/badge/GitHub-huchenghepang/ai--git-blue?logo=github)](https://github.com/huchenghepang/ai-git)
[![npm version](https://img.shields.io/npm/v/@huchenghe/ai-git)](https://www.npmjs.com/package/@huchenghe/ai-git)
[![License](https://img.shields.io/npm/l/@huchenghe/ai-git)](LICENSE)
[![zh](https://img.shields.io/badge/中文-README-red)](README.md)

## Features

- ✅ **Git Change Analysis** — Automatically analyzes `git diff --cached` staging area changes
- ✅ **Markdown Reports** — Generates structured change analysis reports
- ✅ **Sensitive Data Redaction** — Automatically detects and redacts passwords, tokens, API keys, and other sensitive information
- ✅ **Interactive Mode** — Selectively include specific files in the report
- ✅ **AI Integration** — Automatically calls AI to generate Commit Messages and code reviews
- ✅ **Clipboard Copy** — Automatically copies the report or Commit Message to the clipboard
- ✅ **Standalone AI Tool** — Provides the independent `ai-run` command for direct AI API calls
- ✅ **Multi-language Support** — Supports Chinese (zh) and English (en), with automatic system language detection or manual override

## Installation

### Global Installation (Recommended)

```bash
npm install -g @huchenghe/ai-git
# or
pnpm add -g @huchenghe/ai-git
```

After installation, the `ai-git` command is available in any Git repository.

### Per-Project Installation

```bash
npm install --save-dev @huchenghe/ai-git
# or
pnpm add -D @huchenghe/ai-git
```

### Installing from Source

```bash
git clone https://github.com/huchenghepang/ai-git.git
cd ai-git
bun install
bun run build
npm link
```

## Updating the Package

### Global Installation (npm/pnpm)

```bash
# npm
npm update -g @huchenghe/ai-git

# or pnpm
pnpm update -g @huchenghe/ai-git
```

### Per-Project Installation

```bash
# npm
npm update @huchenghe/ai-git

# or pnpm
pnpm update @huchenghe/ai-git
```

### Check the Current Version

```bash
ai-git -v
# or
npm list -g @huchenghe/ai-git
```

### Force Upgrade to the Latest Version

```bash
# npm
npm install -g @huchenghe/ai-git@latest

# or pnpm
pnpm add -g @huchenghe/ai-git@latest
```

## Quick Start

### 1. Git Change Analysis

In any Git repository, first stage your files:

```bash
git add <file>
# or
git add .
```

Then run:

```bash
ai-git
```

This analyzes the staged changes, generates a Markdown report, and automatically copies it to the system clipboard.

### 2. Using AI to Generate a Commit Message

Set environment variables for the current session:

```bash
export AI_API_KEY="your-api-key"
export AI_URL="https://api.deepseek.cn"
export AI_MODEL="deepseek-v4-flash"
```

Set globally by adding to `~/.bashrc` or `~/.zshrc`:

```bash
export AI_API_KEY="your-api-key"
export AI_URL="https://api.deepseek.cn"
export AI_MODEL="deepseek-v4-flash"
```

Then run:

```bash
ai-git -u
```

AI will automatically analyze the code changes and generate a Conventional Commits-compliant Commit Message.

### 3. AI Code Review in JSON Format

```bash
ai-git -e -u -j
```

This outputs a detailed JSON-formatted code review report, including:
- Dimension scores (code standards, complexity, security, maintainability, test coverage, performance)
- Code highlights and issue list
- Overall score and recommendations

## Command Reference

| Command | Description |
|---------|-------------|
| `ai-git` | Git change context analyzer (default) |
| `ai-git-review` | Quick command: `ai-git -e -u -j` — one-click full AI review |
| `ai-run` | Standalone AI request tool |

### `ai-git` — Git Change Analyzer

```bash
ai-git [options]
```

| Option | Description |
|--------|-------------|
| `-a` | Include full file content (no truncation) |
| `-f <number>` | Set maximum lines per file (default: 50000) |
| `-l <number>` | Set diff context lines (default: 3) |
| `-i` | Interactive mode (select files to include) |
| `-o <path>` | Specify output file path |
| `-m <format>` | Output format (default: md) |
| `-r` | Disable sensitive information redaction |
| `-s` | Skip sensitive information detection |
| `-u` | Upload to AI for analysis |
| `-j` | Force AI to output JSON format (requires `-u`) |
| `-n`, `--no-write` | Do not write report to file (clipboard only) |
| `-L`, `--lang <zh|en>` | Set output language (zh=Chinese, en=English, default: auto-detect system language) |
| `-h` | Show help information |

**Usage Examples:**

```bash
# Basic analysis
ai-git

# Interactive mode to select files
ai-git -i

# Specify output file
ai-git -o ./my-report.md

# AI-generated commit message
ai-git -u

# AI code review (JSON format)
ai-git -u -j

# Interactive mode + AI review
ai-git -i -u -j

# Include full file content
ai-git -a

# Switch language to English
ai-git -L en

# Switch language to Chinese
ai-git --lang zh

# English + AI code review
ai-git -L en -u -j
```

### `ai-git-review` — Quick Command: One-Click AI Code Review 🚀

Equivalent to `ai-git -e -u -j`, performs a complete AI code review in one step.

```bash
ai-git-review
```

Directly outputs a JSON-formatted code review report, including scores, issue list, highlights, and recommendations.

### `ai-run` — Standalone AI Request Tool

```bash
ai-run [options] <prompt>
ai-run [options] --file <path>
```

| Option | Description |
|--------|-------------|
| `--json`, `--forceJson` | Force JSON output |
| `--file <path>`, `-f <path>` | Read prompt content from file |
| `--help`, `-h` | Show help information |

**Usage Examples:**

```bash
# Pass prompt directly
ai-run "Write a poem"

# Read from file
ai-run --file ./prompt.txt

# Force JSON output
ai-run --json "Analyze this code"
```

## Multi-language Support 🌐

ai-git supports **Chinese (zh)** and **English (en)**. UI text (terminal output, help messages, report titles, prompts, etc.) switches based on the current language setting.

### Configuration Methods (Highest to Lowest Priority)

1. **Command-line Argument (Highest Priority)**
   ```bash
   # Use English
   ai-git -L en
   ai-git --lang en

   # Use Chinese
   ai-git -L zh
   ai-git --lang zh

   # Combined with other options
   ai-git -L en -u -j       # English AI code review
   ai-git -L zh -i           # Chinese interactive mode
   ```

2. **Environment Variable `AI_GIT_LANG`**
   ```bash
   # Current session only
   export AI_GIT_LANG=en
   ai-git

   # One-shot command
   AI_GIT_LANG=en ai-git -u
   ```

3. **Automatic System Language Detection (Default)**
   - If `LANG` / `LC_ALL` starts with `zh` (e.g., `zh_CN.UTF-8`) → Chinese
   - Otherwise → English

### Affected Content

| Item | Description |
|------|-------------|
| Terminal output | Messages, success/failure text, help info (`-h`) |
| Markdown reports | Report title, section titles, status messages, truncation hints |
| AI prompt templates | Generation instructions sent to AI (commit message / code review) |
| Code review parser | Default fallback messages on failure |

### Supported Languages

| Value | Language | Description |
|-------|----------|-------------|
| `zh`  | Chinese  | Simplified Chinese UI |
| `en`  | English  | English interface |

### Developers: Adding New Languages (Contribution Guide)

Translation resources are located under `src/i18n/locales/`:

```
src/i18n/
├── index.ts          # Core i18n module (language detection, arg parsing, t() function)
└── locales/
    ├── zh.ts         # Chinese translations
    └── en.ts         # English translations
```

Steps to add a new language:

1. Create `xx.ts` under `src/i18n/locales/` (xx is the language code, e.g., `ja`/`ko`/`fr`)
2. Refer to `zh.ts` or `en.ts`, translate all keys (`report.*`, `ai.*`, `cli.*`, etc.)
3. Register in `src/i18n/index.ts`:
   ```typescript
   import { xx } from "./locales/xx";

   const translations: Record<Locale, TranslationKeys> = {
     zh,
     en,
     xx, // add new
   };

   export type Locale = "zh" | "en" | "xx";
   ```
4. Add corresponding system language matching rules in `detectLocale()`
5. Run `bun run build` and test

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_API_KEY` | AI service API key | — (required) |
| `AI_URL` | AI service URL (e.g., `https://api.openai.com`) | — (required) |
| `AI_MODEL` | AI model name | `deepseek-v4-flash` |
| `AI_TIMEOUT` | Request timeout (ms) | `30000` |
| `MAX_CHARS` | Max characters for AI requests | `120000` |
| `AI_GIT_LANG` | UI language (`zh` or `en`) | Auto-detect system language |
| `AI_GIT_NO_WRITE` | Set to `1` or `true` to skip writing report to file | Not set (writes file by default) |

### Environment Variable Configuration Examples

```bash
# Method 1: direct export
export AI_API_KEY="sk-xxxxx"
export AI_URL="https://api.openai.com/v1"
export AI_MODEL="gpt-4"

# Method 2: one-liner
AI_API_KEY="sk-xxxxx" AI_URL="https://api.openai.com/v1" ai-git -u
```

## Output Examples

After running `ai-git`, a Markdown report similar to the following is generated under `logs/commit/`:

```markdown
# Git Change Analysis Report
- Generated at: 2026-06-11 12:00:00
- Repository: my-project
- Branch: feature/new-feature

## I. Change Overview
### Statistics
 3 files changed, 150 insertions(+), 20 deletions(-)

### Changed Files
M       src/utils/ai.ts
A       src/utils/parse-url.ts
M       src/index.ts

## II. Code Changes (git diff --cached)
...
```

## Development Guide

### Local Development

```bash
# Clone the project
git clone https://github.com/huchenghepang/ai-git.git
cd ai-git

# Install dependencies
bun install

# Start development mode
bun src/index.ts
```

### Publishing to npm

```bash
# One-click publish (interactive version selection)
bun run release

# Or specify version type directly
bun run release -- patch    # patch version 1.0.0 → 1.0.1
bun run release -- minor    # minor version 1.0.0 → 1.1.0
bun run release -- major    # major version 1.0.0 → 2.0.0
bun run release -- 2.0.0    # custom version number

# This command automatically:
#   1. Checks that the Git working tree is clean
#   2. Updates the version number
#   3. Executes the build
#   4. Publishes to npm
#   5. Git tags and pushes
```

### Local Testing

Before publishing, you can test globally:

```bash
# Method 1: direct link
npm link
# then test from any directory
ai-git --help

# Method 2: use .tgz package
npm pack
npm install -g ./ai-git-1.0.0.tgz
```

## Tech Stack

- [Bun](https://bun.com) — Runtime and build tool
- [TypeScript](https://www.typescriptlang.org/) — Type safety
- [simple-git](https://github.com/steveukx/git-js) — Git operations
- [chalk](https://github.com/chalk/chalk) — Terminal output styling
- [clipboardy](https://github.com/sindresorhus/clipboardy) — Clipboard operations
- [minimatch](https://github.com/isaacs/minimatch) — File pattern matching

## License

[MIT](LICENSE)