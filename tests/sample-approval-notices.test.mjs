import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import handler from "../api/sample-native-reply.js";
import {
  createNativeGroupSampleButton, createNativePrinteamSampleButton, createNativeSampleButton, sampleFingerprint,
} from "../api/_native-sample-replies.js";
import { PM_SAMPLE_LINE_ID, PRINTEAM_CLIENT_RECORD_ID, PRINTEAM_SAMPLE_LINE_ID, SAMPLE_ORGANIZATION_ID } from "../api/_sample-customer-routing.js";

const recordId = "recABCDEFGHIJKLMN";
const samples = "120363000000000001@g.us";
const north = "120363000000000002@g.us";
const customerChatId = "972500001234@s.whatsapp.net";
const secret = "fixture-approval-notice-callback-secret";
const issuer = {
  organizationId: SAMPLE_ORGANIZATION_ID, lineId: PM_SAMPLE_LINE_ID,
  bindingGeneration: "11111111-1111-1111-1111-111111111111", activationId: "22222222-2222-2222-2222-222222222222",
};
const printeamIssuer = {
  ...issuer, lineId: PRINTEAM_SAMPLE_LINE_ID,
  bindingGeneration: "33333333-3333-3333-3333-333333333333", activationId: "44444444-4444-4444-4444-444444444444",
};
const endpoint = "https://app.ezw.solutions/api/v1";
const attachments = [{ id: "attABCDEFGHIJKLMN" }];
const expectedBody = "לקוח דוגמה approved sample of דוגמת ייצור 12345";
const approvalPatch = { "Sample approved by client": true, "Main Flow": "Sample Approved" };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });

