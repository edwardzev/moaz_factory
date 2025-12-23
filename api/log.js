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

  const { id: recordId, qty: done, machine } = req.body;

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

  if (!r.ok) {
    // forward upstream error for easier debugging
    return res.status(r.status).json(record);
  }

  const fields = record.fields || {};

  // Ensure Impr_left is treated as a number
  const currentLeft = Number(fields["Impr_left"] ?? 0);
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
