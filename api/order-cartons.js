const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";

function parseNonNegativeNumber(value, label) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing ${label} value`);
  }

  const num = Number(value);
  if (isNaN(num) || num < 0) {
    throw new Error(`${label} must be a number >= 0`);
  }

  return num;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { id: recordId, cartonIn, cartonsOut } = req.body || {};

  if (!recordId) {
    return res.status(400).json({ error: "Missing record id" });
  }

  const fields = {};
  try {
    if (cartonIn !== undefined) {
      fields["Carton IN"] = parseNonNegativeNumber(cartonIn, "Carton IN");
    }
    if (cartonsOut !== undefined) {
      fields["# of packages"] = parseNonNegativeNumber(cartonsOut, "Carton OUT");
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (!Object.keys(fields).length) {
    return res.status(400).json({ error: "No carton fields provided" });
  }

  const recordUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`;

  const patchRes = await fetch(recordUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  const text = await patchRes.text();
  if (!patchRes.ok) {
    return res.status(patchRes.status).json({ error: text });
  }

  res.status(200).json({ ok: true, fields });
}
