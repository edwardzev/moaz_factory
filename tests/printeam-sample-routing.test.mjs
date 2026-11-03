import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import sendHandler from "../api/send-sample.js";
import nativeHandler from "../api/sample-native-reply.js";
import {
  createNativeSampleButton, createNativePrinteamSampleButton, createNativeGroupSampleButton,
  configuredPrinteamNativeReplyIssuer, verifyNativeSampleButton, sampleFingerprint,
} from "../api/_native-sample-replies.js";
import {
  CLIENT_LINK_FIELD_NAME, PRINTEAM_CLIENT_RECORD_ID, SAMPLE_ORGANIZATION_ID,
  PM_SAMPLE_LINE_ID, PRINTEAM_SAMPLE_LINE_ID, SAMPLE_SUBMISSION_PROTOCOL, sampleCustomerRoute,
} from "../api/_sample-customer-routing.js";

const recordId = "recJS7xwhFXHaoPJd";
const otherClientId = "recABCDEFGHIJKLMN";
const groupId = "120363414125815359@g.us";
const customerChatId = "972546969974@s.whatsapp.net";
const issuer = { organizationId: SAMPLE_ORGANIZATION_ID, lineId: PM_SAMPLE_LINE_ID,
  bindingGeneration: "3a745028-ec9c-425c-9e8d-f7b9b5c1bbe9", activationId: "57e7072c-f3ef-4985-bfa5-c025201c3a05" };
const printeamIssuer = { organizationId: SAMPLE_ORGANIZATION_ID, lineId: PRINTEAM_SAMPLE_LINE_ID,
  bindingGeneration: "5498877f-be01-4146-aeaa-bce27950510c", activationId: "0b471391-93f5-438a-9e29-af4aee97bd57" };
const callbackSecret = "fixture-existing-callback-secret-at-least-32-bytes";
const assets = [
  { id: "attABCDEFGHIJKLMN", type: "image/png", url: "https://dl.airtable.com/photo", filename: "photo.png" },
  { id: "attNOPQRSTUVWXYZA", type: "video/mp4", url: "https://dl.airtable.com/video", filename: "clip.mp4" },
];
const envKeys = ["AIRTABLE_TOKEN", "SAMPLE_APPROVAL_SECRET", "SAMPLE_NATIVE_REPLY_CALLBACK_SECRET", "SAMPLE_NATIVE_REPLY_ISSUER",
  "SAMPLE_PRINTEAM_NATIVE_REPLY_ISSUER", "SAMPLE_NOTIFICATION_GROUP_ID", "MOAZ_PUBLIC_URL"];

function setupEnv() {
  const before = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { AIRTABLE_TOKEN: "fixture-airtable", SAMPLE_APPROVAL_SECRET: "fixture-existing-approval-secret",
    SAMPLE_NATIVE_REPLY_CALLBACK_SECRET: callbackSecret, SAMPLE_NATIVE_REPLY_ISSUER: JSON.stringify(issuer),
    SAMPLE_PRINTEAM_NATIVE_REPLY_ISSUER: JSON.stringify(printeamIssuer), SAMPLE_NOTIFICATION_GROUP_ID: groupId,
    MOAZ_PUBLIC_URL: "https://moaz.example" });
  return () => { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } };
}

function recorder() {
  return { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }, end() { return this; } };
}

function callback(buttonId, from = printeamIssuer, changes = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const raw = Buffer.from(JSON.stringify({ version: "native-reply.v1", ...from, deliveryId: "delivery-fixture",
    originMessageId: "message-fixture", originProviderMessageId: "provider-original", replyProviderMessageId: "provider-reply",
    rawEventId: "raw-fixture", recipientChatId: customerChatId, selectedButtonId: buttonId,
    occurredAt: new Date().toISOString(), ...changes }));
  const req = Readable.from([raw]); req.method = "POST";
  req.headers = { "x-platform-native-reply-timestamp": timestamp,
    "x-platform-native-reply-signature": crypto.createHmac("sha256", callbackSecret).update(`${timestamp}.`).update(raw).digest("hex") };
  return req;
}

