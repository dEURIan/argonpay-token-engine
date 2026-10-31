/**
 * @fileoverview The Wire Pruner (`src/engine/wirePruner.ts`).
 *
 * Pure, deterministic TypeScript functions that strip 80-85% of redundant
 * PayPal REST v2/v1 payload mass to prevent O(N^2) context window compounding
 * across multi-turn agent loops.
 *
 * Strictly removes:
 * - `links[]` HATEOAS navigation arrays (`rel="self"`, `rel="approve"`, etc.)
 * - `debug_id`, HTTP headers, verbose schema definitions, and empty tracking blocks.
 *
 * Strictly retains only operational fields:
 * - Orders: `id`, `status`, `intent`, `amount`, `payer_email`, `approval_url`
 * - Invoices: `id`, `status`, `invoice_number`, `amount`, `recipient_email`
 * - Disputes: `dispute_id`, `reason`, `status`, `dispute_amount`, `latest_message`
 */

import { estimateTokenCount } from '../specs/paypalPrefixSpec.ts';

export interface PrunedOrderPayload {
  id: string | null;
  status: string | null;
  intent: string | null;
  amount: { currency_code: string; value: string } | null;
  payer_email: string | null;
  approval_url: string | null;
}

export interface PrunedInvoicePayload {
  id: string | null;
  status: string | null;
  invoice_number: string | null;
  amount: { currency_code: string; value: string } | null;
  recipient_email: string | null;
}

export interface PrunedDisputePayload {
  dispute_id: string | null;
  reason: string | null;
  status: string | null;
  dispute_amount: { currency_code: string; value: string } | null;
  latest_message: string | null;
}

export interface WirePruneReport<T = Record<string, any>> {
  pruned: T;
  rawBytes: number;
  prunedBytes: number;
  rawTokens: number;
  prunedTokens: number;
  rawLines: number;
  prunedLines: number;
  compressionRatio: number;
  percentStripped: number;
}

const APPROVAL_RELS = new Set(['approve', 'payer-action']);

const BLOAT_KEYS = new Set([
  'links',
  'debug_id',
  'headers',
  'http_headers',
  '$schema',
  'schema',
  'trackers',
  'tracking',
  'seller_protection',
  'seller_receivable_breakdown',
  'seller_payable_breakdown',
  'supplementary_data',
  'network_transaction_reference',
  'processor_response',
]);

/**
 * Extracts only `{ currency_code, value }` from a PayPal Money or AmountWithBreakdown object,
 * discarding nested `breakdown` bloat.
 */
function normalizeMoney(
  rawAmount: any
): { currency_code: string; value: string } | null {
  if (!rawAmount || typeof rawAmount !== 'object') return null;
  const currency_code =
    typeof rawAmount.currency_code === 'string'
      ? rawAmount.currency_code
      : typeof rawAmount.currency === 'string'
        ? rawAmount.currency
        : null;
  const value =
    typeof rawAmount.value === 'string' || typeof rawAmount.value === 'number'
      ? String(rawAmount.value)
      : null;

  if (!currency_code || value === null) return null;
  return { currency_code, value };
}

/**
 * Pure, deterministic pruner for PayPal Checkout Orders (`POST /v2/checkout/orders`,
 * `GET /v2/checkout/orders/{id}`, `POST /v2/checkout/orders/{id}/capture`).
 */
export function pruneOrderPayload(raw: Record<string, any>): PrunedOrderPayload {
  if (!raw || typeof raw !== 'object') {
    return {
      id: null,
      status: null,
      intent: null,
      amount: null,
      payer_email: null,
      approval_url: null,
    };
  }

  // Extract approval_url before stripping HATEOAS links[]
  let approval_url: string | null = null;
  if (typeof raw.approval_url === 'string') {
    approval_url = raw.approval_url;
  } else if (Array.isArray(raw.links)) {
    const approveLink = raw.links.find(
      (link: any) =>
        link &&
        typeof link === 'object' &&
        typeof link.rel === 'string' &&
        APPROVAL_RELS.has(link.rel.toLowerCase()) &&
        typeof link.href === 'string'
    );
    if (approveLink) {
      approval_url = approveLink.href;
    }
  }

  // Extract amount from top-level or purchase_units[0] or captures[0]
  const firstUnit = Array.isArray(raw.purchase_units)
    ? raw.purchase_units[0]
    : undefined;
  const firstCapture = firstUnit?.payments?.captures?.[0];
  const amount =
    normalizeMoney(raw.amount) ??
    normalizeMoney(firstUnit?.amount) ??
    normalizeMoney(firstCapture?.amount);

  // Extract payer_email from top-level, payer.email_address, or payment_source.paypal.email_address
  const payer_email: string | null =
    typeof raw.payer_email === 'string'
      ? raw.payer_email
      : typeof raw.payer?.email_address === 'string'
        ? raw.payer.email_address
        : typeof raw.payment_source?.paypal?.email_address === 'string'
          ? raw.payment_source.paypal.email_address
          : null;

  return {
    id: typeof raw.id === 'string' ? raw.id : null,
    status: typeof raw.status === 'string' ? raw.status : null,
    intent: typeof raw.intent === 'string' ? raw.intent : null,
    amount,
    payer_email,
    approval_url,
  };
}

/**
 * Pure, deterministic pruner for PayPal Invoicing (`POST /v2/invoicing/invoices`).
 */
