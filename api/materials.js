const BASE_ID = "appb6UW8QgmqWAl2M";
const OUTSOURCE_TABLE_ID = "tblxLxutIQmSKEDg9";
const OUTSOURCE_VIEW_ID = "viwH3hChg9X5XidDU";
const ITEMS_TABLE_ID = "tblnBdTGsk32lHpzO";
const ITEMS_PRIMARY_FIELD = "SKU";
const DIRECTION_FIELD = "direction";
const VISIBLE_MATERIAL_FIELDS = [
  "Record#",
  "Created",
  DIRECTION_FIELD,
  "Item",
  "Qty",
  "Agent price",
  "Customer price",
];
const EDITABLE_MATERIAL_FIELDS = new Set([
  DIRECTION_FIELD,
  "Item",
  "Qty",
  "Agent price",
  "Customer price",
]);
const INTEGER_FIELDS = new Set(["Qty", "Agent price", "Customer price"]);

class AirtableRequestError extends Error {
  constructor(status, body) {
    super("airtable_request_failed");
    this.status = status;
    this.body = body;
  }
}

function scalarText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(scalarText).filter(Boolean).join(", ");
  if (typeof value === "object") return String(value.name ?? value.label ?? "");
  return String(value);
}

function itemLinkValues(value) {
  return (Array.isArray(value) ? value : [value])
    .map((item) => {
      if (item && typeof item === "object") {
        return {
          id: String(item.id ?? ""),
          name: scalarText(item.name ?? item.label ?? ""),
        };
      }

      const valueText = String(item ?? "");
      return valueText ? { id: valueText, name: valueText } : null;
    })
    .filter(Boolean)
    .filter((item) => item.id || item.name);
}

async function responseJson(response) {
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return { error: body };
  }
}

async function fetchItemNames(itemIds, { fetchImpl, headers }) {
  if (!itemIds.length) return new Map();

  const formula = `OR(${itemIds.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
  const params = new URLSearchParams({ filterByFormula: formula, pageSize: "100" });
  params.append("fields[]", ITEMS_PRIMARY_FIELD);

  const url = `https://api.airtable.com/v0/${BASE_ID}/${ITEMS_TABLE_ID}?${params.toString()}`;
  const response = await fetchImpl(url, { headers });
  if (!response.ok) return new Map();

  const data = await responseJson(response);
  return new Map(
    (data.records || [])
      .map((record) => [record.id, scalarText(record.fields?.[ITEMS_PRIMARY_FIELD])])
      .filter(([, name]) => name)
  );
}

async function fetchItemOptions({ fetchImpl, headers }) {
  const options = [];
  let offset = "";

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    params.append("fields[]", ITEMS_PRIMARY_FIELD);
    if (offset) params.set("offset", offset);

    const url = `https://api.airtable.com/v0/${BASE_ID}/${ITEMS_TABLE_ID}?${params.toString()}`;
    const response = await fetchImpl(url, { headers });
    const data = await responseJson(response);
    if (!response.ok) throw new AirtableRequestError(response.status, data);

    for (const record of data.records || []) {
      options.push({
        id: record.id,
        name: scalarText(record.fields?.[ITEMS_PRIMARY_FIELD]) || record.id,
      });
    }
    offset = data.offset || "";
  } while (offset);

  return options;
}

async function fetchDirectionOptions({ fetchImpl, headers }) {
  const url = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`;
  const response = await fetchImpl(url, { headers });
  if (!response.ok) return [];

  const data = await responseJson(response);
  const table = (data.tables || []).find((item) => item.id === OUTSOURCE_TABLE_ID);
  const field = (table?.fields || []).find((item) => item.name === DIRECTION_FIELD);
  if (!field || field.type !== "singleSelect") return [];

  return (field.options?.choices || [])
    .map((choice) => scalarText(choice?.name))
    .filter(Boolean);
}

function normalizeMaterialRecord(record, itemNames = new Map()) {
  const fields = record.fields || {};
  const items = itemLinkValues(fields.Item).map((item) => ({
    id: item.id,
    name: itemNames.get(item.id) || item.name || item.id,
  }));

  return {
    id: record.id,
    recordNumber: fields["Record#"] ?? null,
    created: fields.Created ?? record.createdTime ?? "",
    direction: scalarText(fields.direction),
    items,
    qty: fields.Qty ?? null,
    agentPrice: fields["Agent price"] ?? null,
    customerPrice: fields["Customer price"] ?? null,
  };
}

function normalizeEditableFields(rawFields) {
  if (!rawFields || typeof rawFields !== "object" || Array.isArray(rawFields)) {
    throw new TypeError("Missing fields");
  }

  const entries = Object.entries(rawFields);
  if (!entries.length) throw new TypeError("Missing fields");

  const normalized = {};
  for (const [field, value] of entries) {
    if (!EDITABLE_MATERIAL_FIELDS.has(field)) {
      throw new TypeError(`Unsupported field: ${field}`);
    }

    if (field === DIRECTION_FIELD) {
      if (value === null || value === "") normalized[field] = null;
      else if (typeof value === "string") normalized[field] = value;
      else throw new TypeError("Invalid direction");
      continue;
    }

    if (field === "Item") {
      if (!Array.isArray(value) || value.some((id) => !/^rec[a-zA-Z0-9]{14}$/.test(String(id)))) {
        throw new TypeError("Invalid Item links");
      }
      normalized[field] = value.map(String);
      continue;
    }

    if (INTEGER_FIELDS.has(field)) {
      if (value === null || value === "") normalized[field] = null;
      else if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) normalized[field] = value;
      else throw new TypeError(`Invalid ${field}`);
    }
  }

  return normalized;
}

async function getMaterials({ fetchImpl, headers }) {
  const records = [];
  let offset = "";

  do {
    const params = new URLSearchParams({ view: OUTSOURCE_VIEW_ID, pageSize: "100" });
    for (const field of VISIBLE_MATERIAL_FIELDS) params.append("fields[]", field);
    if (offset) params.set("offset", offset);

    const url = `https://api.airtable.com/v0/${BASE_ID}/${OUTSOURCE_TABLE_ID}?${params.toString()}`;
    const response = await fetchImpl(url, { headers });
    const data = await responseJson(response);
    if (!response.ok) throw new AirtableRequestError(response.status, data);

    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);

  const [itemOptions, configuredDirections] = await Promise.all([
    fetchItemOptions({ fetchImpl, headers }),
    fetchDirectionOptions({ fetchImpl, headers }),
  ]);
  const itemNames = new Map(itemOptions.map((item) => [item.id, item.name]));
  const recordDirections = records.map((record) => scalarText(record.fields?.direction)).filter(Boolean);
  const directions = Array.from(new Set([...configuredDirections, ...recordDirections]));

  return {
    records: records.map((record) => normalizeMaterialRecord(record, itemNames)),
    options: { directions, items: itemOptions },
  };
}

