const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbloqSi9cbJUSa5JV";
const TRUCK_LEFT_VALUE = "Truck left";
const OUTSOURCE_DELIVERED_NORTH = "Delivered to North";
const OUTSOURCE_IN_WORK_NORTH = "In work North";
const OUTSOURCE_FINISHED_NORTH = "Finished North";
const OUTSOURCE_ARRIVED_TO_PM = "Arrived to PM";

const PRINTER_NUMBER_VALUES = new Set([
  "",
  "Go North",
  "Delivered outsource",
  "unclear",
  "PRT ready",
  "Sample",
  "Sample Approved",
  "BIG MAMA",
  "Sublimation",
  "UV DTF",
  "Printed Material North",
  "Press Started",
  "Press Finished",
  TRUCK_LEFT_VALUE,
]);

const PRINTER_NUMBER_ALIASES = new Map([
  ["Delivered Outsource", "Delivered outsource"],
  ["Unclear", "unclear"],
  ["Big DTF", "BIG MAMA"],
  ["Big mama", "BIG MAMA"],
  ["Printed material north", "Printed Material North"],
]);

const IN_WORK_PRINTER_NUMBER_VALUES = new Set([
  "PRT ready",
  "Sample",
  "Sample Approved",
  "BIG MAMA",
  "Sublimation",
  "UV DTF",
]);

const IN_PRINTER_PRINTER_NUMBER_VALUES = new Set([
  "BIG MAMA",
  "Sublimation",
  "UV DTF",
]);

const MATERIAL_ONLY_VALUES = new Set([
  "Material only",
  "לא, אני צריך רק חומרים",
  "לא אני צריך רק חומרים",
]);

const MATERIAL_PRESS_VALUES = new Set([
  "Material+press",
  "Material + press",
  "כן, אני רוצה שתדפיסו לי על סחורה",
  "כן אני רוצה שתדפיסו לי על סחורה",
  "כן, אני רוצה שתדפיסו לי על הסחורה",
  "כן אני רוצה שתדפיסו לי על הסחורה",
]);

function normalizePrinterNumber(value) {
  const text = value === null || value === undefined
    ? ""
    : String(value).trim();
  return PRINTER_NUMBER_ALIASES.get(text) || text;
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function textEquals(a, b) {
  return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();
}

function materialPathFor(value) {
  const text = normalizeText(value);
  if (MATERIAL_ONLY_VALUES.has(text)) return "material-only";
  if (MATERIAL_PRESS_VALUES.has(text)) return "material-press";
  return "unknown";
}

function needsRecordContext(printerNumber) {
  return printerNumber === "Printed Material North"
    || printerNumber === "Press Finished"
    || printerNumber === TRUCK_LEFT_VALUE;
}

async function fetchRecordContext(recordUrl) {
  const response = await fetch(recordUrl, {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
    },
  });
  const text = await response.text();

  if (!response.ok) {
    const error = new Error(text);
    error.status = response.status;
    throw error;
  }

  const data = JSON.parse(text);
  return {
    materialOnly: data.fields?.["Material only"] ?? "",
    outsourceNorth: data.fields?.["Outsource North"] ?? "",
  };
}

function nextOutsourceNorthForPrinterNumber(printerNumber, context = {}) {
  if (printerNumber === "Delivered outsource") return OUTSOURCE_DELIVERED_NORTH;
  if (IN_WORK_PRINTER_NUMBER_VALUES.has(printerNumber)) return OUTSOURCE_IN_WORK_NORTH;

  const materialPath = materialPathFor(context.materialOnly);
  if (printerNumber === "Printed Material North" && materialPath === "material-only") {
    return OUTSOURCE_FINISHED_NORTH;
  }
  if (printerNumber === "Press Finished" && materialPath === "material-press") {
    return OUTSOURCE_FINISHED_NORTH;
  }
  if (printerNumber === TRUCK_LEFT_VALUE) {
    if (textEquals(context.outsourceNorth, OUTSOURCE_FINISHED_NORTH)) return null;
    if (textEquals(context.outsourceNorth, OUTSOURCE_ARRIVED_TO_PM)) return null;
    return OUTSOURCE_FINISHED_NORTH;
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { id: recordId, printerNumber } = req.body || {};
  const value = normalizePrinterNumber(printerNumber);

  if (!recordId) {
    return res.status(400).json({ error: "Missing record id" });
  }
  if (!PRINTER_NUMBER_VALUES.has(value)) {
    return res.status(400).json({ error: "Invalid Printer number value" });
  }

  const recordUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`;
  let recordContext = {};
  if (needsRecordContext(value)) {
    try {
      recordContext = await fetchRecordContext(recordUrl);
    } catch (err) {
      return res.status(err?.status || 500).json({ error: err?.message || String(err) });
    }
  }

  const fields = {
    "Printer number": value || null,
  };
  const outsourceNorth = nextOutsourceNorthForPrinterNumber(value, recordContext);
  if (outsourceNorth) {
    fields["Outsource North"] = outsourceNorth;
  }
  if (IN_PRINTER_PRINTER_NUMBER_VALUES.has(value)) {
    fields["In printer"] = true;
  }
  if (value === "Printed Material North" && materialPathFor(recordContext.materialOnly) === "material-press") {
    fields["Out of printer"] = true;
  }

  const patchRes = await fetch(recordUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  const text = await patchRes.text();
  if (!patchRes.ok) {
    return res.status(patchRes.status).json({ error: text });
  }

  res.status(200).json({ ok: true, printerNumber: value, outsourceNorth });
}
