const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";
const TRUCK_LEFT_VALUE = "Truck left";

const ALLOWED_PRINTER_NUMBERS = new Set([
  "",
  "Go North",
  "Delivered Outsource",
  "Unclear",
  "unclear",
  "PRT ready",
  "Sample",
  "Sample Approved",
  "Big mama",
  "Sublimation",
  "UV DTF",
  "Printed Material North",
  "Printed material north",
  "Press Started",
  "Press Finished",
  TRUCK_LEFT_VALUE,
]);

async function sendTruckLeftWebhook(recordId) {
  const webhookUrl = process.env.PABBLY_TRUCK_LEFT_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      ok: false,
      status: 500,
      error: "Missing PABBLY_TRUCK_LEFT_WEBHOOK_URL",
    };
  }

  const webhookRes = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ record_id: recordId }).toString(),
  });
  const responseText = await webhookRes.text();

  return {
    ok: webhookRes.ok,
    status: webhookRes.status,
    response: responseText,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { id: recordId, printerNumber } = req.body || {};
  const value = printerNumber === null || printerNumber === undefined
    ? ""
    : String(printerNumber).trim();

  if (!recordId) {
    return res.status(400).json({ error: "Missing record id" });
  }
  if (!ALLOWED_PRINTER_NUMBERS.has(value)) {
    return res.status(400).json({ error: "Invalid Printer number value" });
  }

  const recordUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`;

  const patchRes = await fetch(recordUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        "Printer number": value || null,
      },
    }),
  });

  const text = await patchRes.text();
  if (!patchRes.ok) {
    return res.status(patchRes.status).json({ error: text });
  }

  let webhook = null;
  if (value === TRUCK_LEFT_VALUE) {
    try {
      webhook = await sendTruckLeftWebhook(recordId);
    } catch (err) {
      webhook = {
        ok: false,
        status: 500,
        error: err?.message || String(err),
      };
    }
  }

  res.status(200).json({ ok: true, printerNumber: value, webhook });
}