test("customer sample sender uses exact linked identity and never guesses an unknown or ambiguous route", () => {
  assert.deepEqual(sampleCustomerRoute({ [CLIENT_LINK_FIELD_NAME]: [PRINTEAM_CLIENT_RECORD_ID] }),
    { sender: "printeam", lineId: PRINTEAM_SAMPLE_LINE_ID, phone: "972503969640" });
  for (const links of [[otherClientId], [otherClientId, "recNOPQRSTUVWXYZA"]]) {
    assert.deepEqual(sampleCustomerRoute({ [CLIENT_LINK_FIELD_NAME]: links, "Client name text": "Printeam", "Job Name": "PT123" }),
      { sender: "pm", lineId: PM_SAMPLE_LINE_ID, phone: "972559664485" });
  }
  for (const links of [undefined, null, [], "Printeam", ["Printeam"], [123], [otherClientId, null],
    [PRINTEAM_CLIENT_RECORD_ID, otherClientId], [PRINTEAM_CLIENT_RECORD_ID, PRINTEAM_CLIENT_RECORD_ID]]) {
    assert.throws(() => sampleCustomerRoute({ [CLIENT_LINK_FIELD_NAME]: links }), error => error.statusCode === 409);
  }
});

test("Printeam submission derives sender, native route and comment destination without altering selected assets or PM group buttons", async () => {
  const restoreEnv = setupEnv(); const beforeFetch = globalThis.fetch;
  const fields = { "JOB ID": 48441, "Clean phone number": "972546969974", "Client name": [PRINTEAM_CLIENT_RECORD_ID],
    "Client name text": ["Printeam"], Sample: assets, "Send sample link": "https://connect.pabbly.com/workflow/sendwebhookdata/test" };
  const posts = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://api.airtable.com/")) return new Response(JSON.stringify({ id: recordId, fields }), { status: 200 });
    posts.push(JSON.parse(init.body)); return new Response("accepted", { status: 200 });
  };
  const req = { method: "POST", headers: {}, body: { id: recordId, attachmentIds: [assets[1].id, assets[0].id],
    submissionProtocol: SAMPLE_SUBMISSION_PROTOCOL, sample_customer_sender: "pm", sample_customer_line_id: PM_SAMPLE_LINE_ID } };
  try {
    assert.deepEqual(configuredPrinteamNativeReplyIssuer({ required: true }), printeamIssuer);
    const res = recorder(); await sendHandler(req, res); assert.equal(res.statusCode, 202);
    const p = posts.at(-1);
    assert.equal(p.sample_customer_sender, "printeam"); assert.equal(p.sample_customer_line_id, PRINTEAM_SAMPLE_LINE_ID);
    assert.match(p.comment_url, /^https:\/\/wa\.me\/972503969640\?text=/);
    assert.match(p.sample_approve_button_id, /^ms4\./); assert.match(p.sample_comment_button_id, /^ms4\./);
    assert.equal(verifyNativeSampleButton(p.sample_approve_button_id).sender, "printeam");
    assert.equal(verifyNativeSampleButton(p.sample_approve_button_id).recipientChatId, customerChatId);
    assert.ok(Buffer.byteLength(p.sample_approve_button_id) <= 256);
    assert.equal(p.sample_group_id, groupId); assert.match(p.sample_group_approve_button_id, /^ms3\./);
    assert.equal(verifyNativeSampleButton(p.sample_group_approve_button_id).sender, undefined);
    assert.equal(verifyNativeSampleButton(p.sample_group_approve_button_id).customerPhone, "972546969974");
    assert.deepEqual(p.sample_assets.map(a => a.id), [assets[1].id, assets[0].id]);
    assert.deepEqual(JSON.parse(decodeURIComponent(p.sample_assets_encoded)), p.sample_assets);

    fields["Client name"] = [otherClientId];
    const pm = recorder(); await sendHandler(req, pm); assert.equal(pm.statusCode, 202);
    assert.equal(posts.at(-1).sample_customer_sender, "pm"); assert.equal(posts.at(-1).sample_customer_line_id, PM_SAMPLE_LINE_ID);
    assert.match(posts.at(-1).comment_url, /^https:\/\/wa\.me\/972559664485\?text=/);
    assert.match(posts.at(-1).sample_approve_button_id, /^ms2\./);
    assert.deepEqual(posts.at(-1).sample_assets, p.sample_assets);
    assert.notEqual(posts.at(-1).sample_group_approve_button_id, p.sample_group_approve_button_id);

    for (const links of [undefined, [], [123], [PRINTEAM_CLIENT_RECORD_ID, otherClientId]]) {
      const before = posts.length; fields["Client name"] = links;
      const invalid = recorder(); await sendHandler(req, invalid); assert.equal(invalid.statusCode, 409);
      assert.equal(posts.length, before);
    }
    fields["Client name"] = [PRINTEAM_CLIENT_RECORD_ID];
    for (const setting of [undefined, "{}", "not-json", JSON.stringify({ ...printeamIssuer, lineId: PM_SAMPLE_LINE_ID }),
      JSON.stringify({ ...printeamIssuer, organizationId: "other-org" })]) {
      if (setting === undefined) delete process.env.SAMPLE_PRINTEAM_NATIVE_REPLY_ISSUER;
      else process.env.SAMPLE_PRINTEAM_NATIVE_REPLY_ISSUER = setting;
      const before = posts.length; const unavailable = recorder(); await sendHandler(req, unavailable);
      assert.equal(unavailable.statusCode, 503); assert.equal(posts.length, before);
      fields["Client name"] = [otherClientId];
      const oldPm = recorder(); await sendHandler(req, oldPm); assert.equal(oldPm.statusCode, 202);
      fields["Client name"] = [PRINTEAM_CLIENT_RECORD_ID];
    }
  } finally { globalThis.fetch = beforeFetch; restoreEnv(); }
});

