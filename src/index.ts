import { runContext } from "./git-context";

try {
  runContext();
} catch (error) {
  console.error("❌ 错误:", error);
}
