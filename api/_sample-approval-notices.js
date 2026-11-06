import crypto from "node:crypto";

export const SAMPLE_APPROVAL_NOTICE_FIELDS = ["Client name text", "Job Name"];
const SEND_URL = "https://app.ezw.solutions/api/v1/messages/text";
const PM_LINE = "6befab5d-10e9-40f3-bbb4-6756a56f7e4d";
const SAMPLES_GROUP = "120363414125815359@g.us";
const SOUTH_GROUP = "120363408115679594@g.us";

const ROUTES = [
  { name: "samples", groupId: SAMPLES_GROUP },
  { name: "south", groupId: SOUTH_GROUP },
];

function nonblankText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function enqueueNotice(route, { body, recordId, fingerprint, token }) {
  const digest = crypto.createHash("sha256").update(JSON.stringify([recordId, fingerprint, route.groupId])).digest("hex");
  const idempotencyKey = `sample-customer-approved:${digest}`;
  const unconfirmed = { group: route.name, status: "not_confirmed", idempotencyKey };
  const request = {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ groupId: route.groupId, body, idempotencyKey }),
    redirect: "error",
  };

  // A lost HTTP response can be retried with exactly the same Platform key.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(SEND_URL, { ...request, signal: AbortSignal.timeout(2500) });
      if (response.status !== 202) {
        await response.body?.cancel().catch(() => {});
        if (response.status >= 500 && attempt === 0) continue;
        return { ...unconfirmed, httpStatus: response.status };
      }
      const receipt = await response.json();
      if (receipt.status === "queued" && receipt.channelId === PM_LINE && receipt.groupId === route.groupId
        && receipt.idempotencyKey === idempotencyKey && typeof receipt.outboundAttempt?.id === "string") {
        return { group: route.name, status: "queued", outboundAttemptId: receipt.outboundAttempt.id };
      }
      return unconfirmed;
    } catch {
      if (attempt === 1) return unconfirmed;
    }
  }
}

export async function notifyCustomerSampleApproval({ producer, recordId, jobId, fingerprint, fields, occurredAt }) {
  if (producer !== "ahmed") return undefined;
  const since = process.env.SAMPLE_APPROVAL_NOTICES_SINCE;
  if (!since) return undefined;
  const cutoff = Date.parse(since);
  const eventTime = Date.parse(occurredAt);
  if (!Number.isFinite(cutoff) || !Number.isFinite(eventTime) || eventTime < cutoff) return undefined;

  const token = process.env.SAMPLE_APPROVAL_PM_TOKEN?.trim();
  if (!token) return { status: "unavailable", reason: "configuration" };
  const clientLookup = fields["Client name text"];
  const customer = nonblankText(Array.isArray(clientLookup) && clientLookup.length === 1 ? clientLookup[0] : clientLookup);
  const jobName = nonblankText(fields["Job Name"]);
  if (!customer || !jobName || !jobId) return { status: "unavailable", reason: "order_fields" };

  const body = `${customer} approved sample of ${jobName} ${jobId}`;
  const results = await Promise.all(ROUTES.map(route => enqueueNotice(route, { body, recordId, fingerprint, token })));
  return { status: results.every(result => result.status === "queued") ? "queued" : "incomplete", results };
}

export async function recordApprovalNotices(input) {
  let result;
  try { result = await notifyCustomerSampleApproval(input); }
  catch { result = { status: "unavailable", reason: "unexpected" }; }
  if (result && result.status !== "queued") console.warn("Sample approval notices incomplete", result);
  return result;
}
