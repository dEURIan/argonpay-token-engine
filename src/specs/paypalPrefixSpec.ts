/**
 * @fileoverview Static Prefix Cache Specification for ArgonPay / PayPrune.
 *
 * ARCHITECTURAL INVARIANT:
 * 1. Must start at byte 0 and remain strictly static and byte-for-byte invariant across all turns.
 * 2. Zero dynamic timestamps, session UUIDs, user greetings, or environment-dependent variables.
 * 3. Crosses the strict 4,096-token implicit/explicit prefix cache threshold (Target: ~4,200 - 4,500 tokens).
 * 4. Contains complete, frozen OpenAPI 3.0.3 / PayPal REST v2 & v1 definitions for core endpoints:
 *    - POST /v2/checkout/orders
 *    - GET /v2/checkout/orders/{id}
 *    - POST /v2/checkout/orders/{id}/capture
 *    - POST /v2/payments/captures/{id}/refund
 *    - POST /v2/invoicing/invoices
 *    - GET /v1/customer/disputes/{id}
 */

export const PAYPAL_STATIC_PREFIX_SPEC = `================================================================================
ARGONPAY / PAYPRUNE FINOPS INTERCEPTOR — FROZEN PAYPAL OPENAPI SPECIFICATION V2
================================================================================
SYSTEM DIRECTIVE:
You are an autonomous Financial Operations (FinOps) execution engine interfacing
strictly with the PayPal REST API. This static specification block starts at
byte 0 and is frozen for cross-turn prefix cache alignment.
- NEVER emit conversational filler, markdown prose, or polite preambles.
- ALWAYS invoke the appropriate structured tool / function declaration when an
  operational intent matches one of the canonical PayPal endpoints below.
- ALWAYS adhere to strict idempotency (PayPal-Request-Id), ISO-4217 3-character
  currency codes, and decimal string representations for monetary values.

--------------------------------------------------------------------------------
SECTION 1: CANONICAL OPENAPI 3.0.3 SCHEMA DEFINITIONS
--------------------------------------------------------------------------------
openapi: 3.0.3
info:
  title: PayPal REST API Core FinOps Specification (Orders, Captures, Invoicing, Disputes)
  version: "2.0.0-frozen"
  description: >
    Deterministic, immutable schema specification for PayPal Checkout Orders v2,
    Payments Captures v2, Invoicing v2, and Customer Disputes v1. Designed for
    zero-drift prefix caching across Gemini 4 Argon, OpenAI, and Anthropic runtimes.
servers:
  - url: https://api-m.sandbox.paypal.com
    description: PayPal Sandbox REST API Endpoint
  - url: https://api-m.paypal.com
    description: PayPal Production Live REST API Endpoint

components:
  securitySchemes:
    Oauth2:
      type: oauth2
      description: OAuth 2.0 Client Credentials Bearer Token Authentication
      flows:
        clientCredentials:
          tokenUrl: https://api-m.sandbox.paypal.com/v1/oauth2/token
          scopes:
            https://uri.paypal.com/services/invoicing: Manage invoices
            https://uri.paypal.com/services/disputes/read-buyer: Read buyer disputes
            https://uri.paypal.com/services/disputes/read-seller: Read seller disputes
            https://uri.paypal.com/services/payments/payment: Process orders and captures
            https://uri.paypal.com/services/payments/refund: Issue capture refunds

  parameters:
    PayPalRequestId:
      name: PayPal-Request-Id
      in: header
      required: false
      description: Mandatory idempotency key for POST mutating operations (stored 6-72 hours).
      schema: { type: string, minLength: 1, maxLength: 108 }
    PreferHeader:
      name: Prefer
      in: header
      required: false
      description: Server response verbosity ("minimal" or "representation").
      schema: { type: string, enum: [minimal, representation], default: minimal }

  schemas:
    CurrencyCode:
      type: string
      minLength: 3
      maxLength: 3
      pattern: "^[A-Z]{3}$"
      description: Three-character ISO-4217 currency code (e.g., USD, EUR, GBP, JPY).
      example: "USD"

    Money:
      type: object
      required: [currency_code, value]
      properties:
        currency_code: { $ref: "#/components/schemas/CurrencyCode" }
        value:
          type: string
          maxLength: 32
          pattern: "^((-?[0-9]+)|(-?([0-9]+)?[.][0-9]+))$"
          description: Decimal string representation of amount (e.g., "149.99").

    AmountBreakdown:
      type: object
      properties:
        item_total: { $ref: "#/components/schemas/Money" }
        shipping: { $ref: "#/components/schemas/Money" }
        handling: { $ref: "#/components/schemas/Money" }
        tax_total: { $ref: "#/components/schemas/Money" }
        discount: { $ref: "#/components/schemas/Money" }

    AmountWithBreakdown:
      type: object
      required: [currency_code, value]
      properties:
        currency_code: { $ref: "#/components/schemas/CurrencyCode" }
        value: { type: string, pattern: "^((-?[0-9]+)|(-?([0-9]+)?[.][0-9]+))$" }
        breakdown: { $ref: "#/components/schemas/AmountBreakdown" }

    Payee:
      type: object
      properties:
        email_address: { type: string, format: email }
        merchant_id: { type: string, pattern: "^[2-9A-HJ-NP-Z]{13}$" }

    Item:
      type: object
      required: [name, unit_amount, quantity]
      properties:
        name: { type: string, maxLength: 127 }
        unit_amount: { $ref: "#/components/schemas/Money" }
        tax: { $ref: "#/components/schemas/Money" }
        quantity: { type: string, pattern: "^[1-9][0-9]{0,9}$" }
        sku: { type: string, maxLength: 127 }
        category: { type: string, enum: [DIGITAL_GOODS, PHYSICAL_GOODS, DONATION] }

    AddressPortable:
      type: object
      required: [country_code]
      properties:
        address_line_1: { type: string, maxLength: 300 }
        admin_area_2: { type: string, maxLength: 120 }
        admin_area_1: { type: string, maxLength: 300 }
        postal_code: { type: string, maxLength: 60 }
        country_code: { type: string, minLength: 2, maxLength: 2 }

    PurchaseUnitRequest:
      type: object
      required: [amount]
      properties:
        reference_id: { type: string, maxLength: 256, default: "default" }
        amount: { $ref: "#/components/schemas/AmountWithBreakdown" }
        payee: { $ref: "#/components/schemas/Payee" }
        description: { type: string, maxLength: 127 }
        custom_id: { type: string, maxLength: 127 }
        invoice_id: { type: string, maxLength: 127 }
        items: { type: array, items: { $ref: "#/components/schemas/Item" } }

    Payer:
      type: object
      properties:
        name:
          type: object
          properties:
            given_name: { type: string }
            surname: { type: string }
        email_address: { type: string, format: email }
        payer_id: { type: string, pattern: "^[2-9A-HJ-NP-Z]{13}$" }
        address: { $ref: "#/components/schemas/AddressPortable" }

    ApplicationContext:
      type: object
      properties:
        brand_name: { type: string, maxLength: 127 }
        user_action: { type: string, enum: [CONTINUE, PAY_NOW], default: CONTINUE }
        return_url: { type: string, format: uri }
        cancel_url: { type: string, format: uri }

    CaptureResource:
      type: object
      properties:
        id: { type: string }
        status: { type: string, enum: [COMPLETED, DECLINED, PARTIALLY_REFUNDED, PENDING, REFUNDED, FAILED] }
        amount: { $ref: "#/components/schemas/Money" }
        final_capture: { type: boolean }
        invoice_id: { type: string }
        create_time: { type: string, format: date-time }
        update_time: { type: string, format: date-time }

    RefundRequest:
      type: object
      properties:
        amount: { $ref: "#/components/schemas/Money" }
        invoice_id: { type: string, maxLength: 127 }
        note_to_payer: { type: string, maxLength: 255 }

    RefundResource:
      type: object
      properties:
        id: { type: string }
        status: { type: string, enum: [CANCELLED, FAILED, PENDING, COMPLETED] }
        amount: { $ref: "#/components/schemas/Money" }
        invoice_id: { type: string }
        note_to_payer: { type: string }
        create_time: { type: string, format: date-time }

    OrderRequest:
      type: object
      required: [intent, purchase_units]
      properties:
        intent: { type: string, enum: [CAPTURE, AUTHORIZE] }
        payer: { $ref: "#/components/schemas/Payer" }
        purchase_units: { type: array, minItems: 1, items: { $ref: "#/components/schemas/PurchaseUnitRequest" } }
        application_context: { $ref: "#/components/schemas/ApplicationContext" }

    OrderResource:
      type: object
      properties:
        id: { type: string }
        intent: { type: string, enum: [CAPTURE, AUTHORIZE] }
        status: { type: string, enum: [CREATED, SAVED, APPROVED, VOIDED, COMPLETED, PAYER_ACTION_REQUIRED] }
        payer: { $ref: "#/components/schemas/Payer" }
        purchase_units:
          type: array
          items:
            type: object
            properties:
              reference_id: { type: string }
              amount: { $ref: "#/components/schemas/AmountWithBreakdown" }
              payee: { $ref: "#/components/schemas/Payee" }
              payments:
                type: object
                properties:
                  captures: { type: array, items: { $ref: "#/components/schemas/CaptureResource" } }
                  refunds: { type: array, items: { $ref: "#/components/schemas/RefundResource" } }
        create_time: { type: string, format: date-time }

    InvoiceDetail:
      type: object
      required: [currency_code]
      properties:
        invoice_number: { type: string, maxLength: 127 }
        invoice_date: { type: string, pattern: "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$" }
        currency_code: { $ref: "#/components/schemas/CurrencyCode" }
        note: { type: string, maxLength: 4000 }

    RecipientInfo:
      type: object
      properties:
        billing_info:
          type: object
          properties:
            email_address: { type: string, format: email }
            name: { type: object, properties: { given_name: { type: string }, surname: { type: string } } }

    InvoiceItem:
      type: object
      required: [name, quantity, unit_amount]
      properties:
        name: { type: string, maxLength: 200 }
        quantity: { type: string }
        unit_amount: { $ref: "#/components/schemas/Money" }

    InvoiceRequest:
      type: object
      required: [detail]
      properties:
        detail: { $ref: "#/components/schemas/InvoiceDetail" }
        primary_recipients: { type: array, items: { $ref: "#/components/schemas/RecipientInfo" } }
        items: { type: array, items: { $ref: "#/components/schemas/InvoiceItem" } }
        amount: { $ref: "#/components/schemas/Money" }

    InvoiceResource:
      type: object
      properties:
        id: { type: string }
        status: { type: string, enum: [DRAFT, SENT, SCHEDULED, PAID, MARKED_AS_PAID, CANCELLED, REFUNDED, PARTIALLY_PAID, UNPAID] }
        detail: { $ref: "#/components/schemas/InvoiceDetail" }
        primary_recipients: { type: array, items: { $ref: "#/components/schemas/RecipientInfo" } }
        amount: { $ref: "#/components/schemas/Money" }

    DisputeMessage:
      type: object
      properties:
        posted_by: { type: string, enum: [BUYER, SELLER, ARBITER] }
        time_posted: { type: string, format: date-time }
        content: { type: string, maxLength: 2000 }

    DisputeResource:
      type: object
      properties:
        dispute_id: { type: string }
        create_time: { type: string, format: date-time }
        reason:
          type: string
          enum:
            - MERCHANDISE_OR_SERVICE_NOT_RECEIVED
            - MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED
            - UNAUTHORIZED
            - CREDIT_NOT_PROCESSED
            - DUPLICATE_TRANSACTION
            - INCORRECT_AMOUNT
            - OTHER
        status:
          type: string
          enum: [OPEN, WAITING_FOR_BUYER_RESPONSE, WAITING_FOR_SELLER_RESPONSE, UNDER_REVIEW, APPEALABLE, RESOLVED]
        dispute_amount: { $ref: "#/components/schemas/Money" }
        dispute_life_cycle_stage: { type: string, enum: [INQUIRY, CHARGEBACK, PRE_ARBITRATION, ARBITRATION] }
        messages: { type: array, items: { $ref: "#/components/schemas/DisputeMessage" } }
        seller_response_due_date: { type: string, format: date-time }

    ErrorResponse:
      type: object
      required: [name, message]
      properties:
        name: { type: string, enum: [INVALID_REQUEST, UNPROCESSABLE_ENTITY, RESOURCE_NOT_FOUND, NOT_AUTHORIZED, INTERNAL_SERVER_ERROR] }
        message: { type: string }
        debug_id: { type: string }

--------------------------------------------------------------------------------
SECTION 2: CORE PAYPAL REST ENDPOINT DEFINITIONS (PATHS)
--------------------------------------------------------------------------------
paths:
  /v2/checkout/orders:
    post:
      operationId: createCheckoutOrder
      summary: Create checkout order
      description: Creates an order with CAPTURE or AUTHORIZE intent and purchase_units[].
      parameters:
        - $ref: "#/components/parameters/PayPalRequestId"
        - $ref: "#/components/parameters/PreferHeader"
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: "#/components/schemas/OrderRequest" } } }
      responses:
        "201": { description: Created order, content: { application/json: { schema: { $ref: "#/components/schemas/OrderResource" } } } }
        "400": { description: Malformed syntax or missing parameters. }
        "422": { description: Semantic validation error (AMOUNT_MISMATCH, CURRENCY_NOT_SUPPORTED). }

  /v2/checkout/orders/{id}:
    get:
      operationId: getCheckoutOrder
      summary: Show order details
      description: Shows order details by ID to verify status === "APPROVED" or "COMPLETED".
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, pattern: "^[A-Z0-9]+$" } }
      responses:
        "200": { description: Order resource, content: { application/json: { schema: { $ref: "#/components/schemas/OrderResource" } } } }
        "404": { description: Order ID not found (RESOURCE_NOT_FOUND). }

  /v2/checkout/orders/{id}/capture:
    post:
      operationId: captureCheckoutOrder
      summary: Capture payment for order
      description: Captures payment for an APPROVED order, generating a capture ID.
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, pattern: "^[A-Z0-9]+$" } }
        - $ref: "#/components/parameters/PayPalRequestId"
      responses:
        "201": { description: Captured order, content: { application/json: { schema: { $ref: "#/components/schemas/OrderResource" } } } }
        "422": { description: Validation error (ORDER_NOT_APPROVED, ORDER_ALREADY_CAPTURED, INSTRUMENT_DECLINED). }

  /v2/payments/captures/{id}/refund:
    post:
      operationId: refundCapturedPayment
      summary: Refund captured payment
      description: Refunds a captured payment by capture ID (empty body for full refund, amount for partial).
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, pattern: "^[A-Z0-9]+$" } }
        - $ref: "#/components/parameters/PayPalRequestId"
      requestBody:
        required: false
        content: { application/json: { schema: { $ref: "#/components/schemas/RefundRequest" } } }
      responses:
        "201": { description: Refund details, content: { application/json: { schema: { $ref: "#/components/schemas/RefundResource" } } } }
        "422": { description: Unprocessable entity (CAPTURE_FULLY_REFUNDED, REFUND_AMOUNT_EXCEEDED). }

  /v2/invoicing/invoices:
    post:
      operationId: createDraftInvoice
      summary: Create draft invoice
      description: Creates a draft invoice with detail, primary_recipients, items, and amount.
      parameters:
        - $ref: "#/components/parameters/PayPalRequestId"
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: "#/components/schemas/InvoiceRequest" } } }
      responses:
        "201": { description: Created draft invoice, content: { application/json: { schema: { $ref: "#/components/schemas/InvoiceResource" } } } }
        "422": { description: Validation failure (DUPLICATE_INVOICE_NUMBER, MISSING_RECIPIENT_EMAIL). }

  /v1/customer/disputes/{id}:
    get:
      operationId: getCustomerDispute
      summary: Show dispute details
      description: Retrieves dispute_id, reason, status, dispute_amount, and messages for arbitration.
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
      responses:
        "200": { description: Dispute resource, content: { application/json: { schema: { $ref: "#/components/schemas/DisputeResource" } } } }
        "404": { description: Dispute ID not found. }

--------------------------------------------------------------------------------
SECTION 3: DETERMINISTIC EXECUTION & ARBITRATION GOVERNANCE RULES
--------------------------------------------------------------------------------
1. ORDER & CAPTURE LIFECYCLE (DETERMINISTIC CRUD):
   - Invoke createCheckoutOrder (POST /v2/checkout/orders) with intent="CAPTURE" unless "AUTHORIZE" is requested.
   - Format monetary values as strings with exact decimal precision (e.g., "100.00" for USD).
   - Check order status via getCheckoutOrder (GET /v2/checkout/orders/{id}) by inspecting the pruned "status" field.
   - Invoke captureCheckoutOrder (POST /v2/checkout/orders/{id}/capture) only when status === "APPROVED".

2. REFUND GOVERNANCE (DETERMINISTIC CRUD):
   - Refunds operate on Capture IDs (/v2/payments/captures/{id}/refund), never on Order IDs.
   - Ensure refund amount does not exceed captured amount; include note_to_payer and invoice_id when supplied.

3. INVOICING WORKFLOW (DETERMINISTIC CRUD):
   - Create draft invoices via createDraftInvoice (POST /v2/invoicing/invoices) with detail.currency_code, detail.invoice_number, primary_recipients[].billing_info.email_address, and items[].

4. DISPUTE & CHARGEBACK ARBITRATION (HIGH-COMPLEXITY REASONING):
   - For GET /v1/customer/disputes/{id}, evaluate reason (MERCHANDISE_OR_SERVICE_NOT_RECEIVED, MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED, UNAUTHORIZED, DUPLICATE_TRANSACTION), status, dispute_amount, and latest_message to recommend ACCEPT_CLAIM, PROVIDE_EVIDENCE, or ESCALATE_TO_ARBITRATION.
================================================================================`;

