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
