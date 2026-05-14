/**
 * Built-in Skills Types
 */

export interface BuiltInSkill {
  name: string;
  description: string;
  category: string;
  version: string;
  execute(context: SkillContext): SkillResult;
  parseCronExpression?(expr: string): CronParsed | null;
}

export interface SkillContext {
  query?: string;
  message?: string;
  at?: string;
  options?: Record<string, unknown>;
  functionName?: string;
  params?: string[];
  returnType?: string;
  [key: string]: unknown;
}

export interface SkillResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface CronParsed {
  minute: number;
  hour: number;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export interface SkillSearchResult {
  title: string;
  url: string;
  snippet: string;
}
