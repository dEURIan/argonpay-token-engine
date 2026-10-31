/**
 * @fileoverview Barrel export for ArgonPay / PayPrune AI & Token Optimization Engine.
 * Exposes all contracts, static prefix specs, wire pruners, model adapters, and telemetry utilities
 * for seamless integration with P1 (Frontend), P3 (PayPal Backend), and P4 (Gateway Orchestrator).
 */

export type {
  TelemetryMetrics,
  ToolCallPayload,
  OptimizationRunResult,
  TaskComplexity,
  ModelProvider,
  ReasoningGovernorConfig,
  UsageMetadataInput,
} from './types/contracts.ts';
export * from './specs/paypalPrefixSpec.ts';
export * from './engine/wirePruner.ts';
export * from './engine/telemetry.ts';
export * from './engine/modelAdapter.ts';