test("Printeam idempotency separates the new route from a previous PM send and remains stable on retries", async () => {
  const restoreEnv = setupEnv(); const beforeFetch = globalThis.fetch;
  const fields = { "JOB ID": 48441, "Clean phone number": "972546969974", "Client name": [otherClientId],
    "Client name text": ["Edward"], Sample: assets, "Send sample link": "https://connect.pabbly.com/workflow/sendwebhookdata/test" };
  const posts = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://api.airtable.com/")) return new Response(JSON.stringify({ id: recordId, fields }), { status: 200 });
    posts.push(JSON.parse(init.body)); return new Response("accepted", { status: 200 });
  };
  const req = { method: "POST", headers: {}, body: { id: recordId, attachmentIds: [assets[1].id, assets[0].id], submissionProtocol: SAMPLE_SUBMISSION_PROTOCOL } };
  async function submit() {
    const res = recorder(); await sendHandler(req, res); assert.equal(res.statusCode, 202);
    assert.equal(res.body.submissionId, posts.at(-1).sample_submission_id);
    return posts.at(-1);
  }
  try {
    const pm = await submit();
    assert.equal(pm.sample_submission_id, "2082e9b926612ebeb1fd8b9f5e8f2394");
    assert.equal(pm.sample_submission_id, crypto.createHash("sha256").update(`${recordId}\n${req.body.attachmentIds.join(",")}`).digest("hex").slice(0, 32));
    assert.equal((await submit()).sample_submission_id, pm.sample_submission_id);
    fields["Client name"] = [PRINTEAM_CLIENT_RECORD_ID];
    const printeam = await submit();
    assert.equal(printeam.sample_submission_id, "4fa814a04f80e2faf65dbce80cf07a60");
    assert.notEqual(printeam.sample_submission_id, pm.sample_submission_id);
    assert.notEqual(printeam.sample_group_approve_button_id, pm.sample_group_approve_button_id);
    assert.deepEqual(printeam.sample_assets, pm.sample_assets);
    const retry = await submit();
    assert.equal(retry.sample_submission_id, printeam.sample_submission_id);
    assert.equal(retry.sample_approve_button_id, printeam.sample_approve_button_id);
    assert.equal(retry.sample_group_approve_button_id, printeam.sample_group_approve_button_id);
  } finally { globalThis.fetch = beforeFetch; restoreEnv(); }
});

