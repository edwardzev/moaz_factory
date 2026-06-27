const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";
const TRUCK_LEFT_VALUE = "Truck left";
const OUTSOURCE_FINISHED_NORTH = "Finished North";
const OUTSOURCE_ARRIVED_TO_PM = "Arrived to PM";

const DUE_FORMULA = `AND(
  {Printer number} = "${TRUCK_LEFT_VALUE}",
  {Outsource North} = "${OUTSOURCE_FINISHED_NORTH}",
  DATETIME_DIFF(NOW(), LAST_MODIFIED_TIME({Printer number}), 'minutes') >= 120
)`;

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
}

async function fetchDueRecords(headers) {
  const records = [];
  let offset = "";

  do {
    const params = new URLSearchParams({
      filterByFormula: DUE_FORMULA,
      pageSize: "100",
    });
    params.append("fields[]", "JOB ID");
    params.append("fields[]", "Printer number");
    params.append("fields[]", "Outsource North");
    if (offset) params.set("offset", offset);

    const response = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params.toString()}`,
      { headers }
    );
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(JSON.stringify(data));
      error.status = response.status;
      throw error;
    }

    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);

  return records;
}

async function updateArrivedToPm(headers, records) {
  let updated = 0;

  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10).map((record) => ({
      id: record.id,
      fields: {
        "Outsource North": OUTSOURCE_ARRIVED_TO_PM,
        "Ready for ship": true,
      },
    }));

    const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ records: batch }),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(JSON.stringify(data));
      error.status = response.status;
      throw error;
    }

    updated += data.records?.length || 0;
  }

  return updated;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const headers = {
    Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  };

  try {
    const dueRecords = await fetchDueRecords(headers);
    const updated = await updateArrivedToPm(headers, dueRecords);
    res.status(200).json({
      ok: true,
      checked: dueRecords.length,
      updated,
    });
  } catch (err) {
    res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
}
