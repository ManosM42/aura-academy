// Automated tests for the direct AADE myDATA modules. They use mocks only: NO network call is made, so a
// pass proves the code's own logic and nothing about real AADE connectivity or acceptance.
//
// Run with Node (>= 22.6):  node --experimental-strip-types --test supabase/functions/_shared/mydata/mydata.test.ts
// Run with Deno:            deno test supabase/functions/_shared/mydata/mydata.test.ts

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { endpointFor, MYDATA_BASE_URLS } from "./endpoints.ts";
import { buildInvoicesDoc, centsToDecimal, escapeXml, splitGross, validateInvoiceInput } from "./xml.ts";
import {
  findTransmitted,
  interpretCancelResponse,
  interpretSubmitResponse,
  parseRequestedInvoices,
  parseResponseDoc,
} from "./response.ts";
import { createMyDataClient } from "./client.ts";
import type { FetchLike } from "./client.ts";
import { loadCredentials } from "./credentials.ts";
import { assertPaymentMatchesEnvironment, resolveRuntime, selectActiveEnvironment } from "./config.ts";
import type { MyDataCredentials, MyDataInvoiceInput } from "./types.ts";

const DEMO_CREDS: MyDataCredentials = { environment: "demo", userId: "demo-user", subscriptionKey: "demo-key-SECRET" };
const LIVE_CREDS: MyDataCredentials = { environment: "live", userId: "live-user", subscriptionKey: "live-key-SECRET" };

function sampleInvoice(overrides: Partial<MyDataInvoiceInput> = {}): MyDataInvoiceInput {
  return {
    issuer: { vatNumber: "999999999", country: "GR", branch: 0 },
    series: "A",
    aa: "101",
    issueDate: "2026-11-27",
    invoiceType: "11.2",
    lines: [
      {
        lineNumber: 1,
        netValue: 8065n,
        vatCategory: 1,
        vatAmount: 1935n,
        incomeClassifications: [{ classificationType: "E3_561_003", classificationCategory: "category1_3", amount: 8065n }],
      },
    ],
    payments: [{ type: 3, amount: 10000n, transactionId: "tx-1" }],
    ...overrides,
  };
}
const OPTIONS = { today: "2026-11-28" };

function successBody(mark = "400000000000001", uid = "UID123"): string {
  return `<?xml version="1.0"?><ResponseDoc><response><index>1</index><invoiceUid>${uid}</invoiceUid><invoiceMark>${mark}</invoiceMark><authenticationCode>AUTH1</authenticationCode><statusCode>Success</statusCode></response></ResponseDoc>`;
}
function errorBody(status: string, code: string, message: string): string {
  return `<ResponseDoc><response><index>1</index><statusCode>${status}</statusCode><errors><error><message>${message}</message><code>${code}</code></error></errors></response></ResponseDoc>`;
}

describe("DEMO / LIVE endpoint selection", () => {
  test("demo and live resolve to the official, different hosts", () => {
    assert.equal(endpointFor("demo", "SendInvoices"), "https://mydataapidev.aade.gr/SendInvoices");
    assert.equal(endpointFor("live", "SendInvoices"), "https://mydatapi.aade.gr/myDATA/SendInvoices");
    assert.notEqual(MYDATA_BASE_URLS.demo, MYDATA_BASE_URLS.live);
  });
  test("query parameters are encoded and undefined ones dropped", () => {
    assert.equal(endpointFor("demo", "CancelInvoice", { mark: "123" }), "https://mydataapidev.aade.gr/CancelInvoice?mark=123");
    assert.equal(endpointFor("demo", "RequestTransmittedDocs", { mark: 0, dateFrom: undefined }), "https://mydataapidev.aade.gr/RequestTransmittedDocs?mark=0");
  });
  test("an unknown environment or operation is refused, never defaulted", () => {
    assert.throws(() => endpointFor("prod" as never, "SendInvoices"), { name: "MyDataConfigError" });
    assert.throws(() => endpointFor("" as never, "SendInvoices"), { name: "MyDataConfigError" });
    assert.throws(() => endpointFor("demo", "DropTables" as never), { name: "MyDataConfigError" });
  });
});

