import { createHash } from "node:crypto";
import { CLIENT_NAME_FIELD_NAME, configuredSampleGroup } from "../api/_native-sample-replies.js";
import { PM_SAMPLE_LINE_ID } from "../api/_sample-customer-routing.js";

const PLATFORM = "https://app.ezw.solutions/api/v1";
const GROUP_ID = /^[1-9][0-9]*(?:-[0-9]+)?@g\.us$/;

function exactGroupId(value) {
  return typeof value === "string" && GROUP_ID.test(value) && value.split("@")[0].length <= 31;
}

function exactText(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function noticeBody(fields, jobId) {
  const lookup = fields[CLIENT_NAME_FIELD_NAME];
  const customer = exactText(Array.isArray(lookup) && lookup.length === 1 ? lookup[0] : lookup);
  const jobName = exactText(fields["Job Name"]);
  return customer && jobName && exactText(jobId)
    ? `${customer} approved sample of ${jobName} ${jobId}`
    : null;
}

function noticeKey(action, groupId) {
  const identity = JSON.stringify([action.recordId, action.submissionId, groupId]);
  return `sample-approved-v1-${createHash("sha256").update(identity).digest("hex")}`;
}

function report(action, result) {
  if (result.samples !== "queued" || result.north !== "queued") {
    // Preserve the approval receipt even when a notice fails. No customer
    // names, message bodies, tokens or signed buttons go into the log.
    console.warn(JSON.stringify({
      event: "sample_approval_notices.not_fully_queued",
      recordId: action.recordId, submissionId: action.submissionId, ...result,
    }));
  }
  return result;
}

async function queueGroupNotice(groupId, body, token, idempotencyKey) {
  try {
    const response = await fetch(`${PLATFORM}/messages/text`, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ groupId, body }),
      signal: AbortSignal.timeout(3000),
    });
    if (response.status !== 202) {
      await response.body?.cancel().catch(() => {});
      return response.status >= 400 && response.status < 500 ? "rejected" : "unknown";
    }
    const receipt = await response.json();
    return receipt?.status === "queued" && receipt.channelId === PM_SAMPLE_LINE_ID
      && receipt.groupId === groupId && receipt.idempotencyKey === idempotencyKey
      && typeof receipt.outboundAttempt?.id === "string" && receipt.outboundAttempt.id
      && typeof receipt.outboundMessage?.id === "string" && receipt.outboundMessage.id
      ? "queued" : "unknown";
  } catch {
    return "unknown";
  }
}

/** Only called after the existing signed callback and saved order checks.
 * Keep approval and notification outcomes separate; never replay a WhatsApp
 * request after an unknown outcome. Platform owns durable send idempotency.
 */
export async function notifyCustomerSampleApproval({ action, callback, fields, approvalConfirmed }) {
  if (process.env.SAMPLE_APPROVAL_NOTICES_ENABLED !== "true"
    || action.action !== "approve" || action.audience === "group" || callback.participantChatId != null) return undefined;

  const unavailable = reason => report(action, { samples: "not_queued", north: "not_queued", reason });
  if (!approvalConfirmed) return unavailable("approval_not_confirmed");
  const body = noticeBody(fields, action.jobId);
  if (!body) return unavailable("missing_or_ambiguous_order_text");
  const north = process.env.SAMPLE_APPROVAL_NOTICE_NORTH_GROUP_ID;
  const token = process.env.SAMPLE_APPROVAL_NOTICE_PM_TOKEN;
  let samples;
  try { samples = configuredSampleGroup(); }
  catch { return unavailable("invalid_destination_configuration"); }
  if (!exactGroupId(samples) || !exactGroupId(north) || samples === north || !exactText(token)) {
    return unavailable("invalid_destination_configuration");
  }

  // Check the configured bearer resolves to the exact PM line before making
  // either send. A wrong but otherwise valid line token cannot be used.
  try {
    const response = await fetch(`${PLATFORM}/health?wakeup=false`, {
      redirect: "error", cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    });
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => {});
      return unavailable("sender_unavailable");
    }
    const health = await response.json();
    if (health?.channelId !== PM_SAMPLE_LINE_ID || health.wakeupRequested !== false || health.line?.sendable !== true) {
      return unavailable("sender_unavailable");
    }
  } catch {
    return unavailable("sender_unavailable");
  }

  const [samplesStatus, northStatus] = await Promise.all([
    queueGroupNotice(samples, body, token, noticeKey(action, samples)),
    queueGroupNotice(north, body, token, noticeKey(action, north)),
  ]);
  return report(action, { samples: samplesStatus, north: northStatus });
}
