const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { id: recordId, machine } = req.body || {};
  const machineNum = Number(machine);

  if (!recordId) {
    return res.status(400).json({ error: "Missing record id" });
  }
  if (isNaN(machineNum) || ![6, 8, 10].includes(machineNum)) {
    return res.status(400).json({ error: "Invalid machine (must be 6/8/10)" });
  }

  const recordUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`;

  async function patchAirtable(fields) {
    const resp = await fetch(recordUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    const bodyText = await resp.text();
    return { resp, bodyText };
  }

  // First try: numeric machine (number field)
  let { resp, bodyText } = await patchAirtable({
    "Rikma Machine": machineNum,
    "Outsource South": "In work South",
  });

  // Retry: string machine (single-select)
  if (!resp.ok && resp.status === 422) {
    ({ resp, bodyText } = await patchAirtable({
      "Rikma Machine": String(machineNum),
      "Outsource South": "In work South",
    }));
  }

  if (!resp.ok) {
    return res.status(resp.status).json({ error: bodyText });
  }

  res.status(200).json({ ok: true, machine: machineNum });
}