describe("credential isolation", () => {
  test("a client refuses credentials of the other environment", () => {
    assert.throws(() => createMyDataClient({ environment: "live", credentials: DEMO_CREDS }), { code: "credential_environment_mismatch" });
    assert.throws(() => createMyDataClient({ environment: "demo", credentials: LIVE_CREDS }), { code: "credential_environment_mismatch" });
  });
  test("a demo client sends demo credentials to the demo host only", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, headers: init.headers });
      return Promise.resolve({ status: 200, text: () => Promise.resolve(successBody()) });
    };
    const client = createMyDataClient({ environment: "demo", credentials: DEMO_CREDS, fetchImpl });
    await client.sendInvoices(buildInvoicesDoc(sampleInvoice(), OPTIONS));
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith("https://mydataapidev.aade.gr/"));
    assert.equal(calls[0].headers["aade-user-id"], "demo-user");
    assert.equal(calls[0].headers["ocp-apim-subscription-key"], "demo-key-SECRET");
    assert.ok(!JSON.stringify(calls[0]).includes("live-"));
  });
  test("a live client sends live credentials to the live host only", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, headers: init.headers });
      return Promise.resolve({ status: 200, text: () => Promise.resolve("<RequestedDoc/>") });
    };
    const client = createMyDataClient({ environment: "live", credentials: LIVE_CREDS, fetchImpl });
    await client.testConnection();
    assert.ok(calls[0].url.startsWith("https://mydatapi.aade.gr/myDATA/"));
    assert.equal(calls[0].headers["aade-user-id"], "live-user");
    assert.ok(!JSON.stringify(calls[0]).includes("demo-"));
  });
  test("incomplete credentials are refused before any request", () => {
    let called = false;
    const fetchImpl: FetchLike = () => {
      called = true;
      return Promise.resolve({ status: 200, text: () => Promise.resolve("") });
    };
    assert.throws(() => createMyDataClient({ environment: "demo", credentials: { ...DEMO_CREDS, subscriptionKey: "" }, fetchImpl }), { code: "credentials_missing" });
    assert.equal(called, false);
  });
  test("loadCredentials asks the database for exactly the requested environment", async () => {
    const asked: unknown[] = [];
    const db = {
      rpc: (fn: string, args: Record<string, unknown>) => {
        asked.push([fn, args]);
        return Promise.resolve({ data: [{ user_id: " u ", subscription_key: " k " }], error: null });
      },
    };
    const creds = await loadCredentials(db, "demo");
    assert.deepEqual(asked, [["mydata_get_credentials", { p_environment: "demo" }]]);
    assert.deepEqual({ ...creds }, { environment: "demo", userId: "u", subscriptionKey: "k" });
    assert.ok(Object.isFrozen(creds));
  });
  test("missing or failing credential storage is an error, with no secret in the message", async () => {
    const empty = { rpc: () => Promise.resolve({ data: [{ user_id: null, subscription_key: null }], error: null }) };
    await assert.rejects(loadCredentials(empty, "live"), { code: "credentials_missing" });
    const failing = { rpc: () => Promise.resolve({ data: null, error: { message: "vault exploded with secret=abc" } }) };
    await assert.rejects(loadCredentials(failing, "live"), (e: Error) => !e.message.includes("abc"));
    await assert.rejects(loadCredentials(empty, "staging" as never), { code: "invalid_environment" });
  });
  test("network errors never leak the credentials", async () => {
    const fetchImpl: FetchLike = () => Promise.reject(new Error("connect failed for key demo-key-SECRET user demo-user"));
    const client = createMyDataClient({ environment: "demo", credentials: DEMO_CREDS, fetchImpl });
    const result = await client.sendInvoices("<x/>");
    assert.equal(result.outcome.kind, "unknown");
    assert.ok(!JSON.stringify(result.outcome).includes("demo-key-SECRET"));
    assert.ok(!JSON.stringify(result.outcome).includes("demo-user"));
  });
});

