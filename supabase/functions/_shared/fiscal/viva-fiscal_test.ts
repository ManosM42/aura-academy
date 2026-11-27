// Run: deno test supabase/functions/_shared/fiscal/viva-fiscal_test.ts
import { assert, assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@^1";
import {
  buildGreekCaseData,
  buildHashPayload,
  classifyFtState,
  extractMark,
  FiscalValidationError,
  formatHashAmount,
  formatReceiptMoment,
  interpretSignResult,
  interpretZeroReceipt,
  isQueueAlreadyOperational,
  parseAcceptedFtStates,
  parseResponseBody,
  postReceipt,
  type FiscalTransportResult,
  type SaleSuccessPolicy,
  validateReceiptRequest,
} from "./viva-fiscal.ts";
import { FT_RECEIPT_CASE_GR, FT_STATE_GR_QUEUE_READY, type FiscalReceiptRequest } from "./types.ts";

// Test-only policy. This is not a statement about which ftState values Viva documents for sales.
const ACCEPT_ZERO: SaleSuccessPolicy = { acceptedFtStates: ["0"] };
const UNCONFIGURED: SaleSuccessPolicy = { acceptedFtStates: [] };

const token = () => Promise.resolve("test-token");

// Values copied from Viva's sign sample, to exercise the code. They are not tax advice.
function buildRequest(overrides: Partial<FiscalReceiptRequest> = {}): FiscalReceiptRequest {
  const receiptReference = "testreceiptreference1";
  const receiptMoment = "2026-07-10T11:28:00Z";
  const receiptAmount = 1780n;
  return {
    sessionId: "9e346121-cb51-4234-86cb-7c347bfe05d1",
    receiptReference,
    receiptMoment,
    ftReceiptCase: 5139205309155770369n,
    currencyCode: "978",
    receiptAmount,
    customer: null,
    chargeItems: [
      {
        position: 1,
        description: "product x",
        quantity: 200,
        unitPrice: null,
        amount: 1780n,
        vatRate: 0,
        vatAmount: 0n,
        moment: receiptMoment,
        ftChargeItemCase: 5139205309155246098n,
        currencyCode: "978",
      },
    ],
    payItems: [
      {
        position: 1,
        description: "card-payment",
        amount: 1780n,
        moment: receiptMoment,
        ftPayItemCase: 5139205309155246082n,
        currencyCode: "978",
        transactionId: "27efa6c4-1e51-440e-96c8-e674a04c9184",
      },
    ],
    ftReceiptCaseData: buildGreekCaseData({
      merchantVatId: "099565360",
      series: "AB",
      aa: 123,
      receiptReference,
      receiptMoment,
      receiptAmount,
    }),
    ...overrides,
  };
}

function fakeFetch(handler: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    return await handler(url, init ?? {});
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function response(httpStatus: number, text: string): FiscalTransportResult {
  return { kind: "response", httpStatus, excerpt: text, body: parseResponseBody(text) };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const SIGNED_BODY = JSON.stringify({
  ftState: 0,
  ftStateData: null,
  ftReceiptIdentification: "AB#123",
  ftCashBoxIdentification: "cashbox1",
  ftSignatures: [{ caption: "MARK", data: "400001965291818", ftSignatureFormat: 1 }],
  transmissionIndicator: 0,
});

// ---------------------------------------------------------------------------
// HashPayload
// ---------------------------------------------------------------------------

Deno.test("formatHashAmount matches Viva's documented examples", () => {
  const cases: [bigint, string][] = [
    [1780n, "17.8"],
    [124n, "1.24"],
    [12400n, "124.0"],
    [1240n, "12.4"],
    [1000n, "10.0"],
    [2300n, "23.0"],
    [24800n, "248.0"],
    [0n, "0.0"],
    [5n, "0.05"],
    [-124n, "-1.24"],
  ];
  for (const [minor, expected] of cases) assertEquals(formatHashAmount(minor), expected);
});

Deno.test("buildHashPayload reproduces Viva's sample strings", () => {
  assertEquals(
    buildHashPayload({
      merchantVatId: "099565360",
      series: "AB",
      aa: 123,
      receiptReference: "testreceiptreference1",
      receiptMoment: "2026-07-10T11:28:00Z",
      receiptAmount: 1780n,
    }),
    "099565360-AB-123-testreceiptreference1-2026-07-10T11:28:00Z-17.8",
  );
  assertEquals(
    buildHashPayload({
      merchantVatId: "123456789",
      series: "AB",
      aa: 1,
      receiptReference: "testreceiptreference1",
      receiptMoment: "2025-08-27T16:11:06Z",
      receiptAmount: 124n,
    }),
    "123456789-AB-1-testreceiptreference1-2025-08-27T16:11:06Z-1.24",
  );
  assertEquals(
    buildHashPayload({
      merchantVatId: "098765432",
      series: "AB",
      aa: 2,
      receiptReference: "posactionrefund1",
      receiptMoment: "2025-07-17T16:41:06Z",
      receiptAmount: -124n,
    }),
    "098765432-AB-2-posactionrefund1-2025-07-17T16:41:06Z--1.24",
  );
});

Deno.test("formatReceiptMoment drops milliseconds", () => {
  assertEquals(formatReceiptMoment(new Date("2026-07-10T11:28:00.123Z")), "2026-07-10T11:28:00Z");
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

Deno.test("validateReceiptRequest accepts a consistent sale and a start receipt", () => {
  validateReceiptRequest(buildRequest());
  validateReceiptRequest({
    sessionId: crypto.randomUUID(),
    receiptReference: "Start-receipt-2026-11-26T11:30:04Z",
    receiptMoment: "2026-11-26T11:30:04Z",
    ftReceiptCase: FT_RECEIPT_CASE_GR.START,
    currencyCode: "978",
    receiptAmount: 0n,
    customer: null,
    chargeItems: [],
    payItems: [],
    ftReceiptCaseData: null,
  });
});

Deno.test("validateReceiptRequest rejects malformed requests", () => {
  assertThrows(() => validateReceiptRequest(buildRequest({ sessionId: "not-a-uuid" })), FiscalValidationError, "sessionId");
  assertThrows(
    () => validateReceiptRequest(buildRequest({ receiptMoment: "2026-07-10T11:28:00+02:00" })),
    FiscalValidationError,
    "receiptMoment",
  );
  assertThrows(() => validateReceiptRequest(buildRequest({ receiptAmount: 1781n })), FiscalValidationError, "add up");

  const base = buildRequest();
  assertThrows(
    () =>
      validateReceiptRequest({
        ...base,
        ftReceiptCaseData: { GR: { ...base.ftReceiptCaseData!.GR, HashPayload: "tampered" } },
      }),
    FiscalValidationError,
    "HashPayload",
  );
  assertThrows(
    () =>
      validateReceiptRequest({
        ...base,
        payItems: [{ ...base.payItems[0], transactionId: "order-123" }],
      }),
    FiscalValidationError,
    "transactionId",
  );
  assertThrows(
    () =>
      validateReceiptRequest({
        ...base,
        chargeItems: [{ ...base.chargeItems[0], quantity: 0 }],
      }),
    FiscalValidationError,
    "quantity",
  );
});

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

Deno.test("postReceipt sends int64 values as exact integers and hashes the exact body", async () => {
  const { impl, calls } = fakeFetch(() => new Response(SIGNED_BODY, { status: 200 }));
  const { requestSha256 } = await postReceipt("demo", buildRequest(), token, { fetchImpl: impl });

  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, "https://demo-api.vivapayments.com/fiscalization/v1/receipts:sign");
  const headers = calls[0].init.headers as Record<string, string>;
  assertEquals(headers.Authorization, "Bearer test-token");

  const sent = String(calls[0].init.body);
  assert(sent.includes('"cbReceiptAmount":1780,'));
  assert(sent.includes('"ftReceiptCase":5139205309155770369,'));
  assert(sent.includes('"ftChargeItemCase":5139205309155246098,'));
  assertEquals(requestSha256, await sha256Hex(sent));
});

Deno.test("postReceipt uses the live URL for live", async () => {
  const { impl, calls } = fakeFetch(() => new Response(SIGNED_BODY, { status: 200 }));
  await postReceipt("live", buildRequest(), token, { fetchImpl: impl });
  assertEquals(calls[0].url, "https://api.vivapayments.com/fiscalization/v1/receipts:sign");
});

Deno.test("postReceipt leaves description text that looks like internal markers unchanged", async () => {
  const base = buildRequest();
  const req = buildRequest({
    chargeItems: [{ ...base.chargeItems[0], description: "@@bigint:5" }],
  });
  const { impl, calls } = fakeFetch(() => new Response(SIGNED_BODY, { status: 200 }));
  await postReceipt("demo", req, token, { fetchImpl: impl });
  assert(String(calls[0].init.body).includes('"description":"@@bigint:5"'));
});

Deno.test("postReceipt does not call fetch when the token provider fails", async () => {
  const { impl, calls } = fakeFetch(() => new Response("{}", { status: 200 }));
  const { result } = await postReceipt("demo", buildRequest(), () => Promise.reject(new Error("no token")), {
    fetchImpl: impl,
  });
  assertEquals(calls.length, 0);
  assertEquals(result.kind, "not_sent");
  if (result.kind === "not_sent") assertEquals(result.errorKind, "auth");
});

Deno.test("postReceipt maps a timeout to unknown", async () => {
  const { impl } = fakeFetch(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );
  const { result } = await postReceipt("demo", buildRequest(), token, { fetchImpl: impl, timeoutMs: 20 });
  assertEquals(result.kind, "unknown");
  if (result.kind === "unknown") assertEquals(result.errorKind, "timeout");
});

Deno.test("postReceipt maps a network failure to unknown", async () => {
  const { impl } = fakeFetch(() => Promise.reject(new TypeError("connection reset")));
  const { result } = await postReceipt("demo", buildRequest(), token, { fetchImpl: impl });
  assertEquals(result.kind, "unknown");
  if (result.kind === "unknown") assertEquals(result.errorKind, "network");
});

Deno.test("postReceipt rejects invalid requests before any network call", async () => {
  const { impl, calls } = fakeFetch(() => new Response("{}", { status: 200 }));
  await assertRejects(
    () => postReceipt("demo", buildRequest({ sessionId: "bad" }), token, { fetchImpl: impl }),
    FiscalValidationError,
  );
  assertEquals(calls.length, 0);
});

Deno.test("parseResponseBody keeps large integers exact and leaves string text alone", () => {
  const text =
    '{"ftState":5139205309155246080,"note":"a, 5139205309155770370","n":42,' +
    '"ftSignatures":[{"ftSignatureType":4719772409069985813,"data":"x"}]}';
  const body = parseResponseBody(text)!;
  assertEquals(body.ftState, "5139205309155246080");
  assertEquals(body.note, "a, 5139205309155770370");
  assertEquals(body.n, 42);
  assertEquals((body.ftSignatures as Record<string, unknown>[])[0].ftSignatureType, "4719772409069985813");
  assertEquals(parseResponseBody("not json"), null);
  assertEquals(parseResponseBody("[1,2]"), null);
});

// ---------------------------------------------------------------------------
// ftState and MARK
// ---------------------------------------------------------------------------

Deno.test("classifyFtState follows the documented layout", () => {
  assertEquals(classifyFtState(FT_STATE_GR_QUEUE_READY.toString()).kind, "gr_ready");
  assertEquals(classifyFtState((FT_STATE_GR_QUEUE_READY + 0x100n).toString()).kind, "gr_flags");
  assertEquals(classifyFtState((FT_STATE_GR_QUEUE_READY + 0xeeeeeeeen).toString()).kind, "error");
  assertEquals(classifyFtState((FT_STATE_GR_QUEUE_READY + 0xffffffffn).toString()).kind, "fail");
  assertEquals(classifyFtState("0").kind, "literal_zero");
  assertEquals(classifyFtState("12345").kind, "other");
  assertEquals(classifyFtState(null).kind, "unparseable");
  assertEquals(classifyFtState("abc").kind, "unparseable");
});

Deno.test("extractMark finds the MARK by caption or type and refuses ambiguity", () => {
  assertEquals(extractMark([{ caption: "MARK", data: "400001965291818" }]), {
    kind: "found",
    value: "400001965291818",
  });
  assertEquals(extractMark([{ caption: "invoiceMark", data: "400001948544829" }]), {
    kind: "found",
    value: "400001948544829",
  });
  assertEquals(extractMark([{ caption: "", data: "400001948544829", ftSignatureType: "5139205309155246100" }]), {
    kind: "found",
    value: "400001948544829",
  });
  assertEquals(extractMark([{ caption: "MARK", data: "400001965291818" }, { caption: "invoiceMark", data: "400001965291818" }]), {
    kind: "found",
    value: "400001965291818",
  });
  assertEquals(
    extractMark([
      { caption: "MARK", data: "400001965291818" },
      { caption: "invoiceMark", data: "400001948544829" },
    ]).kind,
    "ambiguous",
  );
  assertEquals(extractMark([{}]).kind, "missing");
  assertEquals(extractMark([{ caption: "S A N D B O X", data: "8c0a4594" }]).kind, "missing");
  assertEquals(extractMark(null).kind, "missing");
});

// ---------------------------------------------------------------------------
// interpretSignResult
// ---------------------------------------------------------------------------

Deno.test("an unconfigured policy never yields signed", () => {
  const outcome = interpretSignResult(response(200, SIGNED_BODY), UNCONFIGURED);
  assertEquals(outcome.kind, "unverified");
  if (outcome.kind === "unverified") assertEquals(outcome.reason, "success_rule_unconfigured");
});

Deno.test("a configured policy yields signed with the MARK, not the receipt identification", () => {
  const outcome = interpretSignResult(response(200, SIGNED_BODY), ACCEPT_ZERO);
  if (outcome.kind !== "signed") throw new Error(`expected signed, got ${outcome.kind}`);
  assertEquals(outcome.ftMark, "400001965291818");
  assertEquals(outcome.ftReceiptIdentification, "AB#123");
  assertEquals(outcome.invoiceUid, null);
  assertEquals(outcome.ftState, "0");
});

Deno.test("signed picks up invoiceUid and invoiceMark from the Core Concepts layout", () => {
  const body = JSON.stringify({
    ftState: 0,
    ftReceiptIdentification: "ft5#0-5",
    ftSignatures: [
      { caption: "invoiceUid", data: "FDF3F4414097B4786363FA8A70A98653CFC92B0C", ftSignatureType: 5139205309155246099 },
      { caption: "invoiceMark", data: "400001948544829", ftSignatureType: 5139205309155246100 },
    ],
    transmissionIndicator: 0,
  });
  const outcome = interpretSignResult(response(200, body), ACCEPT_ZERO);
  if (outcome.kind !== "signed") throw new Error(`expected signed, got ${outcome.kind}`);
  assertEquals(outcome.ftMark, "400001948544829");
  assertEquals(outcome.invoiceUid, "FDF3F4414097B4786363FA8A70A98653CFC92B0C");
});

Deno.test("2xx responses that miss a success condition are unverified", () => {
  const withBody = (patch: Record<string, unknown>) =>
    response(200, JSON.stringify({ ...JSON.parse(SIGNED_BODY), ...patch }));

  const cases: [FiscalTransportResult, string][] = [
    [withBody({ transmissionIndicator: 2 }), "transmission_not_confirmed"],
    [withBody({ transmissionIndicator: undefined }), "transmission_not_confirmed"],
    [withBody({ ftReceiptIdentification: "" }), "identification_missing"],
    [withBody({ ftSignatures: [{}] }), "mark_missing"],
    [
      withBody({
        ftSignatures: [
          { caption: "MARK", data: "400001965291818" },
          { caption: "invoiceMark", data: "400001948544829" },
        ],
      }),
      "mark_ambiguous",
    ],
    [withBody({ ftState: 1 }), "ft_state_not_accepted"],
    [withBody({ ftState: (FT_STATE_GR_QUEUE_READY + 0x100n).toString() }), "ft_state_not_accepted"],
  ];
  for (const [result, reason] of cases) {
    const outcome = interpretSignResult(result, ACCEPT_ZERO);
    if (outcome.kind !== "unverified") throw new Error(`expected unverified (${reason}), got ${outcome.kind}`);
    assertEquals(outcome.reason, reason);
  }
});

Deno.test("error and fail ftState are rejected even if the policy lists them", () => {
  for (const flags of [0xeeeeeeeen, 0xffffffffn]) {
    const state = (FT_STATE_GR_QUEUE_READY + flags).toString();
    const body = `{"ftState":${state},"ftReceiptIdentification":"x","transmissionIndicator":0}`;
    const outcome = interpretSignResult(response(200, body), { acceptedFtStates: [state, "0"] });
    assertEquals(outcome.kind, "rejected");
  }
});

Deno.test("a 2xx body that is not JSON is unknown, not rejected", () => {
  const outcome = interpretSignResult(response(200, "<html>ok</html>"), ACCEPT_ZERO);
  assertEquals(outcome.kind, "unknown");
  if (outcome.kind === "unknown") assertEquals(outcome.errorKind, "parse");
});

Deno.test("HTTP errors map to the right outcome", () => {
  const kindOf = (status: number, text = "{}") => interpretSignResult(response(status, text), ACCEPT_ZERO).kind;

  assertEquals(kindOf(401), "not_sent");
  assertEquals(kindOf(403), "not_sent");
  assertEquals(kindOf(404, '{"error":"FiskaltrustInvalidMerchantOrTerminal"}'), "not_sent");
  assertEquals(kindOf(400, '{"error":"FiskaltrustSignReceiptUnknownState"}'), "not_sent");
  assertEquals(kindOf(400), "rejected");
  assertEquals(kindOf(422), "rejected");
  assertEquals(kindOf(408), "unknown");
  assertEquals(kindOf(429), "unknown");
  assertEquals(kindOf(500), "unknown");
  assertEquals(kindOf(502), "unknown");
  assertEquals(kindOf(503), "unknown");

  const config = interpretSignResult(
    response(404, '{"error":"FiskaltrustInvalidMerchantOrTerminal"}'),
    ACCEPT_ZERO,
  );
  if (config.kind === "not_sent") assertEquals(config.errorKind, "config");
  const auth = interpretSignResult(response(401, "{}"), ACCEPT_ZERO);
  if (auth.kind === "not_sent") assertEquals(auth.errorKind, "auth");
});

Deno.test("transport failures keep their meaning", () => {
  const unknown = interpretSignResult({ kind: "unknown", errorKind: "timeout", message: "t" }, ACCEPT_ZERO);
  assertEquals(unknown.kind, "unknown");
  const notSent = interpretSignResult({ kind: "not_sent", errorKind: "config", message: "c" }, ACCEPT_ZERO);
  assertEquals(notSent.kind, "not_sent");
});

// ---------------------------------------------------------------------------
// Queue health, config parsing
// ---------------------------------------------------------------------------

Deno.test("interpretZeroReceipt accepts only the exact documented ready value", () => {
  const ready = interpretZeroReceipt(response(200, `{"ftState":${FT_STATE_GR_QUEUE_READY}}`));
  assertEquals(ready.kind, "ready");
  const flagged = interpretZeroReceipt(response(200, `{"ftState":${FT_STATE_GR_QUEUE_READY + 0x100n}}`));
  assertEquals(flagged.kind, "not_ready");
  const error = interpretZeroReceipt(response(200, `{"ftState":${FT_STATE_GR_QUEUE_READY + 0xeeeeeeeen}}`));
  assertEquals(error.kind, "not_ready");
  assertEquals(interpretZeroReceipt(response(200, "{}")).kind, "unknown");
  assertEquals(interpretZeroReceipt(response(500, "{}")).kind, "unknown");
  assertEquals(interpretZeroReceipt({ kind: "unknown", errorKind: "network", message: "x" }).kind, "unknown");
});

Deno.test("isQueueAlreadyOperational recognises Viva's documented message", () => {
  assert(isQueueAlreadyOperational("The queue is already operational"));
  assert(!isQueueAlreadyOperational("something else"));
});

Deno.test("parseAcceptedFtStates normalises and validates", () => {
  assertEquals(parseAcceptedFtStates(undefined), []);
  assertEquals(parseAcceptedFtStates("  "), []);
  assertEquals(parseAcceptedFtStates(" 0 , 5139205309155246080,0, 007"), ["0", "5139205309155246080", "7"]);
  assertThrows(() => parseAcceptedFtStates("0,abc"), Error, "FISCAL_SALE_ACCEPTED_FT_STATES");
  assertThrows(() => parseAcceptedFtStates("-1"), Error, "FISCAL_SALE_ACCEPTED_FT_STATES");
});