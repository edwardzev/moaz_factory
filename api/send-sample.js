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
import {
  CLEAN_PHONE_FIELD_NAME, CLIENT_NAME_FIELD_NAME, configuredSampleGroup,
  createNativeSampleButton, createNativePrinteamSampleButton, createNativeGroupSampleButton,
  configuredPrinteamNativeReplyIssuer, sampleFingerprint, sampleRecipient,
} from "./_native-sample-replies.js";
import { CLIENT_LINK_FIELD_NAME, SAMPLE_SUBMISSION_PROTOCOL, sampleCustomerRoute } from "./_sample-customer-routing.js";

const PABBLY_HOSTNAME = "connect.pabbly.com";
const ATTACHMENT_ID_PATTERN = /^att[A-Za-z0-9]{14}$/;

function groupNotificationPayload(fields, capability) {
  try {
    const groupId = configuredSampleGroup();
    if (!groupId) return {};
    const sourceName = fields[CLIENT_NAME_FIELD_NAME];
    // The current Airtable lookup returns a one-item string array. Accept
    // only that explicit unambiguous shape or a direct string; never join or
    // collapse several customers into an invented recipient name.
    const customerName = Array.isArray(sourceName) && sourceName.length === 1 ? sourceName[0] : sourceName;
    if (typeof customerName !== "string" || !customerName.trim()) {
      return { sample_group_notification_unavailable: "The order has no single nonblank Client name text value. No group notification may be sent." };
    }
    const groupCapability = { ...capability, recipientChatId: groupId, customerPhone: fields[CLEAN_PHONE_FIELD_NAME] };
    return {
      sample_group_id: groupId,
      sample_customer_name: customerName,
      sample_group_approve_button_id: createNativeGroupSampleButton({ ...groupCapability, action: "approve" }),
      sample_group_comment_button_id: createNativeGroupSampleButton({ ...groupCapability, action: "comment" }),
    };
  } catch {
    // A group-only configuration/capability error must not stop the existing
    // customer sample send or invent a recipient/name for the group copy.
    return { sample_group_notification_unavailable: "The sample group notification could not be configured. No group notification may be sent." };
  }
}

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
      CLIENT_NAME_FIELD_NAME,
      CLIENT_LINK_FIELD_NAME,
    ]);
    const fields = record?.fields || {};
    const customerRoute = sampleCustomerRoute(fields);
    if (customerRoute.sender === "printeam") {
      if (req.body?.submissionProtocol !== SAMPLE_SUBMISSION_PROTOCOL) {
        return res.status(409).json({
          error: "The sample sending line has changed. Refresh this page and review any previous or uncertain sample send before submitting again. No WhatsApp submission was made by this request.",
        });
      }
      configuredPrinteamNativeReplyIssuer({ required: true });
    }
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
    const commentUrl = `https://wa.me/${customerRoute.phone}?text=${encodeURIComponent(commentText)}`;

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
    const originalSubmissionIdentity = `${recordId}\n${attachmentIds.join(",")}`;
    // Preserve existing PM idempotency exactly. A new Printeam route is a
    // distinct submission even for assets previously sent from PM, so its
    // PM group dependency metadata cannot collide with the earlier send.
    const submissionIdentity = customerRoute.sender === "printeam"
      ? `${originalSubmissionIdentity}\nmoaz-printeam-sample-v4\n${customerRoute.lineId}`
      : originalSubmissionIdentity;
    const submissionId = crypto
      .createHash("sha256")
      .update(submissionIdentity)
      .digest("hex")
      .slice(0, 32);

    const replyCapability = {
      recordId, jobId, submissionId,
      recipientChatId: sampleRecipient(fields[CLEAN_PHONE_FIELD_NAME]),
      fingerprint: sampleFingerprint(attachments),
    };
    const customerButton = customerRoute.sender === "printeam" ? createNativePrinteamSampleButton : createNativeSampleButton;
    const approveButtonId = customerButton({ ...replyCapability, action: "approve" });
    const commentButtonId = customerButton({ ...replyCapability, action: "comment" });
    const groupPayload = groupNotificationPayload(fields, replyCapability);
    // Derive this only from the server's configured group and saved Airtable
    // fields. Caller-supplied group status is never an authority.
    const groupNotification = groupPayload.sample_group_id
      ? { requested: true, status: "submitted" }
      : groupPayload.sample_group_notification_unavailable
        ? { requested: true, status: "unavailable", reason: groupPayload.sample_group_notification_unavailable }
        : { requested: false, status: "disabled" };

    const webhookUrl = verifiedPabblyUrl(fields[SEND_SAMPLE_LINK_FIELD_NAME]);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rec_id: recordId,
        approve_url: approvalUrl,
        comment_url: commentUrl,
        sample_job_id: jobId,
        sample_attachment_ids: attachmentIds.join(","),
        sample_submission_id: submissionId,
        sample_customer_sender: customerRoute.sender,
        sample_customer_line_id: customerRoute.lineId,
        sample_approve_button_id: approveButtonId,
        sample_comment_button_id: commentButtonId,
        ...groupPayload,
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
      groupNotification,
      workflowResponseReceived: Boolean(responseText),
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ error: error?.message || String(error) });
  }
}