describe("active environment and LIVE safeguards", () => {
  const settings = [
    { environment: "demo", base_url: MYDATA_BASE_URLS.demo, issuer_vat_number: "999999999", issuer_branch: 0, issuer_country: "GR", series: "D" },
    { environment: "live", base_url: MYDATA_BASE_URLS.live, issuer_vat_number: "123456789", issuer_branch: 0, issuer_country: "GR", series: "L" },
  ];
  test("issuance requires the myDATA channel", () => {
    assert.throws(() => selectActiveEnvironment({ active_environment: "demo", live_enabled: false, issuance_channel: "none" }), { code: "channel_not_mydata" });
    assert.throws(() => selectActiveEnvironment({ active_environment: "demo", live_enabled: false, issuance_channel: "viva_fiscalisation" }), { code: "channel_not_mydata" });
  });
  test("LIVE is refused unless explicitly enabled", () => {
    assert.throws(() => selectActiveEnvironment({ active_environment: "live", live_enabled: false, issuance_channel: "mydata" }), { code: "live_not_enabled" });
    assert.equal(selectActiveEnvironment({ active_environment: "live", live_enabled: true, issuance_channel: "mydata" }), "live");
    assert.equal(selectActiveEnvironment({ active_environment: "demo", live_enabled: false, issuance_channel: "mydata" }), "demo");
  });
  test("settings must match the active environment and its official endpoint", () => {
    const demo = resolveRuntime({ active_environment: "demo", live_enabled: false, issuance_channel: "mydata" }, settings);
    assert.equal(demo.environment, "demo");
    assert.equal(demo.issuerVatNumber, "999999999");
    assert.equal(demo.series, "D");
    const tampered = settings.map((s) => (s.environment === "demo" ? { ...s, base_url: MYDATA_BASE_URLS.live } : s));
    assert.throws(() => resolveRuntime({ active_environment: "demo", live_enabled: false, issuance_channel: "mydata" }, tampered), { code: "endpoint_mismatch" });
  });
  test("missing issuer data blocks issuance", () => {
    const noVat = settings.map((s) => ({ ...s, issuer_vat_number: null }));
    assert.throws(() => resolveRuntime({ active_environment: "demo", live_enabled: false, issuance_channel: "mydata" }, noVat), { code: "issuer_missing" });
  });
  test("Viva payment environment must correspond to the myDATA environment", () => {
    assertPaymentMatchesEnvironment("sandbox", "demo");
    assertPaymentMatchesEnvironment("production", "live");
    assert.throws(() => assertPaymentMatchesEnvironment("sandbox", "live"), { code: "environment_mismatch" });
    assert.throws(() => assertPaymentMatchesEnvironment("production", "demo"), { code: "environment_mismatch" });
    assert.throws(() => assertPaymentMatchesEnvironment(undefined, "demo"), { code: "payment_environment_unknown" });
  });
});

