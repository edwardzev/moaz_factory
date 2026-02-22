const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { id: recordId, meters } = req.body || {};

  if (!recordId) {
    return res.status(400).json({ error: "Missing record id" });
  }
  if (meters === undefined || meters === null || meters === "") {
    return res.status(400).json({ error: "Missing meters value" });
  }

  const num = Number(meters);
  if (isNaN(num)) {
    return res.status(400).json({ error: "Meters must be a number" });
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
        Meters: num,
      },
    }),
  });

  const text = await patchRes.text();
  if (!patchRes.ok) {
    return res.status(patchRes.status).json({ error: text });
  }

  res.status(200).json({ ok: true, meters: num });
}
