import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import nativeHandler from "../api/sample-native-reply.js";
import sendHandler from "../api/send-sample.js";
import {
  configuredSampleGroup, createNativeGroupSampleButton, createNativeSampleButton,
  verifyNativeSampleButton, sampleFingerprint,
} from "../api/_native-sample-replies.js";

const groupId = "120363414125815359@g.us";
const recordId = "recJS7xwhFXHaoPJd";
const customerChatId = "972546969974@s.whatsapp.net";
const participantChatId = "972500000001@s.whatsapp.net";
const issuer = { organizationId: "org-fixture", lineId: "line-fixture", bindingGeneration: "generation-fixture", activationId: "activation-fixture" };
const callbackSecret = "fixture-callback-secret-of-at-least-32-bytes";
const savedAssets = [
  { id: "attABCDEFGHIJKLMN", url: "https://dl.airtable.com/image-one", filename: "one.jpg", type: "image/jpeg" },
  { id: "attNOPQRSTUVWXYZA", url: "https://dl.airtable.com/video-two", filename: "two.mp4", type: "video/mp4" },
];
const envKeys = ["AIRTABLE_TOKEN", "SAMPLE_APPROVAL_SECRET", "SAMPLE_NATIVE_REPLY_CALLBACK_SECRET", "SAMPLE_NATIVE_REPLY_ISSUER", "SAMPLE_NOTIFICATION_GROUP_ID", "MOAZ_PUBLIC_URL",
  "SAMPLE_APPROVAL_NOTICES_SINCE", "SAMPLE_APPROVAL_PM_TOKEN"];

function setupEnv() {
  const before = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    AIRTABLE_TOKEN: "fixture-airtable", SAMPLE_APPROVAL_SECRET: "fixture-existing-secret",
    SAMPLE_NATIVE_REPLY_CALLBACK_SECRET: callbackSecret, SAMPLE_NATIVE_REPLY_ISSUER: JSON.stringify(issuer),
    SAMPLE_NOTIFICATION_GROUP_ID: groupId, MOAZ_PUBLIC_URL: "https://moaz.example",
    SAMPLE_APPROVAL_NOTICES_SINCE: "2026-01-01T00:00:00Z",
    SAMPLE_APPROVAL_PM_TOKEN: "fixture-pm-token",
  });
  return () => { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } };
}

