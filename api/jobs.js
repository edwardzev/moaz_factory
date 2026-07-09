const BASE_ID  = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";
const OUTSOURCE_NORTH_VIEW_ID = "viwRkYqu8uDdjkNK0";
const PRIORITY_VIEW_NAME = "Priority";
const MAIN_FLOW_VIEW_NAME = "Main Flow";
const MAIN_FLOW_FIELD_NAME = "Main Flow";
const OUTSOURCE_NORTH_NOT_EMPTY_FORMULA = "LEN({Outsource North} & '') > 0";
const AIRTABLE_LOCALE_PARAMS = {
  cellFormat: "string",
  timeZone: "UTC",
  userLocale: "en-us",
};

// Fields shown in the Job-ID popup (order matters; names must match Airtable exactly)
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
  "Width 4 cm",
  "Number 4",
  "Dropbox link",
  "Manager Field",
  "Carton IN",
  "# of packages",
  "Printed North",
  "Meters",
];

function scalarText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return String(value);
}

async function fetchManagerTextByRecordId(airtableParams, headers) {
  const params = new URLSearchParams(airtableParams);
  params.set("cellFormat", AIRTABLE_LOCALE_PARAMS.cellFormat);
  params.set("timeZone", AIRTABLE_LOCALE_PARAMS.timeZone);
  params.set("userLocale", AIRTABLE_LOCALE_PARAMS.userLocale);
  params.append("fields[]", "Manager");

  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params.toString()}`;
  const response = await fetch(url, { headers });

  if (!response.ok) return new Map();

  const data = await response.json();
  return new Map(
    (data.records || []).map(rec => [rec.id, scalarText(rec.fields?.["Manager"])])
  );
}

export default async function handler(req, res) {
  const requestUrl = new URL(req.url, "http://localhost");
  const requestedView = String(requestUrl.searchParams.get("view") || "").trim().toLowerCase();
  const airtableParams = new URLSearchParams();

  if (requestedView === "priority" || requestedView === "main-flow") {
    airtableParams.set("view", requestedView === "main-flow" ? MAIN_FLOW_VIEW_NAME : PRIORITY_VIEW_NAME);
    airtableParams.set("filterByFormula", OUTSOURCE_NORTH_NOT_EMPTY_FORMULA);
  } else {
    airtableParams.set("view", OUTSOURCE_NORTH_VIEW_ID);
  }

  const url =
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${airtableParams.toString()}`;
  const headers = {
    Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  };

  const r = await fetch(url, { headers });

  const data = await r.json();

  if (!r.ok) {
    return res.status(r.status).json(data);
  }

  const managerTextByRecordId = await fetchManagerTextByRecordId(airtableParams, headers);

  res.json(
    data.records.map(rec => {
      const managerText = managerTextByRecordId.get(rec.id);
      const managerFallback = rec.fields["Manager"] ?? rec.fields["Manager Field"] ?? "";

      return {
        id: rec.id,
        jobId: rec.fields["JOB ID"],
        clientNameText: rec.fields["Client name text"] ?? "",
        jobName: rec.fields["Job Name"] ?? "",
        outsourceNorth: rec.fields["Outsource North"] ?? "",
        printerNumber: rec.fields["Printer number"] ?? "",
        mainFlow: rec.fields[MAIN_FLOW_FIELD_NAME] ?? "",
        printer: rec.fields["Printer"] ?? "",
        status: rec.fields["Status"] ?? "",
        productsOrdered: rec.fields["Products Ordered"] ?? false,
        productsIn: rec.fields["Products IN"] ?? false,
        sendToPrint: rec.fields["Send to print"] ?? false,
        prtFileReady: rec.fields["PRT File Ready"] ?? false,
        paymentStatus: rec.fields["Payment status"] ?? "",
        sampleNeeded: rec.fields["Sample needed"] ?? false,
        sampleApprovedByClient: rec.fields["Sample approved by client"] ?? false,
        sampleStatus: rec.fields["Sample status"] ?? "",
        inPrinter: rec.fields["In printer"] ?? false,
        outOfPrinter: rec.fields["Out of printer"] ?? false,
        pressStarted: rec.fields["Press started"] ?? false,
        pressFinished: rec.fields["Press finished"] ?? false,
        readyForShip: rec.fields["Ready for ship"] ?? false,
        manager: managerText || scalarText(managerFallback),
        materialOnlyPress: rec.fields["Material only"] ?? "",
        // Airtable attachment field: array of { id, url, filename, type, thumbnails, ... }
        mockup: Array.isArray(rec.fields["Mock up"]) ? rec.fields["Mock up"] : [],
        method: rec.fields["Method"] ?? "",
        cartonIn: rec.fields["Carton IN"] ?? null,
        cartonsOut: rec.fields["# of packages"] ?? null,
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
        impr_log: rec.fields["Impr_log"] ?? "",
        meters: rec.fields["Meters"] ?? null,

        // Exact Airtable-field popup payload
        order: ORDER_FIELD_ORDER.reduce((acc, fieldName) => {
          acc[fieldName] = rec.fields[fieldName] ?? null;
          return acc;
        }, {}),
      };
    })
  );
}
