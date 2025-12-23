const BASE_ID  = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";
const VIEW_ID  = "viwe9wfbsRLqtud7c";

export default async function handler(req, res) {
  const url =
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?view=${VIEW_ID}`;

  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
    },
  });

  const data = await r.json();

  if (!r.ok) {
    return res.status(r.status).json(data);
  }

  res.json(
    data.records.map(rec => ({
      id: rec.id,
      jobId: rec.fields["JOB ID"],
      impressions: rec.fields["Impressions"],
      impr_left: rec.fields["Impr_left"],
      rikmaMachine: rec.fields["Rikma Machine"] ?? null,
      impr_log: rec.fields["Impr_log"] ?? ""
    }))
  );
}
