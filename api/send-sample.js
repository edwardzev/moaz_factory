import {
  JOB_ID_FIELD_NAME,
  SAMPLE_FIELD_NAME,
  SEND_SAMPLE_LINK_FIELD_NAME,
  assertRecordId,
  createApprovalToken,
  publicOrigin,
  readAirtableRecord,
} from "./_sample-utils.js";

const PABBLY_HOSTNAME = "connect.pabbly.com";
const PM_NOTIFICATION_PHONE = "972503969640";
const ATTACHMENT_ID_PATTERN = /^att[A-Za-z0-9]{14}$/;

function verifiedPabblyUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new Error("This order has no valid Send sample link.");
  }
  if (url.protocol !== "https:" || url.hostname !== PABBLY_HOSTNAME) {
    throw new Error("This order has no valid Send sample link.");
  }
  return url;
}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const recordId = assertRecordId(req.body?.id);
    const attachmentIds = Array.isArray(req.body?.attachmentIds)
      ? [...new Set(req.body.attachmentIds.map(value => String(value || "").trim()))]
      : [];
    if (!attachmentIds.length || attachmentIds.some(value => !ATTACHMENT_ID_PATTERN.test(value))) {
      return res.status(400).json({ error: "At least one uploaded photo or video is required." });
    }

    const record = await readAirtableRecord(recordId, [
      JOB_ID_FIELD_NAME,
      SAMPLE_FIELD_NAME,
      SEND_SAMPLE_LINK_FIELD_NAME,
    ]);
    const fields = record?.fields || {};
    const attachments = Array.isArray(fields[SAMPLE_FIELD_NAME]) ? fields[SAMPLE_FIELD_NAME] : [];
    const savedAttachmentIds = new Set(attachments.map(item => item?.id).filter(Boolean));
    const missingAttachmentIds = attachmentIds.filter(id => !savedAttachmentIds.has(id));
    if (missingAttachmentIds.length) {
      return res.status(409).json({
        error: "Airtable has not finished saving every selected sample file. Please wait and submit again.",
      });
    }

    const jobId = String(fields[JOB_ID_FIELD_NAME] ?? "");
    const approvalToken = createApprovalToken({ recordId, jobId });
    const origin = publicOrigin(req);
    const approvalUrl = `${origin}/api/sample-approve?token=${encodeURIComponent(approvalToken)}`;
    const commentText = `Comment on sample for order ${jobId}: `;
    const commentUrl = `https://wa.me/${PM_NOTIFICATION_PHONE}?text=${encodeURIComponent(commentText)}`;

    const webhookUrl = verifiedPabblyUrl(fields[SEND_SAMPLE_LINK_FIELD_NAME]);
    webhookUrl.searchParams.set("approve_url", approvalUrl);
    webhookUrl.searchParams.set("comment_url", commentUrl);
    webhookUrl.searchParams.set("sample_job_id", jobId);
    webhookUrl.searchParams.set("sample_attachment_ids", attachmentIds.join(","));

    const response = await fetch(webhookUrl, {
      method: "GET",
      headers: { Accept: "application/json, text/plain, */*" },
      // Do not forward signed callback URLs to a different host if the
      // workflow endpoint responds with a redirect. The initial Pabbly request
      // is the submission; any 2xx or 3xx response confirms it was accepted.
      redirect: "manual",
    });
    const responseText = await response.text();
    if (response.status < 200 || response.status >= 400) {
      return res.status(502).json({
        error: `Send sample workflow rejected the submission (${response.status}).`,
      });
    }

    return res.status(202).json({
      ok: true,
      submitted: true,
      jobId,
      workflowResponseReceived: Boolean(responseText),
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ error: error?.message || String(error) });
  }
}
