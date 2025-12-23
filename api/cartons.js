const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { id: recordId, cartonIn } = req.body || {};

  if (!recordId) {
    return res.status(400).json({ error: "Missing record id" });
  }

  // Allow 0 as a valid value
  const cartonsNum = Number(cartonIn);
  if (cartonIn === undefined || cartonIn === null || cartonIn === "" || isNaN(cartonsNum) || cartonsNum < 0) {
    return res.status(400).json({ error: "Invalid cartons (must be >= 0)" });
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
        "Carton IN": cartonsNum,
        "Outsource South": "Delivered to South",
      },
    }),
  });

  const patchText = await patchRes.text();
  if (!patchRes.ok) {
    return res.status(patchRes.status).json({ error: patchText });
  }

  res.status(200).json({ ok: true, cartonIn: cartonsNum });
}