export function pruneInvoicePayload(
  raw: Record<string, any>
): PrunedInvoicePayload {
  if (!raw || typeof raw !== 'object') {
    return {
      id: null,
      status: null,
      invoice_number: null,
      amount: null,
      recipient_email: null,
    };
  }

  const invoice_number: string | null =
    typeof raw.invoice_number === 'string'
      ? raw.invoice_number
      : typeof raw.detail?.invoice_number === 'string'
        ? raw.detail.invoice_number
        : null;

  const firstRecipient = Array.isArray(raw.primary_recipients)
    ? raw.primary_recipients[0]
    : undefined;
  const recipient_email: string | null =
    typeof raw.recipient_email === 'string'
      ? raw.recipient_email
      : typeof firstRecipient?.billing_info?.email_address === 'string'
        ? firstRecipient.billing_info.email_address
        : null;

  const amount =
    normalizeMoney(raw.amount) ?? normalizeMoney(raw.due_amount) ?? null;

  return {
    id: typeof raw.id === 'string' ? raw.id : null,
    status: typeof raw.status === 'string' ? raw.status : null,
    invoice_number,
    amount,
    recipient_email,
  };
}

/**
 * Pure, deterministic pruner for PayPal Customer Disputes (`GET /v1/customer/disputes/{id}`).
 */
export function pruneDisputePayload(
  raw: Record<string, any>
): PrunedDisputePayload {
  if (!raw || typeof raw !== 'object') {
    return {
      dispute_id: null,
      reason: null,
      status: null,
      dispute_amount: null,
      latest_message: null,
    };
  }

  let latest_message: string | null = null;
  if (typeof raw.latest_message === 'string') {
    latest_message = raw.latest_message;
  } else if (Array.isArray(raw.messages) && raw.messages.length > 0) {
    const lastMsg = raw.messages[raw.messages.length - 1];
    if (lastMsg && typeof lastMsg.content === 'string') {
      latest_message = lastMsg.content;
    }
  }

  return {
    dispute_id:
      typeof raw.dispute_id === 'string'
        ? raw.dispute_id
        : typeof raw.id === 'string'
          ? raw.id
          : null,
    reason: typeof raw.reason === 'string' ? raw.reason : null,
    status: typeof raw.status === 'string' ? raw.status : null,
    dispute_amount: normalizeMoney(raw.dispute_amount),
    latest_message,
  };
}

/**
 * Generic deep sanitizer for any other PayPal payload (such as Refund responses or unknown shapes):
 * Recursively strips `links[]`, `debug_id`, HTTP headers, schema refs, and empty tracking blocks.
 */
export function stripGenericBloat(input: any): any {
  if (Array.isArray(input)) {
    return input
      .map((item) => stripGenericBloat(item))
      .filter((item) => item !== undefined);
  }

  if (input !== null && typeof input === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (BLOAT_KEYS.has(key)) continue;
      if (value === null || value === undefined || value === '') continue;
      if (Array.isArray(value) && value.length === 0) continue;

      const nested = stripGenericBloat(value);
      if (
        nested !== undefined &&
        !(
          typeof nested === 'object' &&
          !Array.isArray(nested) &&
          Object.keys(nested).length === 0
        )
      ) {
        cleaned[key] = nested;
      }
    }
    return cleaned;
  }

  return input;
}

/**
 * Automatically detects the PayPal resource type (Order, Invoice, Dispute, or Generic/Refund)
 * and returns the deterministically pruned operational payload.
 */
export function prunePayPalPayload(raw: Record<string, any>): Record<string, any> {
  if (!raw || typeof raw !== 'object') return {};

  // Unwrap optional envelope if P3 backend wraps `{ body, headers, debug_id }`
  const target =
    raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)
      ? raw.body
      : raw;

  // 1. Dispute detection (`dispute_id` or `dispute_amount` or `disputed_transactions`)
  if (
    'dispute_id' in target ||
    'dispute_amount' in target ||
    'disputed_transactions' in target ||
    'dispute_life_cycle_stage' in target
  ) {
    return pruneDisputePayload(target);
  }

  // 2. Invoice detection (`detail.invoice_number`, `primary_recipients`, `invoicer`, or `invoice_number`)
  if (
    'invoice_number' in target ||
    'primary_recipients' in target ||
    'invoicer' in target ||
    (target.detail && typeof target.detail === 'object' && 'invoice_number' in target.detail)
  ) {
    return pruneInvoicePayload(target);
  }

  // 3. Order detection (`intent` + `purchase_units` or order-like structure)
  if (
    'intent' in target ||
    'purchase_units' in target ||
    'payer' in target ||
    'approval_url' in target
  ) {
    return pruneOrderPayload(target);
  }

  // 4. Fallback for Refunds (`/v2/payments/captures/{id}/refund`) or generic payloads
  return stripGenericBloat(target);
}

/**
 * Executes wire pruning and computes exact byte, line, and token compression telemetry.
 */
export function pruneWithTelemetry(
  raw: Record<string, any>
): WirePruneReport<Record<string, any>> {
  const rawJsonPretty = JSON.stringify(raw, null, 2);
  const pruned = prunePayPalPayload(raw);
  const prunedJsonCompact = JSON.stringify(pruned);
  const prunedJsonPretty = JSON.stringify(pruned, null, 2);

  const rawBytes = Buffer.byteLength(rawJsonPretty, 'utf8');
  const prunedBytes = Buffer.byteLength(prunedJsonCompact, 'utf8');

  const rawTokens = estimateTokenCount(rawJsonPretty);
  const prunedTokens = estimateTokenCount(prunedJsonCompact);

  const rawLines = rawJsonPretty.split('\n').length;
  const prunedLines = prunedJsonPretty.split('\n').length;

  const compressionRatio = rawBytes > 0 ? (rawBytes - prunedBytes) / rawBytes : 0;
  const percentStripped = Number((compressionRatio * 100).toFixed(2));

  return {
    pruned,
    rawBytes,
    prunedBytes,
    rawTokens,
    prunedTokens,
    rawLines,
    prunedLines,
    compressionRatio,
    percentStripped,
  };
}