describe("InvoicesDoc XML", () => {
  test("follows the order and namespaces of AADE's sample", () => {
    const xml = buildInvoicesDoc(sampleInvoice(), OPTIONS);
    assert.ok(xml.includes('xmlns="http://www.aade.gr/myDATA/invoice/v1.0"'));
    assert.ok(xml.includes('xmlns:icls="https://www.aade.gr/myDATA/incomeClassificaton/v1.0"'));
    const order = ["<issuer>", "<invoiceHeader>", "<paymentMethods>", "<invoiceDetails>", "<invoiceSummary>"].map((t) => xml.indexOf(t));
    assert.ok(order.every((i) => i > 0));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.ok(xml.includes("<incomeClassification><icls:classificationType>E3_561_003</icls:classificationType>"));
    assert.ok(xml.includes("<totalGrossValue>100.00</totalGrossValue>"));
    assert.ok(xml.includes("<netValue>80.65</netValue>"));
    assert.ok(xml.includes("<vatAmount>19.35</vatAmount>"));
  });
  test("escapes markup in free text", () => {
    const input = sampleInvoice();
    input.lines[0].lineComments = `a & <b> "c"`;
    const xml = buildInvoicesDoc(input, OPTIONS);
    assert.ok(xml.includes("a &amp; &lt;b&gt; &quot;c&quot;"));
    assert.equal(escapeXml("x\u0000y"), "xy");
  });
  test("rejects invalid input with every problem listed", () => {
    const bad = sampleInvoice({ issueDate: "2026-12-31", invoiceType: "99.9", payments: [{ type: 3, amount: 1n }] });
    assert.throws(() => validateInvoiceInput(bad, OPTIONS), (e: Error & { problems?: string[] }) => {
      return e.name === "MyDataValidationError" && (e.problems?.length ?? 0) >= 3;
    });
  });
  test("VAT exemption category is required exactly for vatCategory 7", () => {
    const zero = sampleInvoice();
    zero.lines[0] = { ...zero.lines[0], vatCategory: 7, vatAmount: 0n, netValue: 10000n };
    assert.throws(() => buildInvoicesDoc(zero, OPTIONS), /vatExemptionCategory is required/);
    zero.lines[0].vatExemptionCategory = 3;
    assert.doesNotThrow(() => buildInvoicesDoc(zero, OPTIONS));
    const wrong = sampleInvoice();
    wrong.lines[0].vatExemptionCategory = 3;
    assert.throws(() => buildInvoicesDoc(wrong, OPTIONS), /only allowed when vatCategory is 7/);
  });
  test("Greek issuer may not carry name or address, Greek counterpart may not carry a name", () => {
    assert.throws(() => buildInvoicesDoc(sampleInvoice({ issuer: { vatNumber: "999999999", country: "GR", branch: 0, name: "ACME" } }), OPTIONS), /Greek issuer/);
    assert.throws(
      () => buildInvoicesDoc(sampleInvoice({ counterpart: { vatNumber: "888888888", country: "GR", branch: 0, name: "X" } }), OPTIONS),
      /Greek counterpart/,
    );
  });
  test("income classification and a payment are mandatory; amounts must balance", () => {
    const noClass = sampleInvoice();
    noClass.lines[0].incomeClassifications = [];
    assert.throws(() => buildInvoicesDoc(noClass, OPTIONS), /income classification is required/);
    assert.throws(() => buildInvoicesDoc(sampleInvoice({ payments: [] }), OPTIONS), /payment method is required/);
    assert.throws(() => buildInvoicesDoc(sampleInvoice({ payments: [{ type: 3, amount: 9999n }] }), OPTIONS), /add up/);
  });
  test("centsToDecimal and splitGross are exact", () => {
    assert.equal(centsToDecimal(5n), "0.05");
    assert.equal(centsToDecimal(123456n), "1234.56");
    assert.throws(() => centsToDecimal(-1n));
    for (const gross of [1n, 99n, 1000n, 12345n, 99999n]) {
      for (const rate of [0, 600, 1300, 2400]) {
        const { net, vat } = splitGross(gross, rate);
        assert.equal(net + vat, gross, `gross ${gross} rate ${rate}`);
        assert.ok(net >= 0n && vat >= 0n);
      }
    }
    assert.deepEqual(splitGross(10000n, 2400), { net: 8065n, vat: 1935n });
  });
});

