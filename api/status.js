const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";
const OUTSOURCE_ARRIVED_TO_PM_VALUES = new Set([
  "Arrived to PM",
  "Arrived to PM North",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { id: recordId, status } = req.body || {};

  if (!recordId) {
    return res.status(400).json({ error: "Missing record id" });
  }
  if (!status || typeof status !== "string") {
    return res.status(400).json({ error: "Missing status" });
  }

  const recordUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`;
  const fields = {
    "Outsource North": status,
  };
  if (OUTSOURCE_ARRIVED_TO_PM_VALUES.has(status.trim())) {
    fields["Ready for ship"] = true;
  }

  const patchRes = await fetch(recordUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields,
    }),
  });

  const text = await patchRes.text();
  if (!patchRes.ok) {
    return res.status(patchRes.status).json({ error: text });
  }

  res.status(200).json({ ok: true, status });
}
