import crypto from "node:crypto";
import { assertRecordId } from "./_sample-utils.js";

export const CLEAN_PHONE_FIELD_NAME = "Clean phone number";
export const CLIENT_NAME_FIELD_NAME = "Client name text";
const ATTACHMENT_ID = /^att[A-Za-z0-9]{14}$/;
const INDIVIDUAL_CHAT_ID = /^[1-9][0-9]{7,14}@s\.whatsapp\.net$/;
const GROUP_CHAT_ID = /^[1-9][0-9]*(?:-[0-9]+)?@g\.us$/;
const PM_NOTIFICATION_CHAT_ID = "972559664485@s.whatsapp.net";

function assertSampleGroup(value) {
  if (typeof value !== "string" || !GROUP_CHAT_ID.test(value) || value.split("@")[0].length > 31) {
    throw new Error("Invalid sample notification group.");
  }
  return value;
}

export function configuredSampleGroup() {
  const value = process.env.SAMPLE_NOTIFICATION_GROUP_ID;
  return value === undefined || value === "" ? null : assertSampleGroup(value);
}

export function sampleRecipient(value) {
  const phone = String(value ?? "");
  if (!/^\+?[1-9][0-9]{7,14}$/.test(phone)) throw new Error("The order has no valid clean customer phone number.");
  return `${phone.startsWith("+") ? phone.slice(1) : phone}@s.whatsapp.net`;
}

export function sampleFingerprint(attachments) {
  if (!Array.isArray(attachments) || !attachments.length || attachments.some(item => !ATTACHMENT_ID.test(item?.id ?? ""))) {
    throw new Error("The saved sample attachments cannot be verified.");
  }
  return crypto.createHash("sha256").update([...new Set(attachments.map(item => item.id))].sort().join(",")).digest("base64url").slice(0,22);
}

function actionKey() {
  const secret = String(process.env.SAMPLE_APPROVAL_SECRET || process.env.AIRTABLE_TOKEN || "").trim();
  if (!secret) throw new Error("Sample approval signing is not configured.");
  return crypto.createHmac("sha256", secret).update("moaz-native-sample-reply-v2").digest();
}

export function createNativeSampleButton({ recordId, jobId, recipientChatId, submissionId, fingerprint, action }) {
  if (!/^[a-f0-9]{32}$/.test(submissionId) || !/^[A-Za-z0-9_-]{22}$/.test(fingerprint) || !["approve", "comment"].includes(action)) {
    throw new Error("Invalid sample reply capability.");
  }
  if (!/^[1-9][0-9]{7,14}@s\.whatsapp\.net$/.test(recipientChatId)) throw new Error("Invalid sample recipient.");
  const payload = Buffer.from(JSON.stringify([2, assertRecordId(recordId), String(jobId), recipientChatId.split("@")[0], submissionId, fingerprint, action === "approve" ? "a" : "c"])).toString("base64url");
  const signature = crypto.createHmac("sha256", actionKey()).update(payload).digest("base64url");
  const id = `ms2.${payload}.${signature}`;
  if (Buffer.byteLength(id) > 256) throw new Error("The order identifier is too long for a native sample button.");
  return id;
}

function groupActionKey() {
  // Separate signing domain: a customer capability cannot be relabelled as a
  // group capability, even when every other order value is unchanged.
  return crypto.createHmac("sha256", actionKey()).update("moaz-native-sample-group-reply-v3").digest();
}

export function createNativeGroupSampleButton({ recordId, jobId, recipientChatId, customerPhone, submissionId, fingerprint, action }) {
  const groupId = assertSampleGroup(recipientChatId);
  const customerChatId = sampleRecipient(customerPhone);
  if (!jobId || !/^[a-f0-9]{32}$/.test(submissionId) || !/^[A-Za-z0-9_-]{22}$/.test(fingerprint) || !["approve", "comment"].includes(action)) {
    throw new Error("Invalid sample group reply capability.");
  }
  const payload = Buffer.from(JSON.stringify([3, assertRecordId(recordId), String(jobId), customerChatId.split("@")[0], groupId.split("@")[0], submissionId, fingerprint, action === "approve" ? "a" : "c"])).toString("base64url");
  const signature = crypto.createHmac("sha256", groupActionKey()).update(payload).digest("base64url");
  const id = `ms3.${payload}.${signature}`;
  if (Buffer.byteLength(id) > 256) throw new Error("The order identifier is too long for a native sample group button.");
  return id;
}