describe("AADE response interpretation", () => {
  test("Success with UID and MARK is transmitted", () => {
    const o = interpretSubmitResponse(200, successBody());
    assert.equal(o.kind, "transmitted");
    if (o.kind === "transmitted") {
      assert.equal(o.uid, "UID123");
      assert.equal(o.mark, "400000000000001");
      assert.equal(o.authenticationCode, "AUTH1");
    }
  });
  test("HTTP 200 with a ValidationError body is a rejection, not a success", () => {
    const o = interpretSubmitResponse(200, errorBody("ValidationError", "205", "Invalid VAT"));
    assert.equal(o.kind, "rejected");
    if (o.kind === "rejected") {
      assert.equal(o.statusCode, "ValidationError");
      assert.deepEqual(o.errors, [{ code: "205", message: "Invalid VAT" }]);
    }
  });
  test("XMLSyntaxError is a rejection; TechnicalError needs reconciliation", () => {
    assert.equal(interpretSubmitResponse(200, errorBody("XMLSyntaxError", "101", "bad xml")).kind, "rejected");
    assert.equal(interpretSubmitResponse(200, errorBody("TechnicalError", "500", "oops")).kind, "technical");
  });
  test("a body that cannot be trusted is never reported as success", () => {
    assert.equal(interpretSubmitResponse(200, "<html>gateway</html>").kind, "unverified");
    assert.equal(interpretSubmitResponse(200, "").kind, "unverified");
    const noMark = `<ResponseDoc><response><index>1</index><invoiceUid>U</invoiceUid><statusCode>Success</statusCode></response></ResponseDoc>`;
    assert.equal(interpretSubmitResponse(200, noMark).kind, "unverified");
    const two = successBody() .replace("</ResponseDoc>", "") + successBody().replace(/<\?xml[^>]*\?>/, "").replace("<ResponseDoc>", "");
    assert.equal(interpretSubmitResponse(200, two).kind, "unverified");
    assert.equal(interpretSubmitResponse(200, `<ResponseDoc><response><statusCode>Maybe</statusCode></response></ResponseDoc>`).kind, "unverified");
  });
  test("HTTP-level outcomes", () => {
    assert.equal(interpretSubmitResponse(401, "").kind, "auth_failed");
    assert.equal(interpretSubmitResponse(403, "").kind, "auth_failed");
    assert.equal(interpretSubmitResponse(429, "").kind, "not_sent");
    assert.equal(interpretSubmitResponse(500, "").kind, "unknown");
    assert.equal(interpretSubmitResponse(503, "").kind, "unknown");
    assert.equal(interpretSubmitResponse(400, "bad").kind, "rejected");
  });
  test("entities in messages are decoded and the parser tolerates namespaces", () => {
    const items = parseResponseDoc(`<a:ResponseDoc xmlns:a="x"><a:response><a:statusCode>ValidationError</a:statusCode><a:errors><a:error><a:message>x &amp; y</a:message><a:code>1</a:code></a:error></a:errors></a:response></a:ResponseDoc>`);
    assert.equal(items[0].errors[0].message, "x & y");
  });
  test("cancellation outcomes", () => {
    const ok = `<ResponseDoc><response><index>1</index><statusCode>Success</statusCode><cancellationMark>400000000000009</cancellationMark></response></ResponseDoc>`;
    const o = interpretCancelResponse(200, ok);
    assert.equal(o.kind, "cancelled");
    assert.equal(interpretCancelResponse(200, errorBody("ValidationError", "1", "no")).kind, "rejected");
    assert.equal(interpretCancelResponse(500, "").kind, "unknown");
    assert.equal(interpretCancelResponse(200, `<ResponseDoc><response><statusCode>Success</statusCode></response></ResponseDoc>`).kind, "unverified");
  });
  test("reconciliation finds our invoice and ignores cancelled ones", () => {
    const body = `<RequestedDoc><invoicesDoc>
      <invoice><uid>U1</uid><mark>11</mark><cancelledByMark>99</cancelledByMark><issuer><vatNumber>999999999</vatNumber></issuer><invoiceHeader><series>A</series><aa>101</aa></invoiceHeader></invoice>
      <invoice><uid>U2</uid><mark>12</mark><issuer><vatNumber>999999999</vatNumber></issuer><invoiceHeader><series>A</series><aa>101</aa><issueDate>2026-11-27</issueDate></invoiceHeader><invoiceSummary><totalGrossValue>100.00</totalGrossValue></invoiceSummary></invoice>
      </invoicesDoc></RequestedDoc>`;
    const invoices = parseRequestedInvoices(body);
    assert.equal(invoices.length, 2);
    const found = findTransmitted(invoices, { issuerVatNumber: "999999999", series: "A", aa: "101" });
    assert.equal(found?.mark, "12");
    assert.equal(found?.totalGrossValue, "100.00");
    assert.equal(findTransmitted(invoices, { issuerVatNumber: "999999999", series: "A", aa: "102" }), null);
  });
});