async function fixture(run) {
  const env = {
    AIRTABLE_TOKEN: "airtable-fixture",
    SAMPLE_APPROVAL_SECRET: "fixture-button-secret",
    SAMPLE_NATIVE_REPLY_CALLBACK_SECRET: secret,
    SAMPLE_NATIVE_REPLY_ISSUER: JSON.stringify(issuer),
    SAMPLE_PRINTEAM_NATIVE_REPLY_ISSUER: JSON.stringify(printeamIssuer),
    SAMPLE_NOTIFICATION_GROUP_ID: samples,
    SAMPLE_APPROVAL_NOTICES_ENABLED: "true",
    SAMPLE_APPROVAL_NOTICE_NORTH_GROUP_ID: north,
    SAMPLE_APPROVAL_NOTICE_PM_TOKEN: "pm-notice-fixture",
  };
  const saved = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  const originalFetch = globalThis.fetch;
  const state = {
    fields: { "JOB ID": 12345, "Job Name": "דוגמת ייצור", "Client name text": ["לקוח דוגמה"],
      "Client name": ["recOTHERABCDEFGHI"], "Clean phone number": "972500001234", Sample: attachments,
      "Sample approved by client": false, "Main Flow": "Sample" },
    calls: [], queued: new Map(), senderLineId: PM_SAMPLE_LINE_ID,
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url === `https://api.airtable.com/v0/appgJ2DCTbxQLzK2S/tbloqSi9cbJUSa5JV/${recordId}`) {
      state.calls.push(init.method || "GET");
      if (init.method === "PATCH") {
        assert.deepEqual(JSON.parse(init.body).fields, approvalPatch);
        if (state.patchFails) return json({ error: "fixture" }, 503);
        Object.assign(state.fields, approvalPatch);
        if (state.unconfirmedPatch) return json({ id: recordId, fields: {} });
      }
      return json({ id: recordId, fields: state.fields });
    }
    assert.equal(init.headers.Authorization, "Bearer pm-notice-fixture");
    assert.equal(init.redirect, "error");
    assert.ok(init.signal instanceof AbortSignal);
    if (url === `${endpoint}/health?wakeup=false`) {
      state.calls.push("health");
      return json({ channelId: state.senderLineId, wakeupRequested: false, line: { sendable: true } });
    }
    assert.equal(url, `${endpoint}/messages/text`);
    assert.equal(init.method, "POST");
    const payload = JSON.parse(init.body);
    const key = init.headers["Idempotency-Key"];
    assert.deepEqual(Object.keys(payload).sort(), ["body", "groupId"]);
    assert.match(key, /^sample-approved-v1-[0-9a-f]{64}$/);
    assert.equal(state.fields["Sample approved by client"], true);
    state.calls.push({ ...payload, key });
    if (payload.groupId === north && state.northError) {
      if (state.northError === "timeout") throw new Error("fixture transport error");
      return json({ error: "not authorized" }, 409);
    }
    const first = !state.queued.has(key);
    if (first) state.queued.set(key, payload);
    else assert.deepEqual(state.queued.get(key), payload);
    return json({ status: "queued", channelId: PM_SAMPLE_LINE_ID, groupId: payload.groupId,
      idempotencyKey: state.invalidReceipt ? "different-key" : key,
      outboundAttempt: { id: "attempt-fixture", inserted: first }, outboundMessage: { id: "message-fixture", inserted: first } }, 202);
  };

  state.tap = async ({ sender = "pm", action = "approve", group = false, changes = {}, submissionId = "a".repeat(32) } = {}) => {
    const signed = { recordId, jobId: "12345", submissionId, fingerprint: sampleFingerprint(attachments), action };
    const selectedButtonId = group
      ? createNativeGroupSampleButton({ ...signed, recipientChatId: samples, customerPhone: "972500001234" })
      : (sender === "printeam" ? createNativePrinteamSampleButton : createNativeSampleButton)({ ...signed, recipientChatId: customerChatId });
    const raw = Buffer.from(JSON.stringify({
      version: "native-reply.v1", ...(sender === "printeam" ? printeamIssuer : issuer),
      deliveryId: "delivery-fixture", originMessageId: "origin-fixture", originProviderMessageId: "provider-origin",
      replyProviderMessageId: "provider-reply", rawEventId: "raw-fixture", occurredAt: new Date().toISOString(),
      recipientChatId: group ? samples : customerChatId,
      ...(group ? { participantChatId: "972500004321@s.whatsapp.net" } : {}), selectedButtonId, ...changes,
    }));
    const at = String(Math.floor(Date.now() / 1000));
    const req = Object.assign(Readable.from([raw]), { method: "POST", headers: {
      "x-platform-native-reply-timestamp": at,
      "x-platform-native-reply-signature": createHmac("sha256", secret).update(`${at}.`).update(raw).digest("hex"),
    } });
    const res = { statusCode: 0, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    await handler(req, res);
    return res;
  };
  try { await run(state); }
  finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

for (const sender of ["pm", "printeam"]) {
  test(`verified ${sender} customer approval queues exact text to both groups, once per submission`, async () => {
    await fixture(async state => {
      if (sender === "printeam") state.fields["Client name"] = [PRINTEAM_CLIENT_RECORD_ID];
      const first = await state.tap({ sender });
      assert.equal(first.statusCode, 200);
      assert.equal(first.body.approved, true);
      assert.deepEqual(first.body.approvalNotices, { samples: "queued", north: "queued" });
      assert.deepEqual(state.calls.slice(0, 3), ["GET", "PATCH", "health"]);
      assert.deepEqual([...state.queued.values()], [{ groupId: samples, body: expectedBody }, { groupId: north, body: expectedBody }]);
      assert.equal((await state.tap({ sender })).body.alreadyApproved, true);
      assert.equal(state.queued.size, 2);
      assert.equal(state.calls.filter(call => call === "PATCH").length, 1);
      assert.equal(state.calls.filter(call => typeof call === "object").length, 4);
    });
  });
}

test("group approval and Comment do not announce; a verified customer tap can still announce after the group", async () => {
  await fixture(async state => {
    assert.equal((await state.tap({ action: "comment" })).body.commentInWhatsApp, true);
    assert.equal((await state.tap({ group: true })).body.approved, true);
    assert.equal(state.queued.size, 0);
    assert.equal(state.calls.includes("health"), false);
    assert.equal((await state.tap()).body.alreadyApproved, true);
    assert.equal(state.queued.size, 2);
    state.fields["Main Flow"] = "Press Finished";
    assert.equal((await state.tap({ submissionId: "b".repeat(32) })).statusCode, 409);
    assert.equal(state.queued.size, 2);
  });
});

test("a failed or unconfirmed Airtable update never emits a notice", async () => {
  await fixture(async state => {
    state.patchFails = true;
    assert.equal((await state.tap()).statusCode, 503);
    assert.equal(state.calls.includes("health"), false);
    state.patchFails = false;
    state.unconfirmedPatch = true;
    const unconfirmed = await state.tap();
    assert.equal(unconfirmed.statusCode, 200);
    assert.equal(unconfirmed.body.approvalNotices.reason, "approval_not_confirmed");
    assert.equal(state.calls.includes("health"), false);
    assert.equal(state.queued.size, 0);
  });
});

test("disabled, incomplete, ambiguous or wrong-line configuration cannot send", async () => {
  await fixture(async state => {
    delete process.env.SAMPLE_APPROVAL_NOTICES_ENABLED;
    assert.equal((await state.tap()).body.approvalNotices, undefined);
    process.env.SAMPLE_APPROVAL_NOTICES_ENABLED = "true";
    state.fields["Client name text"] = ["One", "Two"];
    assert.equal((await state.tap()).body.approvalNotices.reason, "missing_or_ambiguous_order_text");
    state.fields["Client name text"] = "לקוח דוגמה";
    process.env.SAMPLE_APPROVAL_NOTICE_NORTH_GROUP_ID = samples;
    assert.equal((await state.tap()).body.approvalNotices.reason, "invalid_destination_configuration");
    assert.equal(state.calls.includes("health"), false);
    process.env.SAMPLE_APPROVAL_NOTICE_NORTH_GROUP_ID = north;
    state.senderLineId = PRINTEAM_SAMPLE_LINE_ID;
    assert.equal((await state.tap()).body.approvalNotices.reason, "sender_unavailable");
    assert.equal(state.queued.size, 0);
  });
});

test("one rejected or uncertain group outcome does not undo approval, repeat the POST, or misstate queue proof", async () => {
  await fixture(async state => {
    state.northError = "timeout";
    const res = await state.tap();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.approved, true);
    assert.deepEqual(res.body.approvalNotices, { samples: "queued", north: "unknown" });
    assert.equal(state.calls.filter(call => typeof call === "object").length, 2);
    assert.equal(state.queued.size, 1);
    state.northError = "rejected";
    state.invalidReceipt = true;
    const invalid = await state.tap();
    assert.equal(invalid.body.alreadyApproved, true);
    assert.deepEqual(invalid.body.approvalNotices, { samples: "unknown", north: "rejected" });
    assert.equal(state.queued.size, 1);
  });
});
