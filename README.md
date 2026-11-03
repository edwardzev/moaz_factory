# Moaz Factory Production Tracking

Operational production dashboard served as a static web app with Vercel API routes backed by Airtable.

## Local development

The app expects the same Vercel environment variables used by the deployed project, including `AIRTABLE_TOKEN`.

```bash
vercel dev
```

## Materials

The Materials tab follows the existing Ahmed Factory Materials contract while using the `North` Airtable view.

- Airtable base: `appb6UW8QgmqWAl2M`
- Outsource table: `tblxLxutIQmSKEDg9`
- North view: `viwH3hChg9X5XidDU`
- Items table: `tblnBdTGsk32lHpzO`
- Item display field: `SKU`
- Visible field order: `Record#`, `Created`, `direction`, `Item`, `Qty`, `Agent price`, `Customer price`
- Editable fields: `direction`, `Item`, `Qty`, `Agent price`, `Customer price`
- Read-only fields: `Record#`, `Created`

The Materials tab does not have a separate password. It follows the existing Moaz Factory access model.

## Mobile home-screen app

The production tracker exposes a web app manifest and standalone display metadata for Android and iOS home-screen installation.

- Android/Chrome: open the deployed HTTPS URL and choose **Install app** or **Add to Home screen**.
- iPhone/iPad/Safari: open the deployed HTTPS URL, choose **Share**, then **Add to Home Screen**.

The installed app still requires network access for current Airtable data and operational actions. Its service worker caches only the static application shell; `/api/*` requests are always sent to the network and are never served from cache.

## Sticker labels

Orders in Full list, the order detail modal, and the Main flow inspector expose a **Print sticker** action. The action opens a same-origin A4 print page, loads fresh data from the same Moaz-visible API source, and does not require Airtable access.

The label preserves these exact Airtable fields: `Method`, `JOB ID`, `Client name text`, `Job Name`, `Cut order`, `Graphic 1` through `Graphic 5`, `Width 1 cm`, `Width 2 cm`, `Width 3`, `Width 4`, `Width 5`, and `Number 1` through `Number 5`. Printing remains blocked if a populated graphic field contains multiple attachments or if a required graphic image cannot be loaded.

## Send Sample

The order popup exposes **Send Sample** beside **Print sticker**. Mobile users
can add photos/videos repeatedly, review/remove selections, and submit that
exact selection. Files are uploaded individually to the existing Airtable
`Sample` field. The upload cap is 4.4 MB per file to remain below Vercel's
request-body limit; no arbitrary file-count cap is added.

Submission posts the selected attachment IDs and metadata to the order's
existing `Send sample link` Pabbly webhook with deterministic idempotency.
An explicit `sample_assets_encoded` URI-encoded JSON copy survives Pabbly's
simple-response flattening. A Code step decodes it into the media loop's array;
the original array and JSON copy remain available for compatibility.
Pabbly uses the preserved PM Notifications credential directly in its text/media
actions. Platform requires an explicit managed-provider capability grant and
privately archives the selected media before queueing. Submission acceptance
is not a delivery claim.

One WhatsApp message displays native **Approve** and **Comment** quick-reply
buttons together, without opening a browser. Approve writes
`Sample approved by client=true` and `Main Flow=Sample Approved` on the exact
order. Comment keeps the customer in the PM Notifications chat
(`+972559664485`) to type their feedback; no Airtable comment field is created.

`POST /api/sample-native-reply` accepts only the separately signed Platform
callback (`SAMPLE_NATIVE_REPLY_CALLBACK_SECRET`, at least 32 bytes), fresh
timestamp, and exact issuer configured in `SAMPLE_NATIVE_REPLY_ISSUER` as JSON
with `organizationId`, `lineId`, `bindingGeneration`, and `activationId`.
Button capabilities are signed using the existing sample approval secret,
bound to the order, clean phone, submission, saved attachment set and action.
Changed sample/phone/order and forged callbacks fail closed. Repeated approvals
do not rewrite an already checked order or move a later-stage order backwards.
The attachment-set guard does not infer a "latest sent selection" when two
submissions select different subsets of an otherwise unchanged saved set.
An already checked approval with a different Main Flow is held for review;
the receiver does not infer that the checkbox should be reset. Platform
separately deduplicates native selections, serializes callback delivery and
holds uncertain HTTP outcomes rather than automatically repeating a possible
Airtable mutation. The old signed confirmation URL remains valid for existing
messages; no existing token is rotated. Existing order fields/order, links and
Print sticker remain unchanged.

### Samples group copy

`SAMPLE_NOTIFICATION_GROUP_ID` explicitly enables one exact group recipient;
the approved production group is `120363414125815359@g.us` (`SAMPLES`). Without
that setting, the existing customer-only submission is unchanged. Group
submissions add `sample_group_id`, `sample_customer_name`,
`sample_group_approve_button_id`, and `sample_group_comment_button_id` to the
same webhook payload. `sample_customer_name` is the exact existing
`Client name text` string, or the single string from that field's one-value
Airtable lookup array. Several lookup values are never joined/deduplicated,
and no name or phone fallback is invented. If that name is absent/blank,
ambiguous, or the group capability cannot be generated, the customer
send remains available, all group-send fields are omitted, and
`sample_group_notification_unavailable` states the group-only gap. The workflow
must require the complete group fields before attempting a group copy.
The API also returns server-derived `groupNotification` metadata: `submitted`
means the group copy was included in the accepted workflow submission, not
delivered; `unavailable` includes the exact reason and leaves a visible,
nonfatal operator warning open without enabling a duplicate customer submit;
`disabled` means no group is configured and produces no warning. Request-body
claims cannot override this status.

After the customer transport is confirmed, the workflow sends the same selected
photos/videos to that group with “The sample of {order} is sent to {customer}.”
and native **Approve** and **Comment** buttons. Submission acceptance alone
does not claim customer or group delivery. Group members may approve the order,
writing the same two existing approval/Main Flow fields. Comments remain typed
in the WhatsApp group; no Airtable comment field is introduced.

Group buttons use a distinct `ms3` signing domain and additionally bind the
exact group plus the original customer phone. The receiver requires the
configured group, a separately authenticated individual `participantChatId`
from Platform's signed callback, and fresh order/customer/sample data. The PM
Notifications sender itself is not an eligible group participant. Customer
`ms2` buttons and callbacks remain compatible without `participantChatId`.
Changing/removing the configured group invalidates old group buttons without
changing existing customer buttons or tokens.