describe("client behaviour", () => {
  test("timeouts and network failures are 'unknown' (must be reconciled), never success or silent retry", async () => {
    const slow: FetchLike = (_u, init) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    const client = createMyDataClient({ environment: "demo", credentials: DEMO_CREDS, fetchImpl: slow, timeoutMs: 20 });
    const r = await client.sendInvoices("<x/>");
    assert.equal(r.outcome.kind, "unknown");
    if (r.outcome.kind === "unknown") assert.equal(r.outcome.errorKind, "timeout");
  });
  test("the same document always has the same request hash", async () => {
    const fetchImpl: FetchLike = () => Promise.resolve({ status: 200, text: () => Promise.resolve(successBody()) });
    const client = createMyDataClient({ environment: "demo", credentials: DEMO_CREDS, fetchImpl });
    const xml = buildInvoicesDoc(sampleInvoice(), OPTIONS);
    const a = await client.sendInvoices(xml);
    const b = await client.sendInvoices(xml);
    assert.equal(a.requestSha256, b.requestSha256);
    assert.match(a.requestSha256, /^[0-9a-f]{64}$/);
  });
  test("connection test classification", async () => {
    const make = (status: number): FetchLike => () => Promise.resolve({ status, text: () => Promise.resolve("") });
    const run = (status: number) => createMyDataClient({ environment: "demo", credentials: DEMO_CREDS, fetchImpl: make(status) }).testConnection();
    assert.equal((await run(200)).kind, "ok");
    assert.equal((await run(401)).kind, "auth_failed");
    assert.equal((await run(503)).kind, "unreachable");
    assert.equal((await run(404)).kind, "inconclusive");
    const down = createMyDataClient({ environment: "demo", credentials: DEMO_CREDS, fetchImpl: () => Promise.reject(new Error("ENOTFOUND")) });
    assert.equal((await down.testConnection()).kind, "unreachable");
  });
  test("connection test sends a read-only GET and no body", async () => {
    let seen: { method: string; body?: string } | null = null;
    const fetchImpl: FetchLike = (_u, init) => {
      seen = { method: init.method, body: init.body };
      return Promise.resolve({ status: 200, text: () => Promise.resolve("") });
    };
    await createMyDataClient({ environment: "live", credentials: LIVE_CREDS, fetchImpl }).testConnection();
    assert.deepEqual(seen, { method: "GET", body: undefined });
  });
  test("cancel and reconcile validate their inputs", async () => {
    const fetchImpl: FetchLike = () => Promise.resolve({ status: 200, text: () => Promise.resolve("<RequestedDoc/>") });
    const client = createMyDataClient({ environment: "demo", credentials: DEMO_CREDS, fetchImpl });
    await assert.rejects(client.cancelInvoice("12; DROP"), { code: "invalid_mark" });
    assert.equal(await client.reconcile({ issuerVatNumber: "1", series: "A", aa: "1", issueDate: "2026-11-27" }), null);
  });
});
