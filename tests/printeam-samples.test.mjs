import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import send from "../api/send-sample.js";
import nativeReply from "../api/sample-native-reply.js";
import {
  PRINTEAM_CLIENT_RECORD_ID, PRINTEAM_SAMPLE_LINE_ID, PM_SAMPLE_LINE_ID,
  createNativeSampleButton, createNativeGroupSampleButton, sampleCustomerSender, sampleFingerprint,
} from "../api/_native-sample-replies.js";

const recordId = "recABCDEFGHIJKLMN";
const otherClientId = "recNOPQRSTUVWXYZA";
const groupId = "120363414125815359@g.us";
const phone = "972500000001";
const assets = [
  { id: "attABCDEFGHIJKLMN", url: "https://dl.airtable.com/fixture.jpg", filename: "fixture.jpg", type: "image/jpeg" },
  { id: "attNOPQRSTUVWXYZA", url: "https://dl.airtable.com/fixture.mp4", filename: "fixture.mp4", type: "video/mp4" },
];
const pmIssuer = { organizationId: "org-fixture", lineId: PM_SAMPLE_LINE_ID, bindingGeneration: "pm-generation", activationId: "pm-activation" };
const ptIssuer = { organizationId: "org-fixture", lineId: PRINTEAM_SAMPLE_LINE_ID, bindingGeneration: "pt-generation", activationId: "pt-activation" };
const secret = "fixture-callback-secret-of-at-least-32-bytes";

function recorder() {
  return { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }, end() { return this; } };
}

function configure() {
  const keys = ["AIRTABLE_TOKEN", "SAMPLE_APPROVAL_SECRET", "SAMPLE_NATIVE_REPLY_CALLBACK_SECRET", "SAMPLE_NATIVE_REPLY_ISSUER", "SAMPLE_NOTIFICATION_GROUP_ID", "MOAZ_PUBLIC_URL"];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { AIRTABLE_TOKEN: "fixture-airtable", SAMPLE_APPROVAL_SECRET: "fixture-existing-signer",
    SAMPLE_NATIVE_REPLY_CALLBACK_SECRET: secret, SAMPLE_NATIVE_REPLY_ISSUER: JSON.stringify(pmIssuer),
    SAMPLE_NOTIFICATION_GROUP_ID: groupId, MOAZ_PUBLIC_URL: "https://moaz.example" });
  return () => { for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  } };
}

function signedRequest(button, issuer = pmIssuer, changes = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = Buffer.from(JSON.stringify({ version: "native-reply.v1", ...issuer,
    deliveryId: "delivery-fixture", originMessageId: "origin-fixture", originProviderMessageId: "provider-origin-fixture",
    replyProviderMessageId: "provider-reply-fixture", rawEventId: "raw-fixture", recipientChatId: `${phone}@s.whatsapp.net`,
    selectedButtonId: button, occurredAt: new Date().toISOString(), ...changes }));
  const req = Readable.from([body]); req.method = "POST";
  req.headers = { "x-platform-native-reply-timestamp": timestamp,
    "x-platform-native-reply-signature": crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex") };
  return req;
}

test("sample customer sender uses only one exact linked client; Printeam changes only customer route metadata and fallback chat", async () => {
  const restore = configure(), originalFetch = globalThis.fetch;
  const fields = { "JOB ID": 12345, "Client name": [otherClientId], "Client name text": "Printeam",
    "Clean phone number": phone, Sample: assets, "Send sample link": "https://connect.pabbly.com/workflow/sendwebhookdata/fixture" };
  const posts = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://api.airtable.com/")) {
      assert.equal(init.method, undefined);
      return new Response(JSON.stringify({ id: recordId, fields }), { status: 200 });
    }
    posts.push(JSON.parse(init.body)); return new Response("accepted", { status: 200 });
  };
  const request = { method: "POST", headers: {}, body: { id: recordId, attachmentIds: assets.map(asset => asset.id),
    sample_customer_line_id: PRINTEAM_SAMPLE_LINE_ID, customerSender: { lineId: PRINTEAM_SAMPLE_LINE_ID, phone: "972000000000" } } };
  try {
    assert.deepEqual(sampleCustomerSender([PRINTEAM_CLIENT_RECORD_ID]), { lineId: PRINTEAM_SAMPLE_LINE_ID, phone: "972503969640" });
    const ordinary = recorder(); await send(request, ordinary); assert.equal(ordinary.statusCode, 202);
    const pmPayload = posts.at(-1);
    assert.equal(pmPayload.sample_customer_line_id, PM_SAMPLE_LINE_ID);
    assert.equal(new URL(pmPayload.comment_url).pathname, "/972559664485");
    // A displayed name and client-supplied sender cannot substitute for the linked identity.
    fields["Client name"] = [PRINTEAM_CLIENT_RECORD_ID];
    const printeam = recorder(); await send({ ...request, body: { ...request.body, sample_customer_line_id: PM_SAMPLE_LINE_ID } }, printeam);
    assert.equal(printeam.statusCode, 202); assert.equal(printeam.body.submissionId, ordinary.body.submissionId);
    const ptPayload = posts.at(-1);
    assert.equal(ptPayload.sample_customer_line_id, PRINTEAM_SAMPLE_LINE_ID);
    assert.equal(new URL(ptPayload.comment_url).pathname, "/972503969640");
    assert.equal(ptPayload.sample_group_id, groupId);
    assert.deepEqual(printeam.body.groupNotification, { requested: true, status: "submitted" });
    const { sample_customer_line_id: _pmLine, comment_url: _pmComment, ...pmStable } = pmPayload;
    const { sample_customer_line_id: _ptLine, comment_url: _ptComment, ...ptStable } = ptPayload;
    assert.deepEqual(ptStable, pmStable);
    const retry = recorder(); await send(request, retry); assert.equal(retry.statusCode, 202);
    assert.deepEqual(posts.at(-1), ptPayload);
    const beforeInvalid = posts.length;
    for (const unknown of [undefined, null, "Printeam", PRINTEAM_CLIENT_RECORD_ID, [], [PRINTEAM_CLIENT_RECORD_ID, otherClientId],
      [PRINTEAM_CLIENT_RECORD_ID, PRINTEAM_CLIENT_RECORD_ID], [42], [{}], [` ${PRINTEAM_CLIENT_RECORD_ID}`], ["rec-short"]]) {
      fields["Client name"] = unknown;
      const rejected = recorder(); await send(request, rejected);
      assert.equal(rejected.statusCode, 409); assert.match(rejected.body.error, /one exact Client name link/);
      assert.equal(posts.length, beforeInvalid);
    }
    assert.deepEqual(fields.Sample, assets);
  } finally { globalThis.fetch = originalFetch; restore(); }
});