test("old Printeam clients cannot retry a pre-cutover send into the new route and the marker cannot override authoritative routing", async () => {
  const restoreEnv = setupEnv(); const beforeFetch = globalThis.fetch;
  const fields = { "JOB ID": 48441, "Clean phone number": "972546969974", "Client name": [PRINTEAM_CLIENT_RECORD_ID],
    "Client name text": ["Printeam"], Sample: assets, "Send sample link": "https://connect.pabbly.com/workflow/sendwebhookdata/test" };
  const posts = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://api.airtable.com/")) return new Response(JSON.stringify({ id: recordId, fields }), { status: 200 });
    posts.push(JSON.parse(init.body)); return new Response("accepted", { status: 200 });
  };
  const base = { id: recordId, attachmentIds: [assets[0].id] };
  async function submit(body) { const res = recorder(); await sendHandler({ method: "POST", headers: {}, body }, res); return res; }
  try {
    for (const submissionProtocol of [undefined, null, "moaz-sample-routing-v3", "", 4, [SAMPLE_SUBMISSION_PROTOCOL]]) {
      const stale = await submit({ ...base, submissionProtocol });
      assert.equal(stale.statusCode, 409); assert.match(stale.body.error, /Refresh this page/);
      assert.match(stale.body.error, /review any previous or uncertain sample send/);
      assert.match(stale.body.error, /No WhatsApp submission was made by this request/);
    }
    assert.equal(posts.length, 0);
    const fresh = await submit({ ...base, submissionProtocol: SAMPLE_SUBMISSION_PROTOCOL,
      sample_customer_sender: "pm", sample_customer_line_id: PM_SAMPLE_LINE_ID, customerPhone: "972500000000" });
    assert.equal(fresh.statusCode, 202); assert.equal(posts.length, 1);
    assert.equal(posts[0].sample_customer_sender, "printeam"); assert.equal(posts[0].sample_customer_line_id, PRINTEAM_SAMPLE_LINE_ID);
    assert.equal(verifyNativeSampleButton(posts[0].sample_approve_button_id).recipientChatId, customerChatId);

    fields["Client name"] = [otherClientId];
    const oldPm = await submit({ ...base, sample_customer_sender: "printeam", sample_customer_line_id: PRINTEAM_SAMPLE_LINE_ID });
    assert.equal(oldPm.statusCode, 202); assert.equal(posts.length, 2);
    assert.equal(posts[1].sample_customer_sender, "pm"); assert.equal(posts[1].sample_customer_line_id, PM_SAMPLE_LINE_ID);
    assert.match(posts[1].sample_approve_button_id, /^ms2\./);
  } finally { globalThis.fetch = beforeFetch; restoreEnv(); }
});

