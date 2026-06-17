const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";

const ALLOWED_PRINTER_NUMBERS = new Set([
  "",
  "PRT ready",
  "Unclear",
  "Big mama",
  "Sublimation",
  "UV DTF",
  "Printed material north",
  "Press Started",
  "Press Finished",
]);

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

  res.status(200).json({ ok: true, printerNumber: value });
}
