const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbl0qSi9cbJUSa5JV";

function nowIL() {
  const d = new Date();
  return d
    .toLocaleString("en-GB", {
      timeZone: "Asia/Jerusalem",
      hour12: false,
    })
    .replace(",", "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { recordId, done } = req.body;

  if (!recordId || !done || done <= 0) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const recordUrl =
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`;

  const r = await fetch(recordUrl, {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
    },
  });

  const record = await r.json();
  const fields = record.fields;

  const currentLeft = fields["Impr_left"];
  const machine = fields["Rikma Machine"] ?? "N/A";

  if (done > currentLeft) {
    return res.status(400).json({ error: "Done exceeds left qty" });
  }

  const newLeft = currentLeft - done;
  const line = `${nowIL()} - ${done} (M${machine})`;
  const newLog = fields["Impr_log"]
    ? fields["Impr_log"] + "\n" + line
    : line;

  await fetch(recordUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        "Impr_left": newLeft,
        "Impr_log": newLog,
      },
    }),
  });

  res.status(200).json({ ok: true, newLeft });
}