test("Printeam callbacks bind native version to the exact issuer and current client while old PM and group callbacks remain compatible", async () => {
  const restoreEnv = setupEnv(); const beforeFetch = globalThis.fetch;
  const fields = { "JOB ID": 48441, "Clean phone number": "972546969974", "Client name": [PRINTEAM_CLIENT_RECORD_ID],
    Sample: assets, "Sample approved by client": false, "Main Flow": "Sample" };
  let reads = 0; const patches = [];
  globalThis.fetch = async (_url, init = {}) => {
    if (init.method === "PATCH") { const patch = JSON.parse(init.body).fields; patches.push(patch); Object.assign(fields, patch); }
    else reads++;
    return new Response(JSON.stringify({ id: recordId, fields }), { status: 200 });
  };
  const base = { recordId, jobId: "48441", recipientChatId: customerChatId, submissionId: "a".repeat(32), fingerprint: sampleFingerprint(assets) };
  try {
    const approve = createNativePrinteamSampleButton({ ...base, action: "approve" });
    const comment = createNativePrinteamSampleButton({ ...base, action: "comment" });
    const pmApprove = createNativeSampleButton({ ...base, action: "approve" });
    const pmComment = createNativeSampleButton({ ...base, action: "comment" });
    const groupComment = createNativeGroupSampleButton({ ...base, recipientChatId: groupId, customerPhone: "972546969974", action: "comment" });
    assert.ok(Buffer.byteLength(approve) <= 256); assert.equal(verifyNativeSampleButton(approve).sender, "printeam");
    assert.throws(() => createNativePrinteamSampleButton({ ...base, jobId: "x".repeat(200), action: "approve" }), /too long/);
    assert.throws(() => verifyNativeSampleButton(approve.replace(/^ms4\./, "ms2.")));
    assert.throws(() => verifyNativeSampleButton(pmApprove.replace(/^ms2\./, "ms4.")));
    for (const req of [callback(approve, issuer), callback(pmApprove), callback(groupComment, printeamIssuer, { recipientChatId: groupId }),
      callback(approve, issuer, { sampleReplySender: "printeam" }), callback(approve, { ...printeamIssuer, activationId: issuer.activationId }),
      callback(approve, { ...printeamIssuer, bindingGeneration: issuer.bindingGeneration }), callback(`${approve}x`)]) {
      const invalid = recorder(); await nativeHandler(req, invalid); assert.equal(invalid.statusCode, 400);
    }
    assert.equal(reads, 0); assert.equal(patches.length, 0);
    const commented = recorder(); await nativeHandler(callback(comment), commented);
    assert.equal(commented.statusCode, 200); assert.equal(commented.body.commentInWhatsApp, true); assert.equal(patches.length, 0);

    for (const changed of [undefined, [], [otherClientId], [PRINTEAM_CLIENT_RECORD_ID, otherClientId]]) {
      fields["Client name"] = changed; const stale = recorder(); await nativeHandler(callback(approve), stale);
      assert.equal(stale.statusCode, 409); assert.equal(patches.length, 0);
    }
    fields["Client name"] = [PRINTEAM_CLIENT_RECORD_ID];
    const approved = recorder(); await nativeHandler(callback(approve), approved);
    assert.equal(approved.statusCode, 200); assert.equal(approved.body.approved, true);
    assert.deepEqual(patches, [{ "Sample approved by client": true, "Main Flow": "Sample Approved" }]);
    const duplicate = recorder(); await nativeHandler(callback(approve), duplicate);
    assert.equal(duplicate.statusCode, 200); assert.equal(duplicate.body.alreadyApproved, true); assert.equal(patches.length, 1);
    fields["Main Flow"] = "Truck left";
    const advanced = recorder(); await nativeHandler(callback(approve), advanced);
    assert.equal(advanced.statusCode, 409); assert.equal(patches.length, 1);

    // Previously issued PM buttons remain usable even when the linked client
    // is now Printeam or its linked-client value is absent in the legacy read.
    for (const links of [[PRINTEAM_CLIENT_RECORD_ID], undefined]) {
      fields["Client name"] = links;
      const oldPm = recorder(); await nativeHandler(callback(pmComment, issuer), oldPm);
      assert.equal(oldPm.statusCode, 200); assert.equal(oldPm.body.commentInWhatsApp, true);
    }
    const group = recorder(); await nativeHandler(callback(groupComment, issuer, { recipientChatId: groupId, participantChatId: customerChatId }), group);
    assert.equal(group.statusCode, 200); assert.equal(group.body.commentInWhatsApp, true);
    process.env.SAMPLE_PRINTEAM_NATIVE_REPLY_ISSUER = JSON.stringify({ ...printeamIssuer, lineId: "other-line" });
    const invalidPri = recorder(); await nativeHandler(callback(comment), invalidPri); assert.equal(invalidPri.statusCode, 400);
    const stillPm = recorder(); await nativeHandler(callback(pmComment, issuer), stillPm); assert.equal(stillPm.statusCode, 200);
  } finally { globalThis.fetch = beforeFetch; restoreEnv(); }
});
