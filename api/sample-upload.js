import {
  AIRTABLE_BASE_ID,
  MAX_SAMPLE_FILE_BYTES,
  SAMPLE_FIELD_ID,
  SAMPLE_FIELD_NAME,
  airtableHeaders,
  assertRecordId,
  isAllowedSampleContentType,
  readAirtableRecord,
  safeFilename,
} from "./_sample-utils.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_SAMPLE_FILE_BYTES) {
      const error = new Error("Each photo or video must be smaller than 4.4 MB.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  if (!size) {
    const error = new Error("The selected file is empty.");
    error.statusCode = 400;
    throw error;
  }
  return Buffer.concat(chunks);
}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const requestUrl = new URL(req.url, "http://localhost");
    const recordId = assertRecordId(requestUrl.searchParams.get("id"));
    const filename = safeFilename(requestUrl.searchParams.get("filename"));
    const contentType = String(requestUrl.searchParams.get("contentType") || "").trim().toLowerCase();
    if (!isAllowedSampleContentType(contentType)) {
      return res.status(415).json({ error: "Only photos and videos can be uploaded." });
    }

    const recordBeforeUpload = await readAirtableRecord(recordId, ["JOB ID", SAMPLE_FIELD_NAME]);
    const existingAttachments = Array.isArray(recordBeforeUpload?.fields?.[SAMPLE_FIELD_NAME])
      ? recordBeforeUpload.fields[SAMPLE_FIELD_NAME]
      : [];
    const existingAttachmentIds = new Set(existingAttachments.map(item => item?.id).filter(Boolean));
    const file = await readBody(req);
    const uploadUrl = `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${recordId}/${SAMPLE_FIELD_ID}/uploadAttachment`;
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: airtableHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      body: JSON.stringify({
        file: file.toString("base64"),
        filename,
        contentType,
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: `Airtable attachment upload failed: ${text}` });
    }

    const updatedRecord = JSON.parse(text);
    const updatedAttachments = Array.isArray(updatedRecord?.fields?.[SAMPLE_FIELD_ID])
      ? updatedRecord.fields[SAMPLE_FIELD_ID]
      : [];
    const newAttachments = updatedAttachments.filter(item => item?.id && !existingAttachmentIds.has(item.id));
    if (newAttachments.length !== 1) {
      return res.status(502).json({ error: "Airtable accepted the upload but could not uniquely identify this file. Review the order's Sample attachments before uploading again." });
    }
    const attachment = newAttachments[0];
    return res.status(200).json({
      ok: true,
      attachmentId: attachment.id,
      filename,
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ error: error?.message || String(error) });
  }
}
