// ============================================
// AI 代码审查响应解析类
// ============================================

/**
 * 问题严重程度
 */
type IssueSeverity = "high" | "medium" | "low";

/**
 * 推荐结论类型
 */
type Recommendation = "approve" | "conditional" | "reject";

/**
 * 单个维度的评分详情
 */
interface DimensionScore {
  score: number;
  reason: string;
}

/**
 * 各维度评分详情
 */
interface ScoreBreakdown {
  code_standard: DimensionScore;
  complexity: DimensionScore;
  security: DimensionScore;
  maintainability: DimensionScore;
  testing: DimensionScore;
  performance: DimensionScore;
}

/**
 * 各维度得分（仅分数）
 */
interface Dimensions {
  code_standard: number;
  complexity: number;
  security: number;
  maintainability: number;
  testing: number;
  performance: number;
}

/**
 * 代码问题项
 */
interface Issue {
  severity: IssueSeverity;
  file: string;
  line: number;
  message: string;
  suggestion: string;
}

/**
 * AI 代码审查完整响应格式
 */
interface AICodeReviewResponse {
  total_score: number;
  dimensions: Dimensions;
  score_breakdown: ScoreBreakdown;
  recommendation: Recommendation;
  issues: Issue[];
  strengths: string[];
  summary: string;
  commit_message_suggestion: string;
}

/**
 * AI 代码审查响应解析器
 * 可以从字符串、JSON、any 类型中安全地解析出符合类型的结果
 */
class AICodeReviewParser {
  private static readonly DEFAULT_DIMENSION_SCORE = {
    code_standard: 0,
    complexity: 0,
    security: 0,
    maintainability: 0,
    testing: 0,
    performance: 0,
  };

  private static readonly DEFAULT_DIMENSION_REASON = {
    code_standard: { score: 0, reason: "无法解析" },
    complexity: { score: 0, reason: "无法解析" },
    security: { score: 0, reason: "无法解析" },
    maintainability: { score: 0, reason: "无法解析" },
    testing: { score: 0, reason: "无法解析" },
    performance: { score: 0, reason: "无法解析" },
  };

  /**
   * 从字符串解析（支持 JSON 字符串或包含 JSON 的文本）
   */
  static fromString(input: string): AICodeReviewResponse {
    if (!input || input.trim() === "") {
      return this.getDefaultResponse();
    }

    try {
      // 尝试提取 JSON
      let jsonStr = input.trim();

      // 提取 markdown 代码块中的 JSON
      const jsonBlockMatch = input.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch && jsonBlockMatch[1]) {
        jsonStr = jsonBlockMatch[1].trim();
      } else {
        // 尝试提取纯 JSON 对象
        const jsonObjectMatch = input.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonStr = jsonObjectMatch[0];
        }
      }