function verifyNativeGroupSampleButton(payload, signature) {
  const expected = crypto.createHmac("sha256", groupActionKey()).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(expected, supplied)) throw new Error("Invalid native sample group button.");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!Array.isArray(parsed) || parsed.length !== 8 || parsed[0] !== 3 || typeof parsed[2] !== "string" || !parsed[2] || typeof parsed[3] !== "string" || typeof parsed[4] !== "string" || !/^[a-f0-9]{32}$/.test(parsed[5]) || !/^[A-Za-z0-9_-]{22}$/.test(parsed[6]) || !["a", "c"].includes(parsed[7])) throw new Error("Invalid native sample group button.");
  const customerRecipient = sampleRecipient(parsed[3]);
  return {
    audience: "group", recordId: assertRecordId(parsed[1]), jobId: parsed[2],
    recipientChatId: assertSampleGroup(`${parsed[4]}@g.us`), customerPhone: customerRecipient.split("@")[0],
    submissionId: parsed[5], fingerprint: parsed[6], action: parsed[7] === "a" ? "approve" : "comment",
  };
}

export function verifyNativeSampleButton(id) {
  if (typeof id !== "string" || Buffer.byteLength(id) > 256) throw new Error("Invalid native sample button.");
  const [version, payload, signature, extra] = id.split(".");
  if (!["ms2", "ms3"].includes(version) || !payload || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) throw new Error("Invalid native sample button.");
  if (version === "ms3") return verifyNativeGroupSampleButton(payload, signature);
  const expected = crypto.createHmac("sha256", actionKey()).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(expected, supplied)) throw new Error("Invalid native sample button.");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!Array.isArray(parsed) || parsed.length !== 7 || parsed[0] !== 2 || typeof parsed[2] !== "string" || !parsed[2] || !/^[a-f0-9]{32}$/.test(parsed[4]) || !/^[A-Za-z0-9_-]{22}$/.test(parsed[5]) || !["a", "c"].includes(parsed[6])) throw new Error("Invalid native sample button.");
  return { recordId: assertRecordId(parsed[1]), jobId: parsed[2], recipientChatId: sampleRecipient(parsed[3]), submissionId: parsed[4], fingerprint: parsed[5], action: parsed[6] === "a" ? "approve" : "comment" };
}

export function assertGroupReplyParticipant(callback) {
  // Platform authenticates the exact raw provider participant and rejects its
  // own line identity. The signed group recipient is not the actor's identity.
  if (typeof callback.participantChatId !== "string" || !INDIVIDUAL_CHAT_ID.test(callback.participantChatId) || callback.participantChatId === PM_NOTIFICATION_CHAT_ID) {
    throw new Error("Native group reply participant is unavailable.");
  }
}

export function verifyNativeReplyEnvelope(rawBody, headers, now = Date.now()) {
  const secret = process.env.SAMPLE_NATIVE_REPLY_CALLBACK_SECRET || "";
  const issuerText = process.env.SAMPLE_NATIVE_REPLY_ISSUER || "";
  if (Buffer.byteLength(secret) < 32 || !issuerText) {
    const error = new Error("Native sample reply verification is not configured.");
    error.statusCode = 503;
    throw error;
  }
  const timestamp = headers["x-platform-native-reply-timestamp"];
  const signature = headers["x-platform-native-reply-signature"];
  if (typeof timestamp !== "string" || !/^[0-9]{10}$/.test(timestamp) || Math.abs(now - Number(timestamp) * 1000) > 300_000 || typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) throw new Error("Invalid native reply authentication.");
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new Error("Invalid native reply authentication.");
  const body = JSON.parse(rawBody.toString("utf8"));
  const issuer = JSON.parse(issuerText);
  if (body.version !== "native-reply.v1" || ["organizationId", "lineId", "bindingGeneration", "activationId"].some(key => !issuer[key] || body[key] !== issuer[key])) throw new Error("Invalid native reply issuer.");
  if (["deliveryId", "originMessageId", "originProviderMessageId", "replyProviderMessageId", "rawEventId", "recipientChatId", "selectedButtonId"].some(key => typeof body[key] !== "string" || !body[key] || body[key].length > 512)) throw new Error("Invalid native reply evidence.");
  const occurredAt = Date.parse(body.occurredAt);
  if (!Number.isFinite(occurredAt) || occurredAt > now + 300_000 || occurredAt < now - 7 * 86400_000) throw new Error("Expired native reply.");
  return body;
}
