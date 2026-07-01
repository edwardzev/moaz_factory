const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";
const MAIN_FLOW_FIELD_NAME = "Main Flow";

const MAIN_FLOW_VALUES = new Set([
  "",
  "Go North",
  "Go South",
  "Products ordered",
  "Products IN",
  "Ready to send to factory",
  "Delivered to factory",
  "Unclear",
  "PRT Ready",
  "Wait for payment",
  "Sample",
  "Sample Approved",
  "DTF",
  "UV DTF",
  "Sublimation",
  "UV 60/90",
  "Laser",
  "Material Printed",
  "Press Started",
  "Press Finished",
  "Truck left",
]);

const MAIN_FLOW_ALIASES = new Map([
  ["prt ready", "PRT Ready"],
  ["PRT ready", "PRT Ready"],
  ["UVDTF", "UV DTF"],
  ["UV DTF", "UV DTF"],
  ["Material printed", "Material Printed"],
  ["Press started", "Press Started"],
  ["Press finished", "Press Finished"],
  ["truck left", "Truck left"],
]);

function normalizeMainFlow(value) {
  const text = value === null || value === undefined
    ? ""
    : String(value).trim();
  return MAIN_FLOW_ALIASES.get(text) || text;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { id: recordId, mainFlow } = req.body || {};
  const value = normalizeMainFlow(mainFlow);

  if (!recordId) {
    return res.status(400).json({ error: "Missing record id" });
  }
  if (!MAIN_FLOW_VALUES.has(value)) {
    return res.status(400).json({ error: "Invalid Main Flow value" });
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
        [MAIN_FLOW_FIELD_NAME]: value || null,
      },
    }),
  });

  const text = await patchRes.text();
  if (!patchRes.ok) {
    return res.status(patchRes.status).json({ error: text });
  }

  res.status(200).json({ ok: true, mainFlow: value });
}
