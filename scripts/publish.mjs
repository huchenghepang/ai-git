#!/usr/bin/env node

/**
 * 一键发布到 npm
 *
 * 用法:
 *   bun run release            # 交互式选择版本类型
 *   bun run release -- patch   # 直接发布补丁版本
 *   bun run release -- minor   # 直接发布小版本
 *   bun run release -- major   # 直接发布大版本
 *   bun run release -- 1.2.3   # 指定具体版本号
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const pkgPath = new URL("../package.json", import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

function currentVersion() {
  return pkg.version;
}

async function askVersion() {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log(`\n📦 当前版本: v${currentVersion()}`);
  console.log(`\n选择版本类型:`);
  console.log(`  1) patch (补丁)  — v${currentVersion()} → v${bump("patch")}`);
  console.log(`  2) minor (小版本) — v${currentVersion()} → v${bump("minor")}`);
  console.log(`  3) major (大版本) — v${currentVersion()} → v${bump("major")}`);
  console.log(`  4) 自定义版本号`);

  const answer = await rl.question("\n请输入编号 (1-4, 默认 1): ");
  rl.close();

  const choice = answer.trim() || "1";

  switch (choice) {
    case "1":
      return "patch";
    case "2":
      return "minor";
    case "3":
      return "major";
    case "4": {
      const rl2 = createInterface({ input: stdin, output: stdout });
      const custom = await rl2.question("请输入版本号 (例如 2.0.0): ");
      rl2.close();
      return custom.trim();
    }
    default:
      return "patch";
  }
}

function bump(type) {
  const [major, minor, patch] = currentVersion().split(".").map(Number);
  switch (type) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      return type;
  }
}

async function main() {
  // ---- 1. 检查 git 工作区是否干净 ----
  try {
    const status = execSync("git status --porcelain", { encoding: "utf8" });
    if (status.trim()) {
      console.error("❌ 错误: Git 工作区有未提交的变更，请先提交或 stash");
      console.error(status);
      process.exit(1);
    }
  } catch {
    // 不在 git 仓库中也继续
  }

  // ---- 2. 确定版本号 ----
  const args = process.argv.slice(2);
  let versionArg = args[0];

  if (!versionArg) {
    versionArg = await askVersion();
  }

  const newVersion =
    ["patch", "minor", "major"].includes(versionArg)
      ? bump(versionArg)
      : versionArg;

  // ---- 3. 确认 ----
  const rl = createInterface({ input: stdin, output: stdout });
  const confirm = await rl.question(
    `\n🚀 即将发布 v${currentVersion()} → v${newVersion}\n确认发布? (Y/n): `,
  );
  rl.close();

  if (confirm.trim().toLowerCase() === "n") {
    console.log("❌ 已取消发布");
    process.exit(0);
  }

  // ---- 4. 更新版本号 ----
  console.log(`\n📝 更新版本号: v${currentVersion()} → v${newVersion}`);
  pkg.version = newVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

  // ---- 5. 构建 ----
  console.log("\n🔨 构建中...");
  run("bun run build");

  // ---- 6. 发布到 npm ----
  console.log("\n📦 发布到 npm...");

  // 检查是否需要 2FA OTP
  let otpCode = "";
  try {
    // 先试一次，看是否需要 OTP
    execSync("npm publish --dry-run", { stdio: "pipe" });
  } catch {
    // ignore
  }

  const tryPublish = (otp) => {
    const cmd = otp ? `npm publish --otp=${otp}` : "npm publish";
    try {
      execSync(cmd, { stdio: "inherit" });
      return true;
    } catch (err) {
      // 检查是否因为 2FA OTP 失败
      const status = err.status;
      const signal = err.signal;
      // execSync with inherit 不会捕获 stderr，但 exit code 非 0 即失败
      // 如果之前没传 OTP 且失败了，大概率是 2FA 要求
      // 如果传了 OTP 还失败，说明 OTP 错误
      if (!otp) return false; // 首次尝试，大概率需要 OTP
      // 传了 OTP 仍然失败
      console.error("\n❌ 发布失败。常见原因：");
      console.error("  1. OTP 验证码错误 — 请重新运行");
      console.error("  2. 没有登录 — 请先执行 npm login");
      console.error("  3. 包名冲突 — ai-git 可能已被占用");
      process.exit(1);
    }
  };

  if (!tryPublish("")) {
    console.log("\n🔐 检测到两步验证 (2FA)");
    console.log("请在 npm 认证器应用中查看验证码\n");
    const rl3 = createInterface({ input: stdin, output: stdout });
    otpCode = await rl3.question("请输入 npm OTP 验证码: ");
    rl3.close();
    tryPublish(otpCode);
  }

  // ---- 7. Git 打标签 ----
  try {
    console.log("\n🏷️  Git 打标签...");
    run(`git add package.json`);
    run(`git commit -m "chore: release v${newVersion}"`);
    run(`git tag -a v${newVersion} -m "v${newVersion}"`);
    run("git push && git push --tags");
    console.log(`\n✅ 标签 v${newVersion} 已推送到远程`);
  } catch {
    console.warn("\n⚠️  Git 操作失败，请手动提交和打标签");
  }

  console.log(`\n✅🎉 发布成功: v${newVersion}`);
  console.log(`   查看: https://www.npmjs.com/package/${pkg.name}`);
}

main().catch((err) => {
  console.error("❌ 发布失败:", err.message);
  process.exit(1);
});