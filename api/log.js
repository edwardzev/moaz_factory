const BASE_ID = "appgJ2DCTbxQLzK2S";
// TABLE_ID corrected to match the one used in api/jobs.js
const TABLE_ID = "tbloqSi9cbJUSa5JV";

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

  const { id: recordId, qty, machine } = req.body;
  const done = Number(qty);

  if (!recordId) {
    return res.status(400).json({ error: "Missing record id" });
  }
  if (!qty || isNaN(done) || done <= 0) {
    return res.status(400).json({ error: "Invalid qty (must be > 0)" });
  }

  const recordUrl =
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`;

  const r = await fetch(recordUrl, {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
    },
  });
  const record = await r.json();

  if (!r.ok) {
    // forward upstream error for easier debugging
    return res.status(r.status).json(record);
  }

  const fields = record.fields || {};

  // If Impr_left is blank, fall back to the original Impressions value.
  let rawLeft = fields["Impr_left"];
  if (rawLeft === undefined || rawLeft === "") rawLeft = fields["Impressions"] ?? 0;

  // Strip commas (thousand separators) and coerce to number
  const currentLeft = Number(String(rawLeft).replace(/,/g, ""));
  if (isNaN(currentLeft)) {
    return res.status(500).json({ error: "Invalid Impr_left on record" });
  }

  if (done > currentLeft) {
    return res.status(400).json({ error: "Done exceeds left qty" });
  }

  const newLeft = currentLeft - done;
  const usedMachine = String(machine ?? fields["Rikma Machine"] ?? "N/A");
  const line = `${nowIL()} - ${done} - ${usedMachine}`;

  const newLog = fields["Impr_log"]
    ? fields["Impr_log"] + "\n" + line
    : line;

  const patchRes = await fetch(recordUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        "Impr_left": newLeft,
        "Impr_log": newLog,
        // persist the machine selection back to the record so the UI can show it
        "Rikma Machine": usedMachine,
      },
    }),
  });

  const patchBody = await patchRes.text();
  if (!patchRes.ok) {
    return res.status(patchRes.status).json({ error: patchBody });
  }

  res.status(200).json({ ok: true, newLeft });
}