function recorder() {
  return { statusCode: null, body: null, setHeader() {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, end() { return this; } };
}

function callback(buttonId, changes = {}, { secret = callbackSecret } = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const raw = Buffer.from(JSON.stringify({ version: "native-reply.v1", ...issuer,
    deliveryId: "group-delivery-fixture", originMessageId: "group-message-fixture", originProviderMessageId: "group-provider-original",
    replyProviderMessageId: "group-provider-reply", rawEventId: "group-raw-fixture", recipientChatId: groupId,
    participantChatId, selectedButtonId: buttonId, occurredAt: new Date().toISOString(), ...changes }));
  const req = Readable.from([raw]);
  req.method = "POST";
  req.headers = { "x-platform-native-reply-timestamp": timestamp,
    "x-platform-native-reply-signature": crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(raw).digest("hex") };
  return req;
}

test("group sample callbacks require exact signed scope, participant, customer and saved sample", async () => {
  const restoreEnv = setupEnv();
  const oldFetch = globalThis.fetch;
  const fields = { "JOB ID": 48441, "Clean phone number": "972546969974", Sample: savedAssets,
    "Sample approved by client": false, "Main Flow": "Sample", "Client name text": ["Fixture customer"], "Job Name": "Fixture job" };
  const patches = [];
  const notices = [];
  let reads = 0;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url) === "https://app.ezw.solutions/api/v1/messages/text") {
      const { groupId, body, idempotencyKey } = JSON.parse(init.body);
      assert.equal(fields["Sample approved by client"], true);
      notices.push({ groupId, body });
      return Response.json({ status: "queued", groupId, channelId: "6befab5d-10e9-40f3-bbb4-6756a56f7e4d", idempotencyKey,
        outboundAttempt: { id: "fixture-attempt" } }, { status: 202 });
    }
    assert.ok(String(url).startsWith("https://api.airtable.com/"));
    if (init.method === "PATCH") { const patch = JSON.parse(init.body).fields; patches.push(patch); Object.assign(fields, patch); }
    else reads++;
    return new Response(JSON.stringify({ id: recordId, fields }), { status: 200 });
  };
  const capability = { recordId, jobId: "48441", recipientChatId: groupId, customerPhone: "972546969974",
    submissionId: "a".repeat(32), fingerprint: sampleFingerprint(savedAssets) };
  try {
    assert.equal(configuredSampleGroup(), groupId);
    const approve = createNativeGroupSampleButton({ ...capability, action: "approve" });
    const comment = createNativeGroupSampleButton({ ...capability, action: "comment" });
    const customerApprove = createNativeSampleButton({ ...capability, recipientChatId: customerChatId, action: "approve" });
    assert.equal(Buffer.byteLength(approve), 223);
    assert.ok(Buffer.byteLength(comment) <= 256);
    assert.equal(verifyNativeSampleButton(approve).customerPhone, "972546969974");
    assert.equal(verifyNativeSampleButton(approve).recipientChatId, groupId);
    assert.equal(verifyNativeSampleButton(comment).action, "comment");
    assert.equal(verifyNativeSampleButton(customerApprove).recipientChatId, customerChatId);
    assert.equal(verifyNativeSampleButton(customerApprove).audience, undefined);
    assert.throws(() => createNativeGroupSampleButton({ ...capability, jobId: "x".repeat(200), action: "approve" }), /too long/);
    assert.throws(() => createNativeGroupSampleButton({ ...capability, recipientChatId: customerChatId, action: "approve" }));
    assert.throws(() => verifyNativeSampleButton(approve.replace(/^ms3\./, "ms2.")));
    assert.throws(() => verifyNativeSampleButton(customerApprove.replace(/^ms2\./, "ms3.")));
    const parts = approve.split(".");
    const altered = JSON.parse(Buffer.from(parts[1], "base64url").toString()); altered[4] = "120363414125815360";
    assert.throws(() => verifyNativeSampleButton(`ms3.${Buffer.from(JSON.stringify(altered)).toString("base64url")}.${parts[2]}`));

    for (const req of [
      callback(approve, {}, { secret: "forged" }), callback(approve, { lineId: "other-line" }),
      callback(approve, { participantChatId: undefined }), callback(approve, { participantChatId: groupId }),
      callback(approve, { participantChatId: "972559664485@s.whatsapp.net" }),
      callback(approve, { recipientChatId: "120363414125815360@g.us" }),
      callback(approve, { recipientChatId: customerChatId }), callback(customerApprove),
      callback(`${approve}x`),
    ]) {
      const res = recorder(); await nativeHandler(req, res); assert.equal(res.statusCode, 400);
    }
    assert.equal(reads, 0); assert.equal(patches.length, 0);

    process.env.SAMPLE_NOTIFICATION_GROUP_ID = "120363414125815360@g.us";
    const wrongConfigured = recorder(); await nativeHandler(callback(approve), wrongConfigured); assert.equal(wrongConfigured.statusCode, 400);
    delete process.env.SAMPLE_NOTIFICATION_GROUP_ID;
    const disabled = recorder(); await nativeHandler(callback(approve), disabled); assert.equal(disabled.statusCode, 400);
    process.env.SAMPLE_NOTIFICATION_GROUP_ID = groupId;
    assert.equal(reads, 0);

    const commented = recorder(); await nativeHandler(callback(comment), commented);
    assert.equal(commented.statusCode, 200); assert.equal(commented.body.commentInWhatsApp, true); assert.equal(patches.length, 0);
    for (const [key, changed] of [["JOB ID", 99999], ["Clean phone number", "972500000002"], ["Sample", [...savedAssets, { id: "attCDEFGHIJKLMNOP" }]]]) {
      const before = fields[key]; fields[key] = changed;
      const stale = recorder(); await nativeHandler(callback(approve), stale); assert.equal(stale.statusCode, 409); fields[key] = before;
    }
    assert.equal(patches.length, 0);

    const approved = recorder(); await nativeHandler(callback(approve), approved);
    assert.equal(approved.statusCode, 200); assert.equal(approved.body.approved, true);
    assert.deepEqual(patches, [{ "Sample approved by client": true, "Main Flow": "Sample Approved" }]);
    const duplicate = recorder(); await nativeHandler(callback(approve, { participantChatId: "972500000002@s.whatsapp.net" }), duplicate);
    assert.equal(duplicate.statusCode, 200); assert.equal(duplicate.body.alreadyApproved, true); assert.equal(patches.length, 1);
    assert.deepEqual(notices, []);
    const customerDuplicate = recorder(); await nativeHandler(callback(customerApprove, { recipientChatId: customerChatId, participantChatId: undefined }), customerDuplicate);
    assert.equal(customerDuplicate.statusCode, 200); assert.equal(customerDuplicate.body.alreadyApproved, true); assert.equal(patches.length, 1);
    assert.equal(customerDuplicate.body.approvalNotices, undefined);
    assert.deepEqual(notices, []);

    const [version, payload] = customerApprove.split(".");
    const key = crypto.createHmac("sha256", process.env.SAMPLE_APPROVAL_SECRET).update("moaz-native-sample-reply-v2").digest();
    const ahmedKey = crypto.createHmac("sha256", key).update("ahmed-customer-sample-approval-v1").digest();
    const ahmedApprove = [version, payload, crypto.createHmac("sha256", ahmedKey).update(payload).digest("base64url")].join(".");
    assert.equal(verifyNativeSampleButton(ahmedApprove).producer, "ahmed");
    const ahmed = recorder();
    await nativeHandler(callback(ahmedApprove, { recipientChatId: customerChatId, participantChatId: undefined }), ahmed);
    assert.equal(ahmed.statusCode, 200);
    assert.equal(ahmed.body.approvalNotices.status, "queued");
    assert.deepEqual(notices, ["120363414125815359@g.us", "120363408115679594@g.us"].map(groupId => ({
      groupId, body: "Fixture customer approved sample of Fixture job 48441",
    })));
    fields["Main Flow"] = "Truck left";
    const laterStage = recorder(); await nativeHandler(callback(approve), laterStage);
    assert.equal(laterStage.statusCode, 409); assert.equal(fields["Main Flow"], "Truck left"); assert.equal(patches.length, 1);
  } finally { globalThis.fetch = oldFetch; restoreEnv(); }
});

