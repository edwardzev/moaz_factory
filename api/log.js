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
  // Prefer a numeric machine value (6/8/10) for Airtable if possible.
  // UI sends `machine` as a number, but we defensively coerce.
  const machineNum = machine === undefined || machine === null || machine === ""
    ? null
    : Number(machine);
  const machineForLog = machineNum !== null && !isNaN(machineNum)
    ? String(machineNum)
    : String(fields["Rikma Machine"] ?? "N/A");
  const line = `${nowIL()} - ${done} - ${machineForLog}`;

  const newLog = fields["Impr_log"]
    ? fields["Impr_log"] + "\n" + line
    : line;

  async function patchAirtable(fieldsPatch) {
    const resp = await fetch(recordUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: fieldsPatch }),
    });

    const bodyText = await resp.text();
    return { resp, bodyText };
  }

  // 1) Try PATCH with numeric `Rikma Machine` (common case: number field)
  // 2) If Airtable rejects (422), retry once with string value (common case: single-select)
  const basePatch = {
    "Impr_left": newLeft,
    "Impr_log": newLog,
    ...(newLeft === 0 ? { "Outsource North": "Finished North" } : {}),
  };

  let patchAttempt = basePatch;
  if (machineNum !== null && !isNaN(machineNum)) {
    patchAttempt = { ...basePatch, "Rikma Machine": machineNum };
  }

  let { resp: patchRes, bodyText: patchBody } = await patchAirtable(patchAttempt);

  if (!patchRes.ok && patchRes.status === 422 && machineNum !== null && !isNaN(machineNum)) {
    ({ resp: patchRes, bodyText: patchBody } = await patchAirtable({
      ...basePatch,
      "Rikma Machine": String(machineNum),
    }));
  }

  if (!patchRes.ok) {
    return res.status(patchRes.status).json({ error: patchBody });
  }

  res.status(200).json({ ok: true, newLeft });
}