async function patchMaterial(req, res, { fetchImpl, headers }) {
  const { id, fields: rawFields } = req.body || {};
  if (!/^rec[a-zA-Z0-9]{14}$/.test(String(id || ""))) {
    return res.status(400).json({ error: "Invalid record id" });
  }

  let fields;
  try {
    fields = normalizeEditableFields(rawFields);
  } catch (error) {
    return res.status(400).json({ error: error?.message || "Invalid fields" });
  }

  if (fields[DIRECTION_FIELD]) {
    const directions = await fetchDirectionOptions({ fetchImpl, headers });
    if (directions.length && !directions.includes(fields[DIRECTION_FIELD])) {
      return res.status(400).json({ error: "Unsupported direction" });
    }
  }

  const url = `https://api.airtable.com/v0/${BASE_ID}/${OUTSOURCE_TABLE_ID}/${id}`;
  const response = await fetchImpl(url, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  const data = await responseJson(response);
  if (!response.ok) return res.status(response.status).json(data);

  const itemIds = itemLinkValues(data.fields?.Item).map((item) => item.id).filter(Boolean);
  let itemNames = new Map();
  try {
    itemNames = await fetchItemNames(itemIds, { fetchImpl, headers });
  } catch {
    // Airtable already committed the write. Display-name lookup must not turn
    // a successful mutation into an ambiguous retryable failure.
  }
  return res.status(200).json({
    ok: true,
    record: normalizeMaterialRecord(data, itemNames),
  });
}

async function createMaterial(req, res, { fetchImpl, headers }) {
  let fields;
  try {
    fields = normalizeEditableFields(req.body?.fields);
  } catch (error) {
    return res.status(400).json({ error: error?.message || "Invalid fields" });
  }

  if (fields[DIRECTION_FIELD]) {
    const directions = await fetchDirectionOptions({ fetchImpl, headers });
    if (directions.length && !directions.includes(fields[DIRECTION_FIELD])) {
      return res.status(400).json({ error: "Unsupported direction" });
    }
  }

  const url = `https://api.airtable.com/v0/${BASE_ID}/${OUTSOURCE_TABLE_ID}`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  const data = await responseJson(response);
  if (!response.ok) return res.status(response.status).json(data);

  const itemIds = itemLinkValues(data.fields?.Item).map((item) => item.id).filter(Boolean);
  let itemNames = new Map();
  try {
    itemNames = await fetchItemNames(itemIds, { fetchImpl, headers });
  } catch {
    // Airtable already committed the create. Display-name lookup must not turn
    // a successful mutation into an ambiguous retryable failure.
  }
  return res.status(201).json({
    ok: true,
    record: normalizeMaterialRecord(data, itemNames),
  });
}

export async function materialsHandler(req, res, {
  fetchImpl = fetch,
  airtableToken = () => process.env.AIRTABLE_TOKEN,
} = {}) {
  res.setHeader("Cache-Control", "private, no-store");
  const headers = { Authorization: `Bearer ${airtableToken()}` };

  if (req.method === "POST") {
    try {
      return await createMaterial(req, res, { fetchImpl, headers });
    } catch (error) {
      if (error instanceof AirtableRequestError) return res.status(error.status).json(error.body);
      return res.status(502).json({ error: "materials_create_unavailable", retryable: true });
    }
  }

  if (req.method === "PATCH") {
    try {
      return await patchMaterial(req, res, { fetchImpl, headers });
    } catch (error) {
      if (error instanceof AirtableRequestError) return res.status(error.status).json(error.body);
      return res.status(502).json({ error: "materials_update_unavailable", retryable: true });
    }
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    return res.status(200).json(await getMaterials({ fetchImpl, headers }));
  } catch (error) {
    if (error instanceof AirtableRequestError) return res.status(error.status).json(error.body);
    return res.status(502).json({ error: "materials_unavailable", retryable: true });
  }
}

export default materialsHandler;
