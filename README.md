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
Pabbly uses the existing PM Notifications credential through separate text/media
relays. Platform requires an explicit managed-provider capability grant and
privately archives the selected media before queueing. Submission acceptance
is not a delivery claim.

The native **Approve** button opens a signed read-only confirmation page. Only
its explicit confirmation POST writes `Sample approved by client=true` and
`Main Flow=Sample Approved` on the exact signed order. The **Comment** button
opens a WhatsApp reply to the verified PM Notifications sender,
`+972559664485`; comments stay in WhatsApp and no Airtable comment field is
created or repurposed. Existing order fields/order and Print sticker remain
unchanged.
