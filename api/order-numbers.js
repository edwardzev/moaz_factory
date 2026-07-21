const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";

const EDITABLE_NUMBER_FIELDS = new Set([
  "Number 1",
  "Number 2",
  "Number 3",
  "Number 4",
  "Number 5",
]);

function parseNullableNumber(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${label} must be a number`);
  }

  return num;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { id: recordId, fieldName, value } = req.body || {};

  if (!recordId) {
    return res.status(400).json({ error: "Missing record id" });
  }
  if (!EDITABLE_NUMBER_FIELDS.has(fieldName)) {
    return res.status(400).json({ error: "Invalid Number field" });
  }

  let parsedValue;
  try {
    parsedValue = parseNullableNumber(value, fieldName);
  } catch (err) {
    return res.status(400).json({ error: err.message });
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
        [fieldName]: parsedValue,
      },
    }),
  });

  const text = await patchRes.text();
  if (!patchRes.ok) {
    return res.status(patchRes.status).json({ error: text });
  }

  res.status(200).json({ ok: true, fieldName, value: parsedValue });
}
