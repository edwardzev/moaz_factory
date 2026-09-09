const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";
const OUTSOURCE_NORTH_NOT_EMPTY_FORMULA = "LEN({Outsource North} & '') > 0";

// Fields shown in the regular order popup. Names and order must match Airtable.
const ORDER_FIELD_ORDER = [
  "Impressions",
  "Client name text",
  "Job Name",
  "Product clent brings",
  "products to buy",
  "Method",
  "Mock up",
  "Deadline",
  "Sample",
  "Cut order",
  "Graphic 1",
  "Width 1 cm",
  "Number 1",
  "Graphic 2",
  "Width 2 cm",
  "Number 2",
  "Graphic 3",
  "Width 3",
  "Number 3",
  "Graphic 4",
  "Width 4",
  "Number 4",
  "Graphic 5",
  "Width 5",
  "Number 5",
  "Dropbox link",
  "Manager Field",
  "Carton IN",
  "# of packages",
  "Printed North",
  "Meters",
];

function exactAutoNumberJobId(value) {
  const jobId = String(value ?? "").trim();
  if (!/^[1-9]\d*$/.test(jobId) || jobId.length > 32) return "";
  return jobId;
}

function mapRecord(record) {
  const fields = record?.fields || {};

  return {
    id: record.id,
    jobId: fields["JOB ID"],
    clientNameText: fields["Client name text"] ?? "",
    jobName: fields["Job Name"] ?? "",
    outsourceNorth: fields["Outsource North"] ?? "",
    mockup: Array.isArray(fields["Mock up"]) ? fields["Mock up"] : [],
    method: fields["Method"] ?? "",
    cartonIn: fields["Carton IN"] ?? null,
    cartonsOut: fields["# of packages"] ?? null,
    impressions: fields["Impressions"],
    meters: fields["Meters"] ?? null,
    labelSource: "global",
    order: ORDER_FIELD_ORDER.reduce((order, fieldName) => {
      order[fieldName] = fields[fieldName] ?? null;
      return order;
    }, {}),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requestUrl = new URL(req.url, "http://localhost");
  const jobId = exactAutoNumberJobId(requestUrl.searchParams.get("jobId"));
  if (!jobId) {
    return res.status(400).json({ error: "Enter a valid JOB ID" });
  }

  if (!process.env.AIRTABLE_TOKEN) {
    return res.status(500).json({ error: "Search unavailable" });
  }

  // JOB ID is an Airtable autoNumber. The validated digits are safe to use as
  // a numeric literal, and eligibility is enforced in the same Airtable query.
  const params = new URLSearchParams({
    filterByFormula: `AND({JOB ID} = ${jobId}, ${OUTSOURCE_NORTH_NOT_EMPTY_FORMULA})`,
    maxRecords: "1",
  });

  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
      },
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      console.error("Global order search failed", { status: response.status });
      return res.status(502).json({ error: "Search unavailable" });
    }

    const record = Array.isArray(data.records) ? data.records[0] : null;
    const returnedJobId = String(record?.fields?.["JOB ID"] ?? "");
    const returnedOutsourceNorth = String(record?.fields?.["Outsource North"] ?? "");
    if (!record || returnedJobId !== jobId || returnedOutsourceNorth.length === 0) {
      return res.status(200).json({ found: false, error: "Order not found" });
    }

    return res.status(200).json({ found: true, row: mapRecord(record) });
  } catch (error) {
    console.error("Global order search failed", {
      name: error?.name || "Error",
    });
    return res.status(502).json({ error: "Search unavailable" });
  }
}
