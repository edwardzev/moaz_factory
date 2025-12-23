const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbl0qSi9cbJUSa5JV";
const VIEW_ID  = "viwzYAf6jxP7EInCl";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }

  const url =
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?view=${VIEW_ID}`;

  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
    },
  });

  const data = await r.json();

if (!r.ok) {
  // Surface Airtable error instead of crashing
  return res.status(r.status).json(data);
}

if (!Array.isArray(data.records)) {
  return res.status(500).json({
    error: "Unexpected Airtable response",
    data,
  });
}

const records = data.records.map(rec => ({

  res.status(200).json(records);
}