      const parsed = JSON.parse(jsonStr);
      return this.fromAny(parsed);
    } catch (error) {
      console.warn("解析 JSON 失败，使用默认值:", error);
      return this.getDefaultResponse();
    }
  }

  /**
   * 从 any 类型解析
   */
  static fromAny(data: any): AICodeReviewResponse {
    if (!data || typeof data !== "object") {
      return this.getDefaultResponse();
    }

    return {
      total_score: this.safeNumber(data.total_score, 0),
      dimensions: this.parseDimensions(data.dimensions),
      score_breakdown: this.parseScoreBreakdown(data.score_breakdown),
      recommendation: this.parseRecommendation(data.recommendation),
      issues: this.parseIssues(data.issues),
      strengths: this.parseStringArray(data.strengths),
      summary: this.safeString(data.summary, "无摘要"),
      commit_message_suggestion: this.safeString(
        data.commit_message_suggestion,
        "chore: update code",
      ),
    };
  }

  /**
   * 从文件路径读取并解析（Bun 版本）
   */
  static async fromFile(filePath: string): Promise<AICodeReviewResponse> {
    try {
      // Bun 内置的 file 读取方式
      const file = Bun.file(filePath);
      const exists = await file.exists();

      if (!exists) {
        console.error(`文件不存在: ${filePath}`);
        return this.getDefaultResponse();
      }

      const content = await file.text();
      return this.fromString(content);
    } catch (error) {
      console.error(`读取文件失败: ${filePath}`, error);
      return this.getDefaultResponse();
    }
  }

  /**
   * 解析 dimensions
   */
  private static parseDimensions(dimensions: any): Dimensions {
    if (!dimensions || typeof dimensions !== "object") {
      return { ...this.DEFAULT_DIMENSION_SCORE };
    }

    return {
      code_standard: this.safeNumber(dimensions.code_standard, 0),
      complexity: this.safeNumber(dimensions.complexity, 0),
      security: this.safeNumber(dimensions.security, 0),
      maintainability: this.safeNumber(dimensions.maintainability, 0),
      testing: this.safeNumber(dimensions.testing, 0),
      performance: this.safeNumber(dimensions.performance, 0),
    };
  }

  /**
   * 解析 score_breakdown
   */
  private static parseScoreBreakdown(breakdown: any): ScoreBreakdown {
    if (!breakdown || typeof breakdown !== "object") {
      return { ...this.DEFAULT_DIMENSION_REASON };
    }

    return {
      code_standard: this.parseDimensionScore(breakdown.code_standard),
      complexity: this.parseDimensionScore(breakdown.complexity),
      security: this.parseDimensionScore(breakdown.security),
      maintainability: this.parseDimensionScore(breakdown.maintainability),
      testing: this.parseDimensionScore(breakdown.testing),
      performance: this.parseDimensionScore(breakdown.performance),
    };
  }

  /**
   * 解析单个维度的评分
   */
  private static parseDimensionScore(score: any): DimensionScore {
    if (!score || typeof score !== "object") {
      return { score: 0, reason: "无法解析" };
    }

    return {
      score: this.safeNumber(score.score, 0),
      reason: this.safeString(score.reason, "无原因说明"),
    };
  }

  /**
   * 解析 recommendation
   */
  private static parseRecommendation(recommendation: any): Recommendation {
    const value = this.safeString(recommendation, "conditional").toLowerCase();

    if (value === "approve") return "approve";
    if (value === "reject") return "reject";
    return "conditional";
  }

  /**
   * 解析 issues 数组
   */
  private static parseIssues(issues: any): Issue[] {
    if (!Array.isArray(issues)) {
      return [];
    }

    return issues
      .map((issue) => {
        if (!issue || typeof issue !== "object") return null;

        return {
          severity: this.parseSeverity(issue.severity),
          file: this.safeString(issue.file, "unknown"),
          line: this.safeNumber(issue.line, 0),
          message: this.safeString(issue.message, "无描述"),
          suggestion: this.safeString(issue.suggestion, "无建议"),
        };
      })
      .filter((issue): issue is Issue => issue !== null);
  }

  /**
   * 解析 severity
   */
  private static parseSeverity(severity: any): IssueSeverity {
    const value = this.safeString(severity, "low").toLowerCase();

    if (value === "high") return "high";
    if (value === "medium") return "medium";
    return "low";
  }

  /**
   * 解析字符串数组
   */
  private static parseStringArray(arr: any): string[] {
    if (!Array.isArray(arr)) {
      return [];
    }

    return arr.filter((item): item is string => typeof item === "string");
  }

  /**
   * 安全转换为数字
   */
  private static safeNumber(value: any, defaultValue: number): number {
    const num = Number(value);
    return isNaN(num) ? defaultValue : Math.min(100, Math.max(0, num));
  }

  /**
   * 安全转换为字符串
   */
  private static safeString(value: any, defaultValue: string): string {
    if (value === null || value === undefined) return defaultValue;
    return String(value);
  }

  /**
   * 获取默认响应
   */
  private static getDefaultResponse(): AICodeReviewResponse {
    return {
      total_score: 0,
      dimensions: { ...this.DEFAULT_DIMENSION_SCORE },
      score_breakdown: { ...this.DEFAULT_DIMENSION_REASON },
      recommendation: "conditional",
      issues: [],
      strengths: [],
      summary: "无法解析 AI 响应",
      commit_message_suggestion: "chore: update code",
    };
  }
}

/**
 * 简化的响应解析器（只解析 commit message）
 */
class SimpleCommitParser {
  /**
   * 从字符串解析 commit message
   */
  static fromString(input: string): string {
    if (!input || input.trim() === "") {
      return "chore: update code";
    }

    // 尝试提取 markdown 代码块中的内容
    const codeBlockMatch = input.match(/```(?:\w*)\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      return codeBlockMatch[1].trim();
    }

    // 尝试提取 JSON 中的 commit_message_suggestion
    try {
      const jsonMatch = input.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.commit_message_suggestion) {
          return parsed.commit_message_suggestion;
        }
      }
    } catch {
      // 不是 JSON，继续处理
    }

    // 直接返回原始文本（去除多余空白）
    return input.trim();
  }

  /**
   * 从 any 类型解析
   */
  static fromAny(data: any): string {
    if (!data) return "chore: update code";

    if (typeof data === "string") {
      return this.fromString(data);
    }

    if (typeof data === "object") {
      if (data.commit_message_suggestion) {
        return String(data.commit_message_suggestion);
      }
      if (data.message) {
        return String(data.message);
      }
    }

    return "chore: update code";
  }
}

// 导出
export {
  AICodeReviewParser,
  SimpleCommitParser,
  type AICodeReviewResponse,
  type Dimensions,
  type DimensionScore,
  type Issue,
  type IssueSeverity,
  type Recommendation,
  type ScoreBreakdown,
};
