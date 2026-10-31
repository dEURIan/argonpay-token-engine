/**
 * @fileoverview Telemetry & Cost Engine (`src/engine/telemetry.ts`).
 *
 * Extracts usage metadata from model responses (`promptTokenCount` / `total_input_tokens`,
 * `cachedContentTokenCount` / `total_cached_tokens`, `candidatesTokenCount` / `total_output_tokens`,
 * and `thoughtsTokenCount` / `total_thought_tokens`).
 *
 * Computes real-time USD costs:
 * - Uncached Input: $2.00 / 1,000,000 tokens
 * - Cached Input:   $0.10 / 1,000,000 tokens (95% discount)
 * - Output / Thinking: $10.00 / 1,000,000 tokens
 *
 * Calculates exact comparative deltas against an unoptimized baseline branch.
 */

import type {
  OptimizationRunResult,
  TelemetryMetrics,
  ToolCallPayload,
  UsageMetadataInput,
} from '../types/contracts.ts';

export const PRICING_RATES_PER_MILLION = {
  UNCACHED_INPUT_USD: 2.0,
  CACHED_INPUT_USD: 0.1,
  OUTPUT_AND_THINKING_USD: 10.0,
} as const;

/**
 * Computes exact USD cost given token counts and ArgonPay FinOps pricing tiers.
 *
 * Note: `promptTokens` represents total input prompt tokens (including `cachedTokens`).
 * Uncached input tokens = `Math.max(0, promptTokens - cachedTokens)`.
 */
export function calculateCostUsd(params: {
  promptTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thinkingTokens: number;
}): number {
  const uncachedInputTokens = Math.max(
    0,
    params.promptTokens - params.cachedTokens
  );
  const cachedInputTokens = Math.max(0, params.cachedTokens);
  const billableOutputTokens =
    Math.max(0, params.outputTokens) + Math.max(0, params.thinkingTokens);

  const uncachedCost =
    (uncachedInputTokens / 1_000_000) *
    PRICING_RATES_PER_MILLION.UNCACHED_INPUT_USD;
  const cachedCost =
    (cachedInputTokens / 1_000_000) *
    PRICING_RATES_PER_MILLION.CACHED_INPUT_USD;
  const outputCost =
    (billableOutputTokens / 1_000_000) *
    PRICING_RATES_PER_MILLION.OUTPUT_AND_THINKING_USD;

  return Number((uncachedCost + cachedCost + outputCost).toFixed(6));
}

/**
 * Normalizes raw SDK usage metadata from either the Gemini Interactions API (`interaction.usage`)
 * or `usageMetadata` (`promptTokenCount`, `cachedContentTokenCount`, `candidatesTokenCount`)
 * into a unified `TelemetryMetrics` structure.
 */
export function buildTelemetryMetrics(
  usage: UsageMetadataInput | undefined | null,
  options: {
    latencyMs: number;
    payloadLines: number;
  }
): TelemetryMetrics {
  const promptTokens =
    usage?.promptTokenCount ?? usage?.total_input_tokens ?? 0;
  const cachedTokens =
    usage?.cachedContentTokenCount ?? usage?.total_cached_tokens ?? 0;
  const outputTokens =
    usage?.candidatesTokenCount ?? usage?.total_output_tokens ?? 0;
  const thinkingTokens =
    usage?.thoughtsTokenCount ?? usage?.total_thought_tokens ?? 0;

  const totalTokens =
    usage?.totalTokenCount ??
    usage?.total_tokens ??
    promptTokens + outputTokens + thinkingTokens;

  const costUsd = calculateCostUsd({
    promptTokens,
    cachedTokens,
    outputTokens,
    thinkingTokens,
  });

  return {
    promptTokens,
    cachedTokens,
    outputTokens,
    thinkingTokens,
    totalTokens,
    costUsd,
    latencyMs: Math.max(0, Math.round(options.latencyMs)),
    payloadLines: Math.max(0, options.payloadLines),
  };
}

/**
 * Computes comparative FinOps delta metrics between an unoptimized baseline run
 * and the ArgonPay optimized execution branch, including P1 frontend unified aliases.
 */
export function computeOptimizationResult(params: {
  baseline: TelemetryMetrics;
  optimized: TelemetryMetrics;
  toolCallPayload?: ToolCallPayload;
  prunedResponse?: Record<string, any>;
}): OptimizationRunResult {
  const { baseline, optimized, toolCallPayload, prunedResponse } = params;

  const tokenSavings = baseline.totalTokens - optimized.totalTokens;
  const costSavingsUsd = Number(
    (baseline.costUsd - optimized.costUsd).toFixed(6)
  );
  const percentSaved =
    baseline.costUsd > 0
      ? Number(((costSavingsUsd / baseline.costUsd) * 100).toFixed(2))
      : 0;
  const latencyDeltaMs = baseline.latencyMs - optimized.latencyMs;

  return {
    baseline,
    optimized,
    delta: {
      tokenSavings,
      costSavingsUsd,
      percentSaved,
      latencyDeltaMs,
    },
    // Unified P1 Frontend top-level convenience fields
    costSavedUsd: costSavingsUsd,
    cachedTokens: optimized.cachedTokens,
    tokenDelta: tokenSavings,
    toolCallPayload,
    prunedResponse,
  };
}
