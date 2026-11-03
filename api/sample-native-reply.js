import {
  JOB_ID_FIELD_NAME, MAIN_FLOW_FIELD_NAME, SAMPLE_FIELD_NAME,
  SAMPLE_APPROVED_FIELD_NAME, SAMPLE_APPROVED_MAIN_FLOW_VALUE,
  readAirtableRecord, patchAirtableRecord,
} from "./_sample-utils.js";
import {
  CLEAN_PHONE_FIELD_NAME, sampleRecipient, sampleFingerprint,
  verifyNativeReplyEnvelope, verifyNativeSampleButton, configuredSampleGroup,
} from "./_native-sample-replies.js";

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 16_384) throw new Error("Native reply payload is too large.");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

async function airtableOperation(operation) {
  try { return await operation(); }
  catch {
    const error = new Error("Airtable outcome is unavailable.");
    error.statusCode = 503;
    throw error;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  try {
    const callback = verifyNativeReplyEnvelope(await rawBody(req), req.headers || {});
    const action = verifyNativeSampleButton(callback.selectedButtonId);
    if (callback.recipientChatId !== action.recipientChatId) throw new Error("Native reply recipient does not match.");
    const isGroup = Boolean(action.customerRecipientChatId);
    if (isGroup) {
      if (callback.version !== "native-reply.v2" || !configuredSampleGroup() || action.recipientChatId !== configuredSampleGroup()) throw new Error("Group sample reply is not authorized.");
    } else if (callback.version !== "native-reply.v1") {
      throw new Error("Invalid customer sample reply version.");
    }
    const record = await airtableOperation(() => readAirtableRecord(action.recordId, [JOB_ID_FIELD_NAME, CLEAN_PHONE_FIELD_NAME, SAMPLE_FIELD_NAME, SAMPLE_APPROVED_FIELD_NAME, MAIN_FLOW_FIELD_NAME]));
    const fields = record.fields || {};
    if (String(fields[JOB_ID_FIELD_NAME] ?? "") !== action.jobId || sampleRecipient(fields[CLEAN_PHONE_FIELD_NAME]) !== (action.customerRecipientChatId || action.recipientChatId) || sampleFingerprint(fields[SAMPLE_FIELD_NAME]) !== action.fingerprint) {
      return res.status(409).json({ error: "The order, recipient, or sample has changed. Send a new sample." });
    }
    if (action.action === "comment") {
      // The native selection is itself a WhatsApp reply. The button message
      // tells the customer to type their comment in that same chat; no new
      // Airtable field or duplicated outbound prompt is introduced.
      return res.status(200).json({ ok: true, deliveryId: callback.deliveryId, action: "comment", commentInWhatsApp: true });
    }
    if (fields[SAMPLE_APPROVED_FIELD_NAME] === true) {
      // Do not retrigger Airtable automations or move a subsequently advanced
      // order backwards when a delivery is repeated after an uncertain HTTP.
      if (fields[MAIN_FLOW_FIELD_NAME] !== SAMPLE_APPROVED_MAIN_FLOW_VALUE) {
        return res.status(409).json({ error: "The order is already checked as approved but its Main Flow differs. Review the order before sending another sample." });
      }
      return res.status(200).json({ ok: true, deliveryId: callback.deliveryId, action: "approve", alreadyApproved: true });
    }
    await airtableOperation(() => patchAirtableRecord(action.recordId, {
      [SAMPLE_APPROVED_FIELD_NAME]: true,
      [MAIN_FLOW_FIELD_NAME]: SAMPLE_APPROVED_MAIN_FLOW_VALUE,
    }));
    return res.status(200).json({ ok: true, deliveryId: callback.deliveryId, action: "approve", approved: true });
  } catch (error) {
    const status = error?.statusCode || 400;
    // Never echo signed button IDs, HMAC values, or Airtable error bodies.
    return res.status(status >= 500 ? 503 : 400).json({ error: status >= 500 ? "Native sample reply is temporarily unavailable." : "Invalid native sample reply." });
  }
}
