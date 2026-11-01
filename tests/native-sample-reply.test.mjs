import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import handler from "../api/sample-native-reply.js";
import { createNativeSampleButton, verifyNativeSampleButton, sampleFingerprint, sampleRecipient } from "../api/_native-sample-replies.js";

const issuer = { organizationId: "org-fixture", lineId: "line-fixture", bindingGeneration: "generation-fixture", activationId: "activation-fixture" };
const recordId = "recJS7xwhFXHaoPJd";
const attachments = [{ id: "attABCDEFGHIJKLMN" }, { id: "attNOPQRSTUVWXYZA" }];
const callbackSecret = "fixture-callback-secret-of-at-least-32-bytes";

function recorder() {
  return { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, end() { return this; } };
}

function request(buttonId, changes = {}, { timestamp = String(Math.floor(Date.now() / 1000)), secret = callbackSecret } = {}) {
  const body = Buffer.from(JSON.stringify({ version: "native-reply.v1", ...issuer,
    deliveryId: "delivery-fixture", originMessageId: "message-fixture", originProviderMessageId: "provider-original",
    replyProviderMessageId: "provider-reply", rawEventId: "raw-fixture", recipientChatId: "972546969974@s.whatsapp.net",
    selectedButtonId: buttonId, occurredAt: new Date().toISOString(), ...changes }));
  const req = Readable.from([body]);
  req.method = "POST";
  req.headers = { "x-platform-native-reply-timestamp": timestamp,
    "x-platform-native-reply-signature": crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex") };
  return req;
}

test("native callbacks authenticate exact sample/recipient, approve once, and keep comments in WhatsApp", async () => {
  const keys = ["AIRTABLE_TOKEN", "SAMPLE_APPROVAL_SECRET", "SAMPLE_NATIVE_REPLY_CALLBACK_SECRET", "SAMPLE_NATIVE_REPLY_ISSUER"];
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const oldFetch = globalThis.fetch;
  Object.assign(process.env, { AIRTABLE_TOKEN: "fixture-airtable", SAMPLE_APPROVAL_SECRET: "fixture-existing-secret",
    SAMPLE_NATIVE_REPLY_CALLBACK_SECRET: callbackSecret, SAMPLE_NATIVE_REPLY_ISSUER: JSON.stringify(issuer) });
  const fields = { "JOB ID": 48441, "Clean phone number": "972546969974", Sample: attachments,
    "Sample approved by client": false, "Main Flow": "Sample" };
  const patches = [];
  let reads = 0;
  globalThis.fetch = async (url, init = {}) => {
    assert.ok(String(url).startsWith("https://api.airtable.com/"));
    if (init.method === "PATCH") { const patch = JSON.parse(init.body).fields; patches.push(patch); Object.assign(fields, patch); }
    else reads++;
    return new Response(JSON.stringify({ id: recordId, fields }), { status: 200 });
  };
  const capability = { recordId, jobId: "48441", recipientChatId: "972546969974@s.whatsapp.net",
    submissionId: "a".repeat(32), fingerprint: sampleFingerprint(attachments) };
  try {
    const approve = createNativeSampleButton({ ...capability, action: "approve" });
    const comment = createNativeSampleButton({ ...capability, action: "comment" });
    assert.ok(Buffer.byteLength(approve) <= 256);
    assert.equal(verifyNativeSampleButton(approve).action, "approve");
    assert.equal(verifyNativeSampleButton(comment).action, "comment");
    assert.equal(sampleRecipient("+972546969974"), capability.recipientChatId);
    assert.throws(() => sampleRecipient("972 546969974"));
    assert.throws(() => verifyNativeSampleButton(`${approve}x`));
    assert.equal(sampleFingerprint([...attachments].reverse()), capability.fingerprint);

    for (const req of [request(approve, {}, { secret: "forged" }), request(approve, {}, { timestamp: "1600000000" }),
      request(approve, { lineId: "another-line" }), request(approve, { recipientChatId: "972500000000@s.whatsapp.net" }),
      request(`${approve}x`), request(approve, { occurredAt: "2001-01-01T00:00:00.000Z" })]) {
      const res = recorder(); await handler(req, res); assert.equal(res.statusCode, 400);
    }
    assert.equal(reads, 0); assert.equal(patches.length, 0);

    const commented = recorder(); await handler(request(comment), commented);
    assert.equal(commented.statusCode, 200); assert.equal(commented.body.commentInWhatsApp, true); assert.equal(patches.length, 0);
    const approved = recorder(); await handler(request(approve), approved);
    assert.equal(approved.statusCode, 200); assert.equal(approved.body.approved, true);
    assert.equal(approved.body.deliveryId, "delivery-fixture");
    assert.deepEqual(patches, [{ "Sample approved by client": true, "Main Flow": "Sample Approved" }]);
    const repeat = recorder(); await handler(request(approve), repeat);
    assert.equal(repeat.statusCode, 200); assert.equal(repeat.body.alreadyApproved, true);
    fields["Main Flow"] = "Truck left";
    const advanced = recorder(); await handler(request(approve), advanced);
    assert.equal(advanced.statusCode, 409);
    assert.equal(fields["Main Flow"], "Truck left"); assert.equal(patches.length, 1);
    fields["Main Flow"] = "Sample";
    const inconsistent = recorder(); await handler(request(approve), inconsistent);
    assert.equal(inconsistent.statusCode, 409); assert.equal(patches.length, 1);

    for (const [key, value] of [["JOB ID", 99999], ["Clean phone number", "972500000000"], ["Sample", [...attachments, { id: "attCDEFGHIJKLMNOP" }]]]) {
      const original = fields[key]; fields[key] = value;
      const stale = recorder(); await handler(request(approve), stale);
      assert.equal(stale.statusCode, 409); assert.equal(patches.length, 1); fields[key] = original;
    }
    const invalidMethod = recorder(); await handler({ method: "GET" }, invalidMethod); assert.equal(invalidMethod.statusCode, 405);
    const large = Readable.from([Buffer.alloc(16_385)]); large.method = "POST"; large.headers = {};
    const largeRes = recorder(); await handler(large, largeRes); assert.equal(largeRes.statusCode, 400);
    globalThis.fetch = async () => { throw new Error("fixture transport unavailable"); };
    const upstream = recorder(); await handler(request(approve), upstream);
    assert.equal(upstream.statusCode, 503); assert.equal(upstream.body.ok, undefined);
    assert.equal(patches.length, 1);
    delete process.env.SAMPLE_NATIVE_REPLY_CALLBACK_SECRET;
    const unavailable = recorder(); await handler(request(approve), unavailable); assert.equal(unavailable.statusCode, 503);
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