test("sample submission adds configured group capabilities without changing customer assets or inventing names", async () => {
  const restoreEnv = setupEnv();
  const oldFetch = globalThis.fetch;
  const fields = { "JOB ID": 48441, "Clean phone number": "972546969974", "Client name": ["recABCDEFGHIJKLMN"], "Client name text": "לקוח לדוגמה",
    Sample: savedAssets, "Send sample link": "https://connect.pabbly.com/workflow/sendwebhookdata/test" };
  const posts = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://api.airtable.com/")) return new Response(JSON.stringify({ id: recordId, fields }), { status: 200 });
    posts.push(JSON.parse(init.body)); return new Response("accepted", { status: 200 });
  };
  const req = { method: "POST", headers: {}, body: { id: recordId, attachmentIds: [savedAssets[1].id, savedAssets[0].id],
    groupNotification: { requested: true, status: "submitted" }, sample_group_id: "120363414125815360@g.us" } };
  try {
    const res = recorder(); await sendHandler(req, res); assert.equal(res.statusCode, 202);
    assert.deepEqual(res.body.groupNotification, { requested: true, status: "submitted" });
    const payload = posts.at(-1);
    assert.equal(payload.sample_group_id, groupId); assert.equal(payload.sample_customer_name, fields["Client name text"]);
    assert.equal(payload.sample_group_notification_unavailable, undefined);
    assert.match(payload.sample_group_approve_button_id, /^ms3\./); assert.match(payload.sample_group_comment_button_id, /^ms3\./);
    const groupAction = verifyNativeSampleButton(payload.sample_group_approve_button_id);
    assert.equal(groupAction.recordId, recordId); assert.equal(groupAction.jobId, "48441");
    assert.equal(groupAction.customerPhone, "972546969974"); assert.equal(groupAction.recipientChatId, groupId);
    assert.equal(groupAction.submissionId, payload.sample_submission_id);
    assert.equal(groupAction.fingerprint, sampleFingerprint(savedAssets));
    assert.deepEqual(payload.sample_assets.map(asset => asset.id), [savedAssets[1].id, savedAssets[0].id]);
    assert.equal(verifyNativeSampleButton(payload.sample_approve_button_id).recipientChatId, customerChatId);

    fields["Client name text"] = ["Edward"];
    const lookupName = recorder(); await sendHandler(req, lookupName); assert.equal(lookupName.statusCode, 202);
    assert.deepEqual(lookupName.body.groupNotification, { requested: true, status: "submitted" });
    assert.equal(posts.at(-1).sample_customer_name, "Edward");
    assert.deepEqual(fields["Client name text"], ["Edward"]);
    for (const missingName of [undefined, "", "   ", [], [123], [""], ["Alice", "Bob"], ["Edward", "Edward"]]) {
      fields["Client name text"] = missingName;
      const noName = recorder(); await sendHandler(req, noName); assert.equal(noName.statusCode, 202);
      const noNamePayload = posts.at(-1);
      assert.match(noNamePayload.sample_group_notification_unavailable, /Client name text/);
      assert.deepEqual(noName.body.groupNotification, { requested: true, status: "unavailable", reason: noNamePayload.sample_group_notification_unavailable });
      assert.equal(noNamePayload.sample_group_id, undefined); assert.equal(noNamePayload.sample_customer_name, undefined);
      assert.equal(noNamePayload.sample_group_approve_button_id, undefined); assert.equal(noNamePayload.sample_group_comment_button_id, undefined);
      assert.equal(noNamePayload.sample_approve_button_id, payload.sample_approve_button_id);
      assert.deepEqual(noNamePayload.sample_assets, payload.sample_assets);
    }
    fields["Client name text"] = "  Exact source name  ";
    const exactName = recorder(); await sendHandler(req, exactName); assert.equal(exactName.statusCode, 202);
    assert.equal(posts.at(-1).sample_customer_name, "  Exact source name  ");

    process.env.SAMPLE_NOTIFICATION_GROUP_ID = `${groupId} `;
    const invalidGroup = recorder(); await sendHandler(req, invalidGroup); assert.equal(invalidGroup.statusCode, 202);
    assert.match(posts.at(-1).sample_group_notification_unavailable, /could not be configured/); assert.equal(posts.at(-1).sample_group_id, undefined);
    assert.deepEqual(invalidGroup.body.groupNotification, { requested: true, status: "unavailable", reason: posts.at(-1).sample_group_notification_unavailable });
    delete process.env.SAMPLE_NOTIFICATION_GROUP_ID;
    const disabled = recorder(); await sendHandler(req, disabled); assert.equal(disabled.statusCode, 202);
    assert.equal(posts.at(-1).sample_group_notification_unavailable, undefined); assert.equal(posts.at(-1).sample_group_id, undefined);
    assert.deepEqual(disabled.body.groupNotification, { requested: false, status: "disabled" });
  } finally { globalThis.fetch = oldFetch; restoreEnv(); }
});
