const BASE_ID  = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";
const VIEW_ID  = "viwRkYqu8uDdjkNK0";

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
      clientNameText: rec.fields["Client name text"] ?? "",
      jobName: rec.fields["Job Name"] ?? "",
      outsourceNorth: rec.fields["Outsource North"] ?? "",
      // Airtable attachment field: array of { id, url, filename, type, thumbnails, ... }
      mockup: Array.isArray(rec.fields["Mock up"]) ? rec.fields["Mock up"] : [],
      method: rec.fields["Method"] ?? "",
      cartonIn: rec.fields["Carton IN"] ?? null,
      impressions: rec.fields["Impressions"],
      // If Impr_left is blank/undefined, default it to the original
      // `Impressions` value (initial quantity). This treats an empty
      // Impr_left as meaning "no progress yet" rather than zero.
      impr_left: Number(
        (rec.fields["Impr_left"] === undefined || rec.fields["Impr_left"] === "")
          ? (rec.fields["Impressions"] ?? 0)
          : rec.fields["Impr_left"]
      ),
      rikmaMachine: rec.fields["Rikma Machine"] ?? null,
      impr_log: rec.fields["Impr_log"] ?? ""
    }))
  );
}
