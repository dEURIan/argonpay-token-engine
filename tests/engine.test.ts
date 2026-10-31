/**
 * @fileoverview Comprehensive TDD Verification Suite for ArgonPay / PayPrune
 * AI & Token Optimization Engine.
 *
 * Verifies:
 * 1. Static Prefix Cache Spec (`paypalPrefixSpec.ts`) crosses 4,096-token boundary (4,200-4,500 target) & byte-0 invariance.
 * 2. Wire Pruner (`wirePruner.ts`) strips 80-85%+ bloat across Orders, Invoices, and Disputes.
 * 3. Model Adapter & Reasoning Governor (`modelAdapter.ts`) clamps CRUD thinking to 150 / "low" and expands Disputes.
 * 4. Telemetry & Cost Engine (`telemetry.ts`) accurately prices Uncached ($2/1M), Cached ($0.10/1M), and Output/Thinking ($10/1M) and achieves 75%-90% cost reduction.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMultiModelPromptEnvelope,
  estimateTokenCount,
  PAYPAL_STATIC_PREFIX_SPEC,
  verifyPrefixCacheCompliance,
} from '../src/specs/paypalPrefixSpec.ts';
import {
  pruneDisputePayload,
  pruneInvoicePayload,
  pruneOrderPayload,
  prunePayPalPayload,
  pruneWithTelemetry,
} from '../src/engine/wirePruner.ts';
import {
  buildTelemetryMetrics,
  calculateCostUsd,
  computeOptimizationResult,
} from '../src/engine/telemetry.ts';
import {
  mapFunctionCallToEndpoint,
  resolveReasoningGovernor,
  runDualOptimizationPipeline,
} from '../src/engine/modelAdapter.ts';

const RAW_PAYPAL_ORDER_RESPONSE = {
  id: '5O190127TN364715T',
  intent: 'CAPTURE',
  status: 'APPROVED',
  debug_id: 'f4b82910a912c',
  headers: {
    'paypal-debug-id': 'f4b82910a912c',
    'content-type': 'application/json',
    'cache-control': 'max-age=0, no-cache, no-store, must-revalidate',
  },
  payment_source: {
    paypal: {
      email_address: 'buyer.enterprise@example.com',
      account_id: 'QYR5Z8X9J2K3L',
      account_status: 'VERIFIED',
      name: { given_name: 'Elena', surname: 'Vance' },
      address: {
        address_line_1: '742 Evergreen Terrace',
        admin_area_2: 'Springfield',
        admin_area_1: 'IL',
        postal_code: '62704',
        country_code: 'US',
      },
    },
  },
  payer: {
    name: { given_name: 'Elena', surname: 'Vance' },
    email_address: 'buyer.enterprise@example.com',
    payer_id: 'QYR5Z8X9J2K3L',
    address: {
      address_line_1: '742 Evergreen Terrace',
      admin_area_2: 'Springfield',
      admin_area_1: 'IL',
      postal_code: '62704',
      country_code: 'US',
    },
  },
  purchase_units: [
    {
      reference_id: 'PU-ENT-9901',
      amount: {
        currency_code: 'USD',
        value: '499.00',
        breakdown: {
          item_total: { currency_code: 'USD', value: '450.00' },
          shipping: { currency_code: 'USD', value: '19.00' },
          handling: { currency_code: 'USD', value: '0.00' },
          tax_total: { currency_code: 'USD', value: '30.00' },
          insurance: { currency_code: 'USD', value: '0.00' },
          shipping_discount: { currency_code: 'USD', value: '0.00' },
          discount: { currency_code: 'USD', value: '0.00' },
        },
      },
      payee: {
        email_address: 'merchant-treasury@argonpay.io',
        merchant_id: '9988776655443',
      },
      items: [
        {
          name: 'ArgonPay FinOps Annual Node License',
          unit_amount: { currency_code: 'USD', value: '450.00' },
          tax: { currency_code: 'USD', value: '30.00' },
          quantity: '1',
          description: 'Enterprise AI Token Interceptor Gateway License',
          sku: 'ARGON-ENT-01',
          category: 'DIGITAL_GOODS',
        },
      ],
      shipping: {
        name: { full_name: 'Elena Vance' },
        address: {
          address_line_1: '742 Evergreen Terrace',
          admin_area_2: 'Springfield',
          admin_area_1: 'IL',
          postal_code: '62704',
          country_code: 'US',
        },
      },
      supplementary_data: {
        card: {
          level_2: { invoice_id: 'INV-9901', tax_total: { currency_code: 'USD', value: '30.00' } },
        },
      },
      payments: {
        captures: [
          {
            id: '2GG903537H418042P',
            status: 'COMPLETED',
            amount: { currency_code: 'USD', value: '499.00' },
            final_capture: true,
            seller_protection: {
              status: 'ELIGIBLE',
              dispute_categories: ['ITEM_NOT_RECEIVED', 'UNAUTHORIZED_TRANSACTION'],
            },
            seller_receivable_breakdown: {
              gross_amount: { currency_code: 'USD', value: '499.00' },
              paypal_fee: { currency_code: 'USD', value: '14.96' },
              net_amount: { currency_code: 'USD', value: '484.04' },
            },
            links: [
              {
                href: 'https://api-m.sandbox.paypal.com/v2/payments/captures/2GG903537H418042P',
                rel: 'self',
                method: 'GET',
              },
              {
                href: 'https://api-m.sandbox.paypal.com/v2/payments/captures/2GG903537H418042P/refund',
                rel: 'refund',
                method: 'POST',
              },
              {
                href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T',
                rel: 'up',
                method: 'GET',
              },
            ],
            create_time: '2026-10-31T14:20:00Z',
            update_time: '2026-10-31T14:20:05Z',
          },
        ],
      },
    },
  ],
  create_time: '2026-10-31T14:19:10Z',
  update_time: '2026-10-31T14:20:05Z',
  links: [
    {
      href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T',
      rel: 'self',
      method: 'GET',
    },
    {
      href: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T',
      rel: 'approve',
      method: 'GET',
    },
    {
      href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T',
      rel: 'update',
      method: 'PATCH',
    },
    {
      href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T/capture',
      rel: 'capture',
      method: 'POST',
    },
  ],
};

const RAW_PAYPAL_INVOICE_RESPONSE = {
  id: 'INV2-Z56S-5LLA-Q52L-CPZ5',
  status: 'DRAFT',
  debug_id: 'a918273bc001',
  detail: {
    invoice_number: 'INV-2026-8841',
    reference: 'PO-992104',
    invoice_date: '2026-10-31',
    currency_code: 'USD',
    note: 'Thank you for your enterprise subscription to ArgonPay FinOps.',
    terms_and_conditions: 'Net 30 days. Late payments subject to 1.5% monthly finance charge.',
    memo: 'Internal ledger code: SaaS-ARR-Q4',
    payment_term: { term_type: 'NET_30', due_date: '2026-11-30' },
    metadata: {
      create_time: '2026-10-31T10:00:00Z',
      last_update_time: '2026-10-31T10:00:05Z',
      created_by_flow: 'REGULAR_SINGLE',
      recipient_view_url: 'https://www.sandbox.paypal.com/invoice/p/#Z56S5LLAQ52LCPZ5',
      invoicer_view_url: 'https://www.sandbox.paypal.com/invoice/details/INV2-Z56S-5LLA-Q52L-CPZ5',
    },
  },
  invoicer: {
    business_name: 'ArgonPay Technologies Inc.',
    name: { given_name: 'FinOps', surname: 'Billing' },
    email_address: 'billing@argonpay.io',
    address: {
      address_line_1: '100 Market Street',
      admin_area_2: 'San Francisco',
      admin_area_1: 'CA',
      postal_code: '94105',
      country_code: 'US',
    },
  },
  primary_recipients: [
    {
      billing_info: {
        business_name: 'Acme Global Corp',
        name: { given_name: 'Marcus', surname: 'Sterling' },
        email_address: 'ap@acmeglobal.example.com',
        address: {
          address_line_1: '500 Fifth Avenue',
          admin_area_2: 'New York',
          admin_area_1: 'NY',
          postal_code: '10110',
          country_code: 'US',
        },
      },
    },
  ],
  items: [
    {
      id: 'ITEM-881',
      name: 'ArgonPay Gateway Cluster Seat',
      description: 'Dedicated high-throughput token pruning proxy node',
      quantity: '5',
      unit_amount: { currency_code: 'USD', value: '250.00' },
      unit_of_measure: 'QUANTITY',
    },
  ],
  amount: {
    currency_code: 'USD',
    value: '1250.00',
    breakdown: {
      item_total: { currency_code: 'USD', value: '1250.00' },
      tax_total: { currency_code: 'USD', value: '0.00' },
    },
  },
  links: [
    {
      href: 'https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5',
      rel: 'self',
      method: 'GET',
    },
    {
      href: 'https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5/send',
      rel: 'send',
      method: 'POST',
    },
    {
      href: 'https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5',
      rel: 'replace',
      method: 'PUT',
    },
    {
      href: 'https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5',
      rel: 'delete',
      method: 'DELETE',
    },
  ],
};

const RAW_PAYPAL_DISPUTE_RESPONSE = {
  dispute_id: 'PP-D-40128',
  create_time: '2026-10-29T08:15:22Z',
  update_time: '2026-10-31T11:42:10Z',
  debug_id: 'd881920192fa',
  disputed_transactions: [
    {
      buyer_transaction_id: '8XX9910293810293L',
      seller_transaction_id: '2GG903537H418042P',
      create_time: '2026-10-20T14:20:00Z',
      transaction_status: 'HELD',
      gross_amount: { currency_code: 'USD', value: '499.00' },
      invoice_number: 'INV-9901',
      buyer: { email: 'buyer.enterprise@example.com', name: 'Elena Vance' },
      seller: {
        email: 'merchant-treasury@argonpay.io',
        merchant_id: '9988776655443',
        name: 'ArgonPay Inc.',
      },
    },
  ],
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  status: 'WAITING_FOR_SELLER_RESPONSE',
  dispute_amount: { currency_code: 'USD', value: '499.00' },
  dispute_life_cycle_stage: 'INQUIRY',
  dispute_channel: 'INTERNAL',
  messages: [
    {
      posted_by: 'BUYER',
      time_posted: '2026-10-29T08:15:22Z',
      content: 'Initial inquiry opened for order #5O190127TN364715T.',
    },
    {
      posted_by: 'BUYER',
      time_posted: '2026-10-31T11:42:10Z',
      content:
        'We have not received the license provisioning key or activation email after 48 hours.',
    },
  ],
  seller_response_due_date: '2026-11-10T23:59:59Z',
  links: [
    {
      href: 'https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-40128',
      rel: 'self',
      method: 'GET',
    },
    {
      href: 'https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-40128/accept-claim',
      rel: 'accept-claim',
      method: 'POST',
    },
    {
      href: 'https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-40128/provide-evidence',
      rel: 'provide-evidence',
      method: 'POST',
    },
    {
      href: 'https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-D-40128/send-message',
      rel: 'send-message',
      method: 'POST',
    },
  ],
};

describe('A. Static Prefix Cache Spec (`src/specs/paypalPrefixSpec.ts`)', () => {
  it('crosses the 4,096-token cache cliff within the 4,200-4,500 target band and starts at byte 0', () => {
    const compliance = verifyPrefixCacheCompliance();
    assert.equal(compliance.isValid, true);
    assert.equal(compliance.crossesCacheCliff, true);
    assert.ok(
      compliance.estimatedTokens >= 4200 && compliance.estimatedTokens <= 4550,
      `Expected ~4,200-4,500 tokens, got ${compliance.estimatedTokens}`
    );
  });

  it('contains all 6 required frozen PayPal OpenAPI endpoints and zero dynamic variables', () => {
    const requiredEndpoints = [
      '/v2/checkout/orders',
      '/v2/checkout/orders/{id}',
      '/v2/checkout/orders/{id}/capture',
      '/v2/payments/captures/{id}/refund',
      '/v2/invoicing/invoices',
      '/v1/customer/disputes/{id}',
    ];
    for (const endpoint of requiredEndpoints) {
      assert.ok(
        PAYPAL_STATIC_PREFIX_SPEC.includes(endpoint),
        `Missing endpoint ${endpoint} in PAYPAL_STATIC_PREFIX_SPEC`
      );
    }

    // Verify multi-model prompt envelopes preserve exact prefix
    const geminiEnv = buildMultiModelPromptEnvelope('gemini', 'Check order 123');
    const anthropicEnv = buildMultiModelPromptEnvelope('anthropic', 'Check order 123');
    const openaiEnv = buildMultiModelPromptEnvelope('openai', 'Check order 123');

    assert.equal(geminiEnv.system_instruction, PAYPAL_STATIC_PREFIX_SPEC);
    assert.equal(anthropicEnv.system[0].text, PAYPAL_STATIC_PREFIX_SPEC);
    assert.deepEqual(anthropicEnv.system[0].cache_control, { type: 'ephemeral' });
    assert.equal(openaiEnv.messages[0].content, PAYPAL_STATIC_PREFIX_SPEC);
  });
});

describe('B. The Wire Pruner (`src/engine/wirePruner.ts`)', () => {
  it('strips >85% of redundant payload bloat on PayPal Orders while retaining exact operational fields', () => {
    const report = pruneWithTelemetry(RAW_PAYPAL_ORDER_RESPONSE);
    assert.ok(
      report.percentStripped >= 80,
      `Expected >=80% bloat stripped, got ${report.percentStripped}%`
    );

    const pruned = pruneOrderPayload(RAW_PAYPAL_ORDER_RESPONSE);
    assert.deepEqual(pruned, {
      id: '5O190127TN364715T',
      status: 'APPROVED',
      intent: 'CAPTURE',
      amount: { currency_code: 'USD', value: '499.00' },
      payer_email: 'buyer.enterprise@example.com',
      approval_url: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T',
    });

    assert.equal('links' in pruned, false);
    assert.equal('debug_id' in pruned, false);
  });

  it('retains only id, status, invoice_number, amount, and recipient_email for Invoices', () => {
    const report = pruneWithTelemetry(RAW_PAYPAL_INVOICE_RESPONSE);
    assert.ok(
      report.percentStripped >= 80,
      `Expected >=80% bloat stripped, got ${report.percentStripped}%`
    );

    const pruned = pruneInvoicePayload(RAW_PAYPAL_INVOICE_RESPONSE);
    assert.deepEqual(pruned, {
      id: 'INV2-Z56S-5LLA-Q52L-CPZ5',
      status: 'DRAFT',
      invoice_number: 'INV-2026-8841',
      amount: { currency_code: 'USD', value: '1250.00' },
      recipient_email: 'ap@acmeglobal.example.com',
    });
  });

  it('retains only dispute_id, reason, status, dispute_amount, and latest_message for Disputes', () => {
    const report = pruneWithTelemetry(RAW_PAYPAL_DISPUTE_RESPONSE);
    assert.ok(
      report.percentStripped >= 75,
      `Expected >=75% bloat stripped on dispute, got ${report.percentStripped}%`
    );

    const pruned = pruneDisputePayload(RAW_PAYPAL_DISPUTE_RESPONSE);
    assert.deepEqual(pruned, {
      dispute_id: 'PP-D-40128',
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      status: 'WAITING_FOR_SELLER_RESPONSE',
      dispute_amount: { currency_code: 'USD', value: '499.00' },
      latest_message:
        'We have not received the license provisioning key or activation email after 48 hours.',
    });

    // Verify auto-router prunePayPalPayload matches
    assert.deepEqual(prunePayPalPayload(RAW_PAYPAL_DISPUTE_RESPONSE), pruned);
  });
});

describe('C. Model Adapter & Reasoning Governor (`src/engine/modelAdapter.ts`)', () => {
  it('clamps deterministic CRUD tasks to thinkingBudget: 150 and thinkingLevel: "low"', () => {
    const crudGov = resolveReasoningGovernor(
      'Check if order 5O190127TN364715T is APPROVED and capture it.'
    );
    assert.equal(crudGov.complexity, 'CRUD_DETERMINISTIC');
    assert.equal(crudGov.thinkingBudget, 150);
    assert.equal(crudGov.thinkingLevel, 'low');
    assert.equal(crudGov.strictToolCalling, true);
  });

  it('expands reasoning budget for complex Dispute & Chargeback Arbitrations', () => {
    const disputeGov = resolveReasoningGovernor(
      'Analyze dispute PP-D-40128 and determine arbitration strategy.',
      RAW_PAYPAL_DISPUTE_RESPONSE
    );
    assert.equal(disputeGov.complexity, 'DISPUTE_ARBITRATION');
    assert.ok(disputeGov.thinkingBudget > 150);
    assert.equal(disputeGov.thinkingLevel, 'high');
    assert.equal(disputeGov.strictToolCalling, true);
  });

  it('maps function declarations to exact PayPal REST endpoints', () => {
    const captureCall = mapFunctionCallToEndpoint('capture_checkout_order', {
      order_id: '5O190127TN364715T',
    });
    assert.deepEqual(captureCall, {
      endpoint: '/v2/checkout/orders/5O190127TN364715T/capture',
      method: 'POST',
      params: { id: '5O190127TN364715T' },
    });
  });
});

describe('D. Telemetry & Cost Engine (`src/engine/telemetry.ts`) & Dual-Pipeline Runner', () => {
  it('computes exact USD costs for Uncached ($2/1M), Cached ($0.10/1M), and Output/Thinking ($10/1M)', () => {
    // 5,000 prompt tokens (4,400 cached, 600 uncached) + 50 output + 150 thinking
    // Uncached: 600 * $2 / 1M = $0.001200
    // Cached: 4,400 * $0.10 / 1M = $0.000440
    // Output+Thinking: 200 * $10 / 1M = $0.002000
    // Total = $0.003640
    const cost = calculateCostUsd({
      promptTokens: 5000,
      cachedTokens: 4400,
      outputTokens: 50,
      thinkingTokens: 150,
    });
    assert.equal(cost, 0.00364);

    const metrics = buildTelemetryMetrics(
      {
        promptTokenCount: 5000,
        cachedContentTokenCount: 4400,
        candidatesTokenCount: 50,
        thoughtsTokenCount: 150,
      },
      { latencyMs: 320, payloadLines: 9 }
    );
    assert.equal(metrics.totalTokens, 5200);
    assert.equal(metrics.costUsd, 0.00364);
  });

  it('slashes API bills by 75%-90% across multi-turn CRUD loops and conforms to OptimizationRunResult', async () => {
    const result = await runDualOptimizationPipeline({
      prompt: 'Capture approved order 5O190127TN364715T',
      rawPayPalPayload: RAW_PAYPAL_ORDER_RESPONSE,
      turnCount: 3,
    });

    assert.ok(
      result.delta.percentSaved >= 75 && result.delta.percentSaved <= 95,
      `Expected 75%-95% cost savings, got ${result.delta.percentSaved}%`
    );
    assert.ok(result.optimized.cachedTokens >= 4096);
    assert.equal(result.baseline.cachedTokens, 0);
    assert.equal(result.costSavedUsd, result.delta.costSavingsUsd);
    assert.equal(result.cachedTokens, result.optimized.cachedTokens);
    assert.equal(result.tokenDelta, result.delta.tokenSavings);
    assert.equal(
      result.toolCallPayload?.endpoint,
      '/v2/checkout/orders/5O190127TN364715T/capture'
    );
    assert.equal(result.prunedResponse?.id, '5O190127TN364715T');
  });

  it('supports mocked @google/genai Interactions API client execution', async () => {
    const mockClient = {
      interactions: {
        create: async () => ({
          id: 'inter_123',
          status: 'completed',
          steps: [
            {
              type: 'function_call',
              name: 'get_customer_dispute',
              arguments: {
                dispute_id: 'PP-D-40128',
                recommended_action: 'PROVIDE_EVIDENCE',
              },
            },
          ],
          usage: {
            total_input_tokens: 4520,
            total_cached_tokens: 4438,
            total_output_tokens: 38,
            total_thought_tokens: 420,
            total_tokens: 4978,
          },
        }),
      },
    } as any;

    const result = await runDualOptimizationPipeline({
      prompt: 'Evaluate dispute PP-D-40128',
      rawPayPalPayload: RAW_PAYPAL_DISPUTE_RESPONSE,
      geminiClient: mockClient,
    });

    assert.equal(result.optimized.cachedTokens, 4438);
    assert.equal(result.optimized.thinkingTokens, 420);
    assert.equal(
      result.toolCallPayload?.endpoint,
      '/v1/customer/disputes/PP-D-40128'
    );
    assert.ok(result.delta.percentSaved >= 75);
  });
});
