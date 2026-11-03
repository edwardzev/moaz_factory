import {
  JOB_ID_FIELD_NAME,
  SAMPLE_FIELD_NAME,
  SEND_SAMPLE_LINK_FIELD_NAME,
  assertRecordId,
  createApprovalToken,
  publicOrigin,
  readAirtableRecord,
} from "./_sample-utils.js";
import crypto from "node:crypto";
import { CLEAN_PHONE_FIELD_NAME, createNativeSampleButton, createNativeGroupSampleButton, configuredSampleGroup, sampleFingerprint, sampleRecipient } from "./_native-sample-replies.js";

const PABBLY_HOSTNAME = "connect.pabbly.com";
const PM_NOTIFICATION_PHONE = "972559664485";
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
      CLEAN_PHONE_FIELD_NAME,
      "Client name text",
    ]);
    const fields = record?.fields || {};
    const attachments = Array.isArray(fields[SAMPLE_FIELD_NAME]) ? fields[SAMPLE_FIELD_NAME] : [];
    const attachmentsById = new Map(
      attachments
        .filter(item => item?.id)
        .map(item => [item.id, item])
    );
    const missingAttachmentIds = attachmentIds.filter(id => !attachmentsById.has(id));
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

    const selectedAssets = attachmentIds.map(id => {
      const attachment = attachmentsById.get(id);
      const contentType = String(attachment?.type || "").trim().toLowerCase();
      const assetUrl = String(attachment?.url || "").trim();
      if (!assetUrl.startsWith("https://") || (!contentType.startsWith("image/") && !contentType.startsWith("video/"))) {
        const error = new Error("A selected sample file is not a valid Airtable photo or video attachment.");
        error.statusCode = 409;
        throw error;
      }
      return {
        id,
        url: assetUrl,
        filename: String(attachment?.filename || `sample-${id}`).trim(),
        contentType,
        mediaKind: contentType.startsWith("video/") ? "video" : "image",
      };
    });
    const submissionId = crypto
      .createHash("sha256")
      .update(`${recordId}\n${attachmentIds.join(",")}`)
      .digest("hex")
      .slice(0, 32);

    const replyCapability = {
      recordId, jobId, submissionId,
      recipientChatId: sampleRecipient(fields[CLEAN_PHONE_FIELD_NAME]),
      fingerprint: sampleFingerprint(attachments),
    };
    const approveButtonId = createNativeSampleButton({ ...replyCapability, action: "approve" });
    const commentButtonId = createNativeSampleButton({ ...replyCapability, action: "comment" });

    const groupId = configuredSampleGroup();
    let groupPayload = {};
    if (groupId) {
      const nameValue = fields["Client name text"];
      const customerName = Array.isArray(nameValue) && nameValue.length === 1 ? nameValue[0] : nameValue;
      if (typeof customerName !== "string" || !customerName.trim()) {
        const error = new Error("The order needs one exact customer name before its sample can be copied to the group.");
        error.statusCode = 409;
        throw error;
      }
      const groupCapability = { ...replyCapability, recipientChatId: groupId, customerRecipientChatId: replyCapability.recipientChatId };
      groupPayload = {
        sample_group_id: groupId,
        sample_customer_name: customerName,
        sample_group_media_idempotency_keys: attachmentIds.map(id => `sample-${submissionId}-group-${groupId.split("@")[0]}-asset-${id}`).join(","),
        sample_group_message: `The sample of ${jobId} is sent to ${customerName}.`,
        sample_group_approve_button_id: createNativeGroupSampleButton({ ...groupCapability, action: "approve" }),
        sample_group_comment_button_id: createNativeGroupSampleButton({ ...groupCapability, action: "comment" }),
      };
    }
    const webhookUrl = verifiedPabblyUrl(fields[SEND_SAMPLE_LINK_FIELD_NAME]);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rec_id: recordId,
        ...groupPayload,
        approve_url: approvalUrl,
        comment_url: commentUrl,
        sample_job_id: jobId,
        sample_attachment_ids: attachmentIds.join(","),
        sample_submission_id: submissionId,
        sample_approve_button_id: approveButtonId,
        sample_comment_button_id: commentButtonId,
        sample_assets: selectedAssets,
        // Retain the JSON copy for integrations that already read it. Pabbly
        // also parses JSON strings, so the loop uses the URI-encoded copy.
        sample_assets_json: JSON.stringify(selectedAssets),
        sample_assets_encoded: encodeURIComponent(JSON.stringify(selectedAssets)),
      }),
      // Do not forward signed callback URLs to a different host if the
      // workflow endpoint responds with a redirect. Only its own 2xx response
      // confirms acceptance; a login or moved-endpoint redirect is not proof.
      redirect: "manual",
    });
    const responseText = await response.text();
    if (response.status < 200 || response.status >= 300) {
      return res.status(502).json({
        error: `Send sample workflow rejected the submission (${response.status}).`,
      });
    }

    return res.status(202).json({
      ok: true,
      submitted: true,
      jobId,
      submissionId,
      workflowResponseReceived: Boolean(responseText),
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ error: error?.message || String(error) });
  }
}
