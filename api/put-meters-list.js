const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";
const FINANCE_CHECK_VIEW_NAME = "Finance check";
const PUT_METERS_FILTER_FORMULA = [
  "AND(",
  "OR({Material only} = 'לא, אני צריך רק חומרים', {Material only} = 'חומרים בלבד'),",
  "LEN({Outsource North} & '') > 0,",
  "LEN({Meters} & '') = 0",
  ")",
].join("");
const AIRTABLE_LOCALE_PARAMS = {
  cellFormat: "string",
  timeZone: "UTC",
  userLocale: "en-us",
};
const FIELDS = [
  "JOB ID",
  "Client name text",
  "Job Name",
  "Material only",
  "Outsource North",
  "Meters",
];

function scalarText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value);
}

function sortRows(rows) {
  return rows.sort((a, b) => {
    const na = Number(a.jobId);
    const nb = Number(b.jobId);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.jobId ?? "").localeCompare(String(b.jobId ?? ""));
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }

  const headers = {
    Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  };
  const rows = [];
  let offset = "";

  do {
    const params = new URLSearchParams({
      view: FINANCE_CHECK_VIEW_NAME,
      filterByFormula: PUT_METERS_FILTER_FORMULA,
      pageSize: "100",
      ...AIRTABLE_LOCALE_PARAMS,
    });
    for (const field of FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params.toString()}`;
    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    for (const rec of data.records || []) {
      rows.push({
        id: rec.id,
        jobId: rec.fields["JOB ID"],
        clientNameText: scalarText(rec.fields["Client name text"]),
        jobName: scalarText(rec.fields["Job Name"]),
        materialOnlyPress: scalarText(rec.fields["Material only"]),
        outsourceNorth: scalarText(rec.fields["Outsource North"]),
        meters: rec.fields["Meters"] ?? null,
      });
    }

    offset = data.offset || "";
  } while (offset);

  sortRows(rows);
  res.status(200).json({ count: rows.length, rows });
}