test("native callbacks accept explicit whole issuer tuples while preserving the old single-issuer contract", async () => {
  const restore = configure(), originalFetch = globalThis.fetch;
  const fields = { "JOB ID": 12345, "Clean phone number": phone, Sample: assets,
    "Sample approved by client": false, "Main Flow": "Sample" };
  const patches = []; let reads = 0;
  globalThis.fetch = async (_url, init = {}) => {
    if (init.method === "PATCH") { const patch = JSON.parse(init.body).fields; patches.push(patch); Object.assign(fields, patch); }
    else reads++;
    return new Response(JSON.stringify({ id: recordId, fields }), { status: 200 });
  };
  const capability = { recordId, jobId: "12345", recipientChatId: `${phone}@s.whatsapp.net`, submissionId: "a".repeat(32), fingerprint: sampleFingerprint(assets) };
  try {
    const comment = createNativeSampleButton({ ...capability, action: "comment" });
    const approve = createNativeSampleButton({ ...capability, action: "approve" });
    const oldPm = recorder(); await nativeReply(signedRequest(comment), oldPm);
    assert.equal(oldPm.statusCode, 200); assert.equal(oldPm.body.commentInWhatsApp, true);
    const beforeUnlisted = reads;
    const unlisted = recorder(); await nativeReply(signedRequest(comment, ptIssuer), unlisted);
    assert.equal(unlisted.statusCode, 400); assert.equal(reads, beforeUnlisted);
    process.env.SAMPLE_NATIVE_REPLY_ISSUER = JSON.stringify([pmIssuer, ptIssuer]);
    for (const mixed of [{ ...pmIssuer, lineId: ptIssuer.lineId }, { ...ptIssuer, bindingGeneration: pmIssuer.bindingGeneration },
      { ...ptIssuer, activationId: pmIssuer.activationId }, { ...ptIssuer, organizationId: "other-org" }]) {
      const denied = recorder(); await nativeReply(signedRequest(comment, mixed), denied);
      assert.equal(denied.statusCode, 400); assert.equal(reads, beforeUnlisted);
    }
    const ptComment = recorder(); await nativeReply(signedRequest(comment, ptIssuer), ptComment);
    assert.equal(ptComment.statusCode, 200); assert.equal(ptComment.body.commentInWhatsApp, true); assert.equal(patches.length, 0);
    const ptApprove = recorder(); await nativeReply(signedRequest(approve, ptIssuer), ptApprove);
    assert.equal(ptApprove.statusCode, 200); assert.equal(ptApprove.body.approved, true);
    assert.deepEqual(patches, [{ "Sample approved by client": true, "Main Flow": "Sample Approved" }]);
    const pmRepeat = recorder(); await nativeReply(signedRequest(approve), pmRepeat);
    assert.equal(pmRepeat.statusCode, 200); assert.equal(pmRepeat.body.alreadyApproved, true); assert.equal(patches.length, 1);

    const groupApprove = createNativeGroupSampleButton({ ...capability, recipientChatId: groupId, customerPhone: phone, action: "approve" });
    const beforeGroup = reads;
    const wrongGroupIssuer = recorder(); await nativeReply(signedRequest(groupApprove, ptIssuer, { recipientChatId: groupId, participantChatId: "972500000002@s.whatsapp.net" }), wrongGroupIssuer);
    assert.equal(wrongGroupIssuer.statusCode, 400); assert.equal(reads, beforeGroup);
    const pmGroup = recorder(); await nativeReply(signedRequest(groupApprove, pmIssuer, { recipientChatId: groupId, participantChatId: "972500000002@s.whatsapp.net" }), pmGroup);
    assert.equal(pmGroup.statusCode, 200); assert.equal(pmGroup.body.alreadyApproved, true); assert.equal(patches.length, 1);

    const beforeInvalid = reads;
    for (const invalid of ["not-json", "null", "[]", "{}", JSON.stringify([pmIssuer, pmIssuer]), JSON.stringify([pmIssuer, null]),
      JSON.stringify({ ...pmIssuer, activationId: "" }), JSON.stringify({ ...pmIssuer, extra: true }),
      JSON.stringify({ ...pmIssuer, lineId: "*" }), JSON.stringify({ ...pmIssuer, organizationId: "org-*" }),
      JSON.stringify({ ...pmIssuer, lineId: " line-fixture" }), JSON.stringify([pmIssuer, { lineId: ptIssuer.lineId }])]) {
      process.env.SAMPLE_NATIVE_REPLY_ISSUER = invalid;
      const rejected = recorder(); await nativeReply(signedRequest(comment), rejected);
      assert.equal(rejected.statusCode, 503); assert.equal(reads, beforeInvalid); assert.equal(patches.length, 1);
    }
  } finally { globalThis.fetch = originalFetch; restore(); }
});