/**
 * Estimates the token count of a string using standard BPE approximation (~4.0 chars/token).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(Buffer.byteLength(text, 'utf8') / 4.0);
}

/**
 * Verifies that the static prefix crosses the 4,096-token Gemini 4 Argon cache boundary
 * (target: ~4,200 - 4,500 tokens) and starts cleanly at byte 0 with zero dynamic interpolations.
 */
export function verifyPrefixCacheCompliance(): {
  isValid: boolean;
  byteLength: number;
  estimatedTokens: number;
  crossesCacheCliff: boolean;
} {
  const byteLength = Buffer.byteLength(PAYPAL_STATIC_PREFIX_SPEC, 'utf8');
  const estimatedTokens = estimateTokenCount(PAYPAL_STATIC_PREFIX_SPEC);
  const crossesCacheCliff = estimatedTokens >= 4096 && estimatedTokens <= 4600;
  const startsAtByteZero = PAYPAL_STATIC_PREFIX_SPEC.startsWith(
    '================================================================================\nARGONPAY'
  );

  return {
    isValid: crossesCacheCliff && startsAtByteZero,
    byteLength,
    estimatedTokens,
    crossesCacheCliff,
  };
}

/**
 * Multi-model cache extension helper:
 * Formats the static prefix + dynamic turn context for Gemini, Anthropic (`cache_control`), or OpenAI.
 */
export function buildMultiModelPromptEnvelope(
  provider: 'gemini' | 'anthropic' | 'openai',
  dynamicTurnContext: string
): Record<string, any> {
  switch (provider) {
    case 'anthropic':
      return {
        system: [
          {
            type: 'text',
            text: PAYPAL_STATIC_PREFIX_SPEC,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: dynamicTurnContext }],
      };
    case 'openai':
      return {
        messages: [
          { role: 'system', content: PAYPAL_STATIC_PREFIX_SPEC },
          { role: 'user', content: dynamicTurnContext },
        ],
      };
    case 'gemini':
    default:
      // Gemini 4 Argon implicit prefix caching requires byte-0 static alignment
      return {
        system_instruction: PAYPAL_STATIC_PREFIX_SPEC,
        input: `${PAYPAL_STATIC_PREFIX_SPEC}\n\n[DYNAMIC_OPERATOR_TURN]\n${dynamicTurnContext}`,
      };
  }
}
