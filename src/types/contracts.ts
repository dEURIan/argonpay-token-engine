/**
 * Shared Contract Interfaces for ArgonPay / PayPrune AI & Token Optimization Engine.
 * Integrates P1 (Frontend), P3 (PayPal Backend), and P4 (Gateway Orchestrator).
 */

export interface TelemetryMetrics {
  promptTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  payloadLines: number;
}

export interface ToolCallPayload {
  endpoint: string;
  method: string;
  params: Record<string, any>;
}

export interface OptimizationRunResult {
  baseline: TelemetryMetrics;
  optimized: TelemetryMetrics;
  delta: {
    tokenSavings: number;
    costSavingsUsd: number;
    percentSaved: number;
    latencyDeltaMs: number;
  };
  /** Unified P1 frontend aliases */
  costSavedUsd?: number;
  cachedTokens?: number;
  tokenDelta?: number;
  toolCallPayload?: ToolCallPayload;
  prunedResponse?: Record<string, any>;
}

export type TaskComplexity = 'CRUD_DETERMINISTIC' | 'DISPUTE_ARBITRATION';

export type ModelProvider = 'gemini' | 'openai' | 'anthropic';

export interface ReasoningGovernorConfig {
  complexity: TaskComplexity;
  thinkingBudget: number;
  thinkingLevel: 'low' | 'medium' | 'high';
  strictToolCalling: boolean;
}

export interface UsageMetadataInput {
  // Gemini Interactions API (v2.29+) & Legacy generateContent compatibility
  total_input_tokens?: number;
  total_cached_tokens?: number;
  total_output_tokens?: number;
  total_thought_tokens?: number;
  total_tokens?: number;
  promptTokenCount?: number;
  cachedContentTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}
