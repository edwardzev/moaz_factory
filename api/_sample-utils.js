import crypto from "node:crypto";

export const AIRTABLE_BASE_ID = "appgJ2DCTbxQLzK2S";
export const AIRTABLE_TABLE_ID = "tbloqSi9cbJUSa5JV";
export const SAMPLE_FIELD_ID = "fldNTD26J1QlI7WOb";
export const SAMPLE_FIELD_NAME = "Sample";
export const SAMPLE_APPROVED_FIELD_NAME = "Sample approved by client";
export const MAIN_FLOW_FIELD_NAME = "Main Flow";
export const SAMPLE_APPROVED_MAIN_FLOW_VALUE = "Sample Approved";
export const SEND_SAMPLE_LINK_FIELD_NAME = "Send sample link";
export const JOB_ID_FIELD_NAME = "JOB ID";
export const MAX_SAMPLE_FILE_BYTES = 4_400_000;

const RECORD_ID_PATTERN = /^rec[A-Za-z0-9]{14}$/;
const APPROVAL_TOKEN_VERSION = 1;

export function airtableHeaders(extra = {}) {
  const token = String(process.env.AIRTABLE_TOKEN || "").trim();
  if (!token) throw new Error("AIRTABLE_TOKEN is not configured.");
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}
export function assertRecordId(value) {
  const recordId = String(value || "").trim();
  if (!RECORD_ID_PATTERN.test(recordId)) {
    const error = new Error("Invalid Airtable record id.");
    error.statusCode = 400;
    throw error;
  }
  return recordId;
}

export function isAllowedSampleContentType(value) {
  const contentType = String(value || "").trim().toLowerCase();
  return contentType.startsWith("image/") || contentType.startsWith("video/");
}

export function safeFilename(value) {
  const raw = String(value || "sample-file").trim();
  const basename = raw.split(/[\\/]/).pop() || "sample-file";
  return basename.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 180) || "sample-file";
}

export async function readAirtableRecord(recordId, fieldNames) {
  // Airtable's single-record endpoint does not accept the list endpoint's
  // fields[] projection. Read the record, then return only the contracted
  // fields so callers cannot accidentally start depending on unrelated data.
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;
  const response = await fetch(url, {
    headers: airtableHeaders(),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Airtable record read failed (${response.status}): ${text}`);
    error.statusCode = response.status;
    throw error;
  }
  const record = JSON.parse(text);
  const fields = record?.fields || {};
  return {
    ...record,
    fields: Object.fromEntries(fieldNames.map(fieldName => [fieldName, fields[fieldName]])),
  };
}

export async function patchAirtableRecord(recordId, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${recordId}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: airtableHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ fields }),
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Airtable record update failed (${response.status}): ${text}`);
    error.statusCode = response.status;
    throw error;
  }
  return JSON.parse(text);
}

function approvalKey() {
  const sourceSecret = String(
    process.env.SAMPLE_APPROVAL_SECRET || process.env.AIRTABLE_TOKEN || ""
  ).trim();
  if (!sourceSecret) throw new Error("Sample approval signing is not configured.");
  return crypto
    .createHmac("sha256", sourceSecret)
    .update("moaz-factory-sample-approval-v1")
    .digest();
}

export function createApprovalToken({ recordId, jobId }) {
  const payload = Buffer.from(JSON.stringify({
    v: APPROVAL_TOKEN_VERSION,
    recordId: assertRecordId(recordId),
    jobId: String(jobId ?? ""),
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", approvalKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyApprovalToken(value) {
  const token = String(value || "").trim();
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid sample approval link.");

  const expected = crypto.createHmac("sha256", approvalKey()).update(payload).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    throw new Error("Invalid sample approval link.");
  }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    throw new Error("Invalid sample approval link.");
  }

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid sample approval link.");
  }
  if (parsed?.v !== APPROVAL_TOKEN_VERSION) throw new Error("Invalid sample approval link.");
  const ahmedSampleFingerprint = parsed.ahmedSampleFingerprint;
  if (ahmedSampleFingerprint !== undefined && (typeof ahmedSampleFingerprint !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(ahmedSampleFingerprint))) {
    throw new Error("Invalid sample approval link.");
  }
  return {
    recordId: assertRecordId(parsed.recordId),
    jobId: String(parsed.jobId ?? ""),
    ...(ahmedSampleFingerprint ? { producer: "ahmed", fingerprint: ahmedSampleFingerprint } : {}),
  };
}

export function publicOrigin(req) {
  const configured = String(process.env.MOAZ_PUBLIC_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;

  const productionHost = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  if (productionHost) return `https://${productionHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  const forwardedHost = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "").trim();
  if (!forwardedHost) throw new Error("Public application URL is unavailable.");
  const protocol = String(req.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${protocol}://${forwardedHost}`;
}

export function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
