import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Agent Skill 的定义。
 * 对应于 `<skills-dir>/<skill-name>/SKILL.md` 目录。
 */
export interface Skill {
  /** 技能名称（取自目录名或 frontmatter） */
  name: string;
  /** 技能描述（取自 frontmatter，可选） */
  description: string;
  /** 技能所在目录的绝对路径 */
  dir: string;
  /** SKILL.md 的原始内容 */
  content: string;
  /** 来源类型：项目级 / 全局级 */
  scope: "project" | "global";
}

/**
 * 各层级需要扫描的 skills 根目录（相对/绝对）。
 * 每个目录下可能有 SKILL.md（单技能）或其子目录中的 SKILL.md（多技能）。
 */
const PROJECT_ROOTS = [
  ".agents",
  ".agents/skills",
  ".agent",
  ".agent/skills",
  ".trae",
  ".trae/skills",
  ".claude",
  ".claude/skills",
  "skills",
];
const GLOBAL_ROOTS = [
  join(homedir(), ".agents/skills"),
  join(homedir(), ".agent/skills"),
  join(homedir(), ".trae/skills"),
  join(homedir(), ".claude/skills"),
  join(homedir(), ".ai-git/skills"),
];

/** 从 SKILL.md 的 YAML frontmatter 中粗略提取 name / description */
function parseFrontmatter(content: string): {
  name: string;
  description: string;
} {
  const result = { name: "", description: "" };
  const m = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return result;

  const fm = m[1];
  for (const line of fm.split("\n")) {
    const name = line.match(/^\s*name\s*:\s*(.+)\s*$/i);
    if (name) result.name = name[1].trim().replace(/^["']|["']$/g, "");
    const desc = line.match(/^\s*description\s*:\s*(.+)\s*$/i);
    if (desc) result.description = desc[1].trim().replace(/^["']|["']$/g, "");
  }
  return result;
}

/**
 * 扫描一个 skills 根目录，收集其中所有 skill。
 * 支持两种布局：
 *  1. root/SKILL.md 直接位于根目录（单技能，目录名作为技能名）
 *  2. root/name/SKILL.md 位于子目录（多技能）
 */
function scanRoot(
  root: string,
  scope: "project" | "global",
  onError: (msg: string) => void,
  skills: Skill[],
): void {
  if (!existsSync(root)) return;

  let entries: string[] = [];
  try {
    entries = readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() || e.name === "SKILL.md")
      .map((e) => e.name);
  } catch (err) {
    onError(`读取技能目录失败: ${root} (${(err as Error).message})`);
    return;
  }

  for (const name of entries) {
    if (name === "SKILL.md") {
      // 单技能：根目录本身即技能
      const skillDir = root;
      const fallbackName = skillDir.split(/[\\/]/).filter(Boolean).pop() ?? "";
      readSkill(skillDir, scope, fallbackName, onError, skills);
    } else {
      // 子目录技能
      readSkill(join(root, name), scope, name, onError, skills);
    }
  }
}

function readSkill(
  dir: string,
  scope: "project" | "global",
  fallbackName: string,
  onError: (msg: string) => void,
  skills: Skill[],
): void {
  const skillFile = join(dir, "SKILL.md");
  if (!existsSync(skillFile)) return;

  try {
    const content = readFileSync(skillFile, "utf8");
    const fm = parseFrontmatter(content);
    skills.push({
      name: fm.name || fallbackName,
      description: fm.description,
      dir,
      content,
      scope,
    });
  } catch (err) {
    onError(`读取技能失败: ${skillFile} (${(err as Error).message})`);
  }
}

/**
 * 发现当前目录下所有可用的 agent skill（项目级 + 全局级）。
 * 项目级优先于全局级（同名时先保留项目级全覆盖）。
 *
 * @param cwd 项目根目录
 * @param onError 可选错误回调，用于收集扫描过程中的非致命错误信息
 * @returns 收集到的技能列表
 */
export function findSkills(
  cwd: string,
  onError?: (msg: string) => void,
): Skill[] {
  const skills: Skill[] = [];
  const report = onError ?? (() => {});

  for (const root of PROJECT_ROOTS) {
    scanRoot(join(cwd, root), "project", report, skills);
  }
  for (const root of GLOBAL_ROOTS) {
    scanRoot(root, "global", report, skills);
  }

  // 去除同名重复：项目级优先
  const seen = new Set<string>();
  return skills.filter((s) => {
    const key = s.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
