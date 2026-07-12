const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");
const errEl = document.getElementById("error");
const searchEl = document.getElementById("search");
const refreshBtn = document.getElementById("refreshBtn");
const jobsTable = document.getElementById("jobsTable");
const jobsTableShell = document.getElementById("jobsTableShell");
const kanbanEl = document.getElementById("kanban");
const kanbanWorkspace = document.getElementById("kanbanWorkspace");
const listViewBtn = document.getElementById("listViewBtn");
const mainFlowViewBtn = document.getElementById("mainFlowViewBtn");
const listLegend = document.getElementById("listLegend");
const mainFlowActions = document.getElementById("mainFlowActions");
const putMetersBtn = document.getElementById("putMetersBtn");
const putMetersBadge = document.getElementById("putMetersBadge");
const orderInspector = document.getElementById("orderInspector");
const orderInspectorTitle = document.getElementById("orderInspectorTitle");
const orderInspectorBody = document.getElementById("orderInspectorBody");
const orderInspectorClose = document.getElementById("orderInspectorClose");

const viewerBackdrop = document.getElementById("viewerBackdrop");
const viewerTitle = document.getElementById("viewerTitle");
const viewerBody = document.getElementById("viewerBody");
const viewerClose = document.getElementById("viewerClose");

let allRows = [];
let currentView = "list";
let putMetersRows = [];
let selectedInspectorId = null;
let suppressKanbanSelectionUntil = 0;

const VIEW_MODES = {
  list: {
    label: "Full list",
    endpoint: "/api/jobs",
  },
  mainFlow: {
    label: "Main flow",
    endpoint: "/api/jobs?view=main-flow",
    kanban: true,
    updateEndpoint: "/api/main-flow",
    valueField: "mainFlow",
    bodyField: "mainFlow",
  },
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

const READ_ONLY_TEXT_FIELDS = new Set([
  "Product clent brings",
  "products to buy",
]);

const LINK_FIELDS = new Set([
  "Dropbox link",
]);

const EDITABLE_ORDER_NUMBER_FIELDS = new Set([
  "Number 1",
  "Number 2",
  "Number 3",
  "Number 4",
]);

const ORDER_SECTION_STARTS = new Map([
  ["Impressions", "Order details"],
  ["Graphic 1", "Artwork"],
  ["Dropbox link", "Production"],
]);

// The side panel is intentionally a shorter popup. This subset keeps the
// relative order from ORDER_FIELD_ORDER and does not introduce new fields.
const INSPECTOR_FIELD_ORDER = [
  "Impressions",
  "Client name text",
  "Job Name",
  "Method",
  "Mock up",
  "Manager Field",
  "Carton IN",
  "# of packages",
  "Meters",
];

const MATERIAL_ONLY_CARD_LABELS = new Map([
  ["לא, אני צריך רק חומרים", "Material only"],
  ["לא אני צריך רק חומרים", "Material only"],
  ["כן, אני רוצה שתדפיסו לי על סחורה", "Material+press"],
  ["כן אני רוצה שתדפיסו לי על סחורה", "Material+press"],
  ["כן, אני רוצה שתדפיסו לי על הסחורה", "Material+press"],
  ["כן אני רוצה שתדפיסו לי על הסחורה", "Material+press"],
]);
const MATERIAL_ONLY_VALUES = new Set([
  "Material only",
  "לא, אני צריך רק חומרים",
  "לא אני צריך רק חומרים",
]);

const GROUP_ORDER = [
  "outsource north",
  "prepared to send north",
  "delivered north",
  "in printer north",
  "in work north",
  "finished north",
  "arrived to pm north",
];
const GROUP_WEIGHT = new Map(GROUP_ORDER.map((k, i) => [k, i]));
const PRIORITY_COLUMNS = [
  { key: "incoming", values: ["", "Go North", "Uncategorized"], writeValue: "Go North", label: "Incoming" },
  { key: "delivered-outsource", values: ["Delivered outsource", "Delivered Outsource"], writeValue: "Delivered outsource", label: "Delivered Outsource" },
  { key: "unclear", values: ["unclear", "Unclear"], writeValue: "unclear", label: "Unclear" },
  { key: "prt-ready", values: ["PRT ready"], writeValue: "PRT ready", label: "PRT ready" },
  { key: "sample", values: ["Sample"], writeValue: "Sample", label: "Sample" },
  { key: "sample-approved", values: ["Sample Approved"], writeValue: "Sample Approved", label: "Sample Approved" },
  { key: "big-dtf", values: ["BIG MAMA", "Big mama"], writeValue: "BIG MAMA", label: "Big DTF" },
  { key: "sublimation", values: ["Sublimation"], writeValue: "Sublimation", label: "Sublimation" },
  { key: "uv-dtf", values: ["UV DTF"], writeValue: "UV DTF", label: "UV DTF" },
  { key: "printed-material-north", values: ["Printed Material North", "Printed material north"], writeValue: "Printed Material North", label: "Printed material north" },
  { key: "press-started", values: ["Press Started"], writeValue: "Press Started", label: "Press Started" },
  { key: "press-finished", values: ["Press Finished"], writeValue: "Press Finished", label: "Press Finished" },
  { key: "truck-left", values: ["Truck left"], writeValue: "Truck left", label: "Truck left" },
];
const PRIORITY_COLUMN_BY_VALUE = new Map();
for (const column of PRIORITY_COLUMNS) {
  for (const value of column.values) {
    PRIORITY_COLUMN_BY_VALUE.set(value, column);
  }
}

const MAIN_FLOW_COLUMNS = [
  { key: "incoming", values: ["", "Go North", "Products ordered", "Products IN", "Ready to send to factory"], writeValue: "Go North", label: "Incoming" },
  { key: "incoming-material-only", values: [], writeValue: null, label: "Incoming Material only" },
  { key: "delivered-to-factory", values: ["Delivered to factory"], writeValue: "Delivered to factory", label: "Delivered to factory" },
  { key: "unclear", values: ["Unclear"], writeValue: "Unclear", label: "Unclear" },
  { key: "prt-ready", values: ["PRT Ready"], writeValue: "PRT Ready", label: "prt ready" },
  { key: "sample", values: ["Sample"], writeValue: "Sample", label: "sample" },
  { key: "sample-approved", values: ["Sample Approved"], writeValue: "Sample Approved", label: "sample approved" },
  { key: "dtf", values: ["DTF"], writeValue: "DTF", label: "DTF" },
  { key: "uvdtf", values: ["UV DTF"], writeValue: "UV DTF", label: "UVDTF" },
  { key: "sublimation", values: ["Sublimation"], writeValue: "Sublimation", label: "Sublimation" },
  { key: "material-printed", values: ["Material Printed"], writeValue: "Material Printed", label: "Material printed" },
  { key: "press-started", values: ["Press Started"], writeValue: "Press Started", label: "Press started" },
  { key: "press-finished", values: ["Press Finished"], writeValue: "Press Finished", label: "Press finished" },
  { key: "truck-left", values: ["Truck left"], writeValue: "Truck left", label: "truck left" },
];

const MAIN_FLOW_COLUMN_BY_VALUE = new Map();
for (const column of MAIN_FLOW_COLUMNS) {
  for (const value of column.values) {
    MAIN_FLOW_COLUMN_BY_VALUE.set(value, column);
  }
}

const KANBAN_VIEW_COLUMNS = {
  kanban: PRIORITY_COLUMNS,
  mainFlow: MAIN_FLOW_COLUMNS,
};

let draggedKanbanId = null;
let pointerDragState = null;

function displayMethod(method) {
  const m = String(method ?? "").trim().toLowerCase();
  if (m === "press" || m === "cutting to pieces") return "";
  return String(method ?? "");
}

function displayMaterialOnlyCardValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return MATERIAL_ONLY_CARD_LABELS.get(text) || text;
}

function displayPutMetersMaterialOnlyValue(value) {
  return isMaterialOnlyValue(value) ? "חומרים בלבד" : displayMaterialOnlyCardValue(value);
}

function displayCardTextValue(value) {
  const text = readOnlyTextValue(value).trim();
  return text ? escapeHtml(text) : `<span class="muted">—</span>`;
}

function normStatus(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function statusKey(s) {
  const n = normStatus(s);
  if (!n) return "other";

  // Tolerate historical values (South) and normalize them into North.
  const regionNormalized = n.replace(/\s+south$/i, " north");

  // Tolerate spelling/casing variations and current Airtable values.
  if (regionNormalized === "outsourse north") return "outsource north";
  if (regionNormalized === "delivered to north") return "delivered north";
  if (regionNormalized === "delivered north") return "delivered north";
  if (regionNormalized === "fininshed north") return "finished north";
  if (regionNormalized === "arrived to pm") return "arrived to pm north";

  return regionNormalized;
}

function priorityColumnForValue(value) {
  return PRIORITY_COLUMN_BY_VALUE.get(String(value ?? "").trim()) || null;
}

function isChecked(value) {
  if (value === true) return true;
  const text = normStatus(value);
  return text === "checked" || text === "true" || text === "yes";
}

function includesSelectValue(value, expected) {
  const expectedKey = normStatus(expected);
  if (Array.isArray(value)) return value.some((item) => normStatus(item?.name ?? item) === expectedKey);
  return String(value ?? "")
    .split(",")
    .some((item) => normStatus(item) === expectedKey);
}

function isMaterialOnlyValue(value) {
  return MATERIAL_ONLY_VALUES.has(String(value ?? "").trim());
}

function columnsForCurrentKanban() {
  return KANBAN_VIEW_COLUMNS[currentView] || PRIORITY_COLUMNS;
}

function mainFlowColumnForRow(row) {
  const column = MAIN_FLOW_COLUMN_BY_VALUE.get(String(row.mainFlow ?? "").trim()) || null;
  if (!column) return null;
  if (column.key === "incoming" && isMaterialOnlyValue(row.materialOnlyPress)) {
    return MAIN_FLOW_COLUMNS.find((candidate) => candidate.key === "incoming-material-only") || column;
  }
  return column;
}

function columnForRow(row) {
  if (currentView === "mainFlow") return mainFlowColumnForRow(row);
  return priorityColumnForValue(row.printerNumber);
}

function groupWeightFor(key) {
  return GROUP_WEIGHT.has(key) ? GROUP_WEIGHT.get(key) : 999;
}

function slugifyGroup(key) {
  return String(key || "other")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "other";
}

function setStatus(msg) {
  statusEl.textContent = msg;
}
function setError(msg) {
  errEl.textContent = msg || "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtLogPreview(log) {
  if (!log) return `<span class="muted">—</span>`;
  return escapeHtml(log).replaceAll("\n", "<br/>");
}

function openViewer({ jobId, jobName, url, filename, mime }) {
  const title = `${jobId ?? ""}${jobName ? ` — ${jobName}` : ""}`.trim();
  viewerTitle.textContent = title || "Preview";
  viewerBackdrop.dataset.mode = "attachment";

  const safeUrl = String(url || "");
  const safeFilename = String(filename || "file");
  const safeMime = String(mime || "");

  // Basic file preview: images render as <img>; otherwise use <iframe>.
  const isImage = safeMime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(safeFilename);
  const inner = isImage
    ? `<img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(safeFilename)}" style="max-width:100%;height:auto;"/>`
    : `<iframe class="modal-frame" src="${escapeHtml(safeUrl)}" title="${escapeHtml(safeFilename)}"></iframe>`;

  viewerBody.innerHTML = inner;
  viewerBackdrop.style.display = "flex";
  viewerBackdrop.setAttribute("aria-hidden", "false");
}

function isAirtableAttachmentArray(v) {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] && typeof v[0].url === "string";
}

function fmtScalar(v) {
  if (v === null || v === undefined || v === "") return `<span class="muted">—</span>`;
  if (typeof v === "boolean") return escapeHtml(v ? "Yes" : "No");
  if (typeof v === "number") return escapeHtml(String(v));
  return escapeHtml(String(v));
}

function fmtDeadline(v) {
  if (v === null || v === undefined || v === "") return `<span class="muted">—</span>`;
  const raw = String(v);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return fmtScalar(v);

  const formatted = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `<time datetime="${escapeHtml(raw)}" title="${escapeHtml(raw)}">${escapeHtml(formatted)}</time>`;
}

function readOnlyTextValue(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.filter(item => item !== null && item !== undefined && item !== "").join(", ");
  return String(v);
}

function readOnlyTextField(v) {
  const value = readOnlyTextValue(v);
  return `
    <textarea
      readonly
      aria-readonly="true"
      placeholder="—"
    >${escapeHtml(value)}</textarea>`;
}

function linkField(v) {
  const value = readOnlyTextValue(v).trim();
  if (!value) return `<span class="muted">—</span>`;
  return `
    <a class="external-link" href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">
      <i class="ph ph-arrow-square-out" aria-hidden="true"></i>
      <span>${escapeHtml(value)}</span>
    </a>`;
}

function editableOrderNumberField({ recordId, fieldName, value }) {
  const current = value != null ? escapeHtml(String(value)) : "";
  return `
    <div class="field-editor" data-order-number-editor>
      <input type="number" class="order-number-input" data-record-id="${escapeHtml(recordId)}" data-field="${escapeHtml(fieldName)}" value="${current}" step="any" />
      <button type="button" class="order-number-submit" data-record-id="${escapeHtml(recordId)}" data-field="${escapeHtml(fieldName)}">Save</button>
    </div>`;
}

function attachmentsList(items, { jobId, jobName }) {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return `<span class="muted">—</span>`;

  const itemsHtml = arr
    .map((a) => {
      const url = a?.url;
      const filename = a?.filename || "file";
      const mime = a?.type || "";
      if (!url) return "";

      const thumb =
        a?.thumbnails?.large?.url ||
        a?.thumbnails?.full?.url ||
        a?.thumbnails?.small?.url ||
        null;

      const preview = thumb
        ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(filename)}"/>`
        : `<span class="pill">${escapeHtml(filename)}</span>`;

      return `
        <div class="attachment-item">
          <a href="#" class="attachment-preview order-attach-view" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}" data-mime="${escapeHtml(mime)}" data-jobid="${escapeHtml(jobId ?? "")}" data-jobname="${escapeHtml(jobName ?? "")}" title="View ${escapeHtml(filename)}">
            ${preview}
          </a>
          <div class="attachment-links">
            <a href="#" class="order-attach-view" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}" data-mime="${escapeHtml(mime)}" data-jobid="${escapeHtml(jobId ?? "")}" data-jobname="${escapeHtml(jobName ?? "")}">view</a>
            <a href="#" class="order-attach-download" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}">download</a>
          </div>
        </div>
      `;
    })
    .join("");

  return `<div class="attachment-list">${itemsHtml}</div>`;
}

function mockupsCell(mockups) {
  const items = Array.isArray(mockups) ? mockups : [];
  if (!items.length) return `<span class="muted">—</span>`;

  return items
    .map((a) => {
      const url = a?.url;
      const filename = a?.filename || "file";
      const mime = a?.type || "";
      if (!url) return "";

      const thumb =
        a?.thumbnails?.small?.url ||
        a?.thumbnails?.large?.url ||
        a?.thumbnails?.full?.url ||
        null;

      const img = thumb
        ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(filename)}"/>`
        : `<span class="pill">${escapeHtml(filename)}</span>`;

      return `
        <div class="mockup-item">
          <button
            type="button"
            class="mockup-view"
            data-url="${escapeHtml(url)}"
            data-filename="${escapeHtml(filename)}"
            data-mime="${escapeHtml(mime)}"
            title="View ${escapeHtml(filename)}"
          >
            ${img}
          </button>
          <div class="mockup-links">
            <a href="#" class="mockup-view" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}" data-mime="${escapeHtml(mime)}">view</a>
            <a href="#" class="mockup-download" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}">download</a>
          </div>
        </div>
      `;
    })
    .join("");
}

function kanbanMockupsCell(mockups) {
  const items = Array.isArray(mockups) ? mockups : [];
  if (!items.length) return `<span class="muted">—</span>`;

  return items
    .map((a) => {
      const url = a?.url;
      const filename = a?.filename || "file";
      const mime = a?.type || "";
      if (!url) return "";

      const thumb =
        a?.thumbnails?.large?.url ||
        a?.thumbnails?.full?.url ||
        a?.thumbnails?.small?.url ||
        null;

      const img = thumb
        ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(filename)}"/>`
        : `<span class="pill">${escapeHtml(filename)}</span>`;

      return `
        <div class="mockup-item">
          <a
            href="#"
            class="mockup-view"
            data-url="${escapeHtml(url)}"
            data-filename="${escapeHtml(filename)}"
            data-mime="${escapeHtml(mime)}"
            title="View ${escapeHtml(filename)}"
          >
            ${img}
          </a>
          <div class="mockup-links">
            <a href="#" class="mockup-view" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}" data-mime="${escapeHtml(mime)}">view</a>
            <a href="#" class="mockup-download" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}">download</a>
          </div>
        </div>
      `;
    })
    .join("");
}

function updatePutMetersBadge(count) {
  putMetersBadge.textContent = String(Number.isFinite(Number(count)) ? Number(count) : 0);
}

async function fetchPutMetersRows() {
  const response = await fetch("/api/put-meters-list", { cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  putMetersRows = Array.isArray(data?.rows) ? data.rows : [];
  updatePutMetersBadge(data?.count ?? putMetersRows.length);
  return putMetersRows;
}

async function refreshPutMetersBadge() {
  try {
    await fetchPutMetersRows();
  } catch (err) {
    putMetersBadge.textContent = "!";
  }
}

function isPutMetersPopupOpen() {
  return viewerBackdrop.style.display === "flex" && Boolean(viewerBody.querySelector("[data-put-meters-list]"));
}

function renderPutMetersList(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const rowHtml = (row) => `
    <article class="put-meters-row" data-id="${escapeHtml(row.id)}">
      <div class="put-meters-row-head">
        <button
          type="button"
          class="pill put-meters-job put-meters-order-open"
          data-record-id="${escapeHtml(row.id)}"
          aria-label="Open order ${escapeHtml(row.jobId ?? "")}"
        >${escapeHtml(row.jobId ?? "")}</button>
        <span class="pill">${escapeHtml(displayPutMetersMaterialOnlyValue(row.materialOnlyPress))}</span>
      </div>
      <div class="put-meters-title">${escapeHtml(row.jobName ?? "")}</div>
      <dl class="put-meters-meta">
        <dt>Client</dt>
        <dd>${displayCardTextValue(row.clientNameText)}</dd>
        <dt>Outsource North</dt>
        <dd>${displayCardTextValue(row.outsourceNorth)}</dd>
        <dt>Meters</dt>
        <dd><span class="muted">—</span></dd>
      </dl>
      <div class="put-meters-editor">
        <input type="number" class="put-meters-input" data-record-id="${escapeHtml(row.id)}" step="any" />
        <button type="button" class="put-meters-submit" data-record-id="${escapeHtml(row.id)}">Save</button>
        <span class="muted">note: write x2 of actual meters.</span>
      </div>
    </article>
  `;

  viewerBody.innerHTML = `
    <div class="put-meters-list" data-put-meters-list>
      ${list.length ? list.map(rowHtml).join("") : '<div class="muted">No orders</div>'}
    </div>
  `;
}

async function refreshPutMetersPopup() {
  viewerBody.innerHTML = `<div class="put-meters-list" data-put-meters-list><div class="muted">Loading…</div></div>`;
  try {
    const rows = await fetchPutMetersRows();
    if (isPutMetersPopupOpen()) renderPutMetersList(rows);
  } catch (err) {
    viewerBody.innerHTML = `<div class="put-meters-list" data-put-meters-list><div class="error">${escapeHtml(err?.message || String(err))}</div></div>`;
  }
}

function openPutMetersModal() {
  viewerTitle.textContent = "Put meters";
  viewerBackdrop.dataset.mode = "put-meters";
  viewerBody.innerHTML = `<div class="put-meters-list" data-put-meters-list><div class="muted">Loading…</div></div>`;
  viewerBackdrop.style.display = "flex";
  viewerBackdrop.setAttribute("aria-hidden", "false");
  refreshPutMetersPopup();
}

function cartonFieldInputValue(value, fallbackValue = null) {
  const resolved = value ?? fallbackValue;
  return resolved === null || resolved === undefined ? "" : String(resolved);
}

function kanbanCartonEditor({ row, field, label, value, fallbackValue = null }) {
  const current = cartonFieldInputValue(value, fallbackValue);
  return `
    <div class="kanban-carton-row">
      <label class="kanban-carton-label" for="kanban-${escapeHtml(field)}-${escapeHtml(row.id)}">${escapeHtml(label)}</label>
      <input
        id="kanban-${escapeHtml(field)}-${escapeHtml(row.id)}"
        type="number"
        class="kanban-carton-input"
        data-record-id="${escapeHtml(row.id)}"
        data-carton-field="${escapeHtml(field)}"
        value="${escapeHtml(current)}"
        step="any"
        min="0"
      />
      <button
        type="button"
        class="kanban-carton-submit"
        data-record-id="${escapeHtml(row.id)}"
        data-carton-field="${escapeHtml(field)}"
      >Save</button>
    </div>
  `;
}

function orderCartonEditor({ row, fieldName, value, fallbackValue = null, inspector = false }) {
  const isCartonOut = fieldName === "# of packages";
  const current = cartonFieldInputValue(value, fallbackValue);
  const inputClass = isCartonOut ? "cartons-out-input" : "carton-in-input";
  const buttonClass = isCartonOut ? "cartons-out-submit" : "carton-in-submit";
  const editorClass = inspector ? "inspector-editor" : "field-editor";

  return `
    <div class="${editorClass}">
      <input
        type="number"
        class="${inputClass}"
        data-record-id="${escapeHtml(row.id)}"
        value="${escapeHtml(current)}"
        step="any"
        min="0"
      />
      <button type="button" class="${buttonClass}" data-record-id="${escapeHtml(row.id)}">Save</button>
    </div>`;
}

function closeOrderInspector() {
  selectedInspectorId = null;
  orderInspector.hidden = true;
  orderInspector.setAttribute("aria-hidden", "true");
  orderInspector.removeAttribute("data-id");
  orderInspectorTitle.textContent = "Selected order";
  orderInspectorBody.innerHTML = "";
  kanbanWorkspace.classList.remove("inspector-open");
  kanbanEl.querySelectorAll(".kanban-card.selected").forEach(card => card.classList.remove("selected"));
}

function renderOrderInspector(row) {
  if (!row) {
    closeOrderInspector();
    return;
  }

  const jobId = row.jobId ?? "";
  const jobName = row.jobName ?? "";
  const order = row.order && typeof row.order === "object" ? row.order : {};

  orderInspector.dataset.id = row.id;
  orderInspectorTitle.innerHTML = `
    <a href="#" class="inspector-title-job job-open" aria-label="Open order ${escapeHtml(jobId)}">
      Job ${escapeHtml(jobId)}
    </a>`;

  const fields = INSPECTOR_FIELD_ORDER.map((fieldName) => {
    const value = order[fieldName];
    const displayFieldName = fieldName === "# of packages" ? "Carton OUT" : fieldName;
    let rendered;

    if (fieldName === "Carton IN") {
      rendered = orderCartonEditor({ row, fieldName, value, inspector: true });
    } else if (fieldName === "# of packages") {
      rendered = orderCartonEditor({
        row,
        fieldName,
        value,
        fallbackValue: order["Carton IN"],
        inspector: true,
      });
    } else if (fieldName === "Method") {
      const method = displayMethod(value);
      rendered = method.trim() ? escapeHtml(method) : `<span class="muted">—</span>`;
    } else if (isAirtableAttachmentArray(value)) {
      rendered = attachmentsList(value, { jobId, jobName });
    } else if (Array.isArray(value)) {
      rendered = value.length ? escapeHtml(value.join(", ")) : `<span class="muted">—</span>`;
    } else {
      rendered = fmtScalar(value);
    }

    return `
      <div class="inspector-field" data-inspector-field="${escapeHtml(fieldName)}">
        <div class="inspector-field-label">${escapeHtml(displayFieldName)}</div>
        <div class="inspector-field-value">${rendered}</div>
      </div>`;
  }).join("");

  orderInspectorBody.innerHTML = `
    <div class="inspector-order-context" dir="auto">${escapeHtml(jobName)}</div>
    <div class="inspector-fields">${fields}</div>`;
  orderInspector.hidden = false;
  orderInspector.setAttribute("aria-hidden", "false");
  kanbanWorkspace.classList.add("inspector-open");
}

function selectOrderInspector(row) {
  selectedInspectorId = row?.id || null;
  if (!selectedInspectorId) {
    closeOrderInspector();
    return;
  }

  renderOrderInspector(row);
  kanbanEl.querySelectorAll(".kanban-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.id === selectedInspectorId);
  });
}

function reconcileOrderInspector() {
  if (currentView !== "mainFlow" || !selectedInspectorId) return;
  const row = allRows.find(item => item.id === selectedInspectorId) || null;
  if (!row) {
    closeOrderInspector();
    return;
  }
  selectOrderInspector(row);
}

function openOrderModal(row) {
  const jobId = row?.jobId ?? "";
  const jobName = row?.jobName ?? "";
  const safeJobId = escapeHtml(jobId);
  const safeJobName = escapeHtml(jobName);
  viewerTitle.innerHTML = safeJobId || safeJobName
    ? `<span class="modal-job-id">${safeJobId}</span>${safeJobName ? `<span aria-hidden="true"> — </span><span dir="auto">${safeJobName}</span>` : ""}`
    : "Order";
  viewerBackdrop.dataset.mode = "order";

  const order = row?.order && typeof row.order === "object" ? row.order : {};
  const lines = ORDER_FIELD_ORDER.map((fieldName) => {
    const v = order[fieldName];
    const displayFieldName = fieldName === "# of packages" ? "Carton OUT" : fieldName;
    let rendered;

    if (fieldName === "Carton IN") {
      rendered = orderCartonEditor({ row, fieldName, value: v });
    } else if (fieldName === "# of packages") {
      rendered = orderCartonEditor({ row, fieldName, value: v, fallbackValue: order["Carton IN"] });
    } else if (fieldName === "Meters") {
      const current = v != null ? escapeHtml(String(v)) : "";
      rendered = `
        <div class="field-editor">
          <input type="number" class="meters-input" data-record-id="${escapeHtml(row.id)}" value="${current}" step="any" />
          <button type="button" class="meters-submit" data-record-id="${escapeHtml(row.id)}">Save</button>
          <span class="field-note">note: write x2 of actual meters.</span>
        </div>`;
    } else if (fieldName === "Printed North") {
      const current = v != null ? escapeHtml(String(v)) : "";
      const options = ["Printed North DTF", "Printed North Sublim...", "Printed North UVDTF"];
      const optionsHtml = options.map(opt => {
        const selected = current === opt ? "selected" : "";
        return `<option value="${escapeHtml(opt)}" ${selected}>${escapeHtml(opt)}</option>`;
      }).join("");
      rendered = `
        <div class="field-editor">
          <select class="printed-north-select" data-record-id="${escapeHtml(row.id)}">
            <option value="">-- Select --</option>
            ${optionsHtml}
          </select>
          <button type="button" class="printed-north-submit" data-record-id="${escapeHtml(row.id)}">Save</button>
        </div>`;
    } else if (fieldName === "Method") {
      const m = displayMethod(v);
      rendered = m.trim() ? escapeHtml(m) : `<span class="muted">—</span>`;
    } else if (EDITABLE_ORDER_NUMBER_FIELDS.has(fieldName)) {
      rendered = editableOrderNumberField({ recordId: row.id, fieldName, value: v });
    } else if (fieldName === "Deadline") {
      rendered = fmtDeadline(v);
    } else if (LINK_FIELDS.has(fieldName)) {
      rendered = linkField(v);
    } else if (READ_ONLY_TEXT_FIELDS.has(fieldName)) {
      rendered = readOnlyTextField(v);
    } else if (isAirtableAttachmentArray(v)) {
      rendered = attachmentsList(v, { jobId, jobName });
    } else if (Array.isArray(v)) {
      rendered = v.length ? escapeHtml(v.join(", ")) : `<span class="muted">—</span>`;
    } else {
      rendered = fmtScalar(v);
    }

    const sectionLabel = ORDER_SECTION_STARTS.get(fieldName);
    const sectionRow = sectionLabel
      ? `<tr class="order-sheet-section" aria-hidden="true"><td colspan="2">${escapeHtml(sectionLabel)}</td></tr>`
      : "";

    return `
      ${sectionRow}
      <tr data-order-field="${escapeHtml(fieldName)}">
        <td class="order-field-label"><strong>${escapeHtml(displayFieldName)}</strong></td>
        <td class="order-field-value">${rendered}</td>
      </tr>
    `;
  }).join("");

  viewerBody.innerHTML = `
    <div class="order-sheet-scroll" data-order-sheet-scroll>
      <table class="order-sheet">
        <tbody>${lines}</tbody>
      </table>
    </div>
  `;

  viewerBackdrop.style.display = "flex";
  viewerBackdrop.setAttribute("aria-hidden", "false");
}

async function openOrderModalByRecordId(recordId) {
  let row =
    allRows.find(item => item.id === recordId) ||
    putMetersRows.find(item => item.id === recordId) ||
    null;

  if (!row?.order) {
    const response = await fetch("/api/jobs", { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    row = Array.isArray(rows) ? rows.find(item => item.id === recordId) : null;
  }

  if (!row) throw new Error("Order not found in Full list.");
  openOrderModal(row);
}

function openPutMetersOrder(recordId) {
  if (!recordId) return;

  setError("");
  openOrderModalByRecordId(recordId).catch((err) => {
    setError(err?.message || String(err));
    alert("Failed to open order. See error above.");
  });
}

function closeViewer() {
  viewerBackdrop.style.display = "none";
  viewerBackdrop.setAttribute("aria-hidden", "true");
  delete viewerBackdrop.dataset.mode;
  viewerTitle.textContent = "";
  viewerBody.innerHTML = "";
}

viewerClose.addEventListener("click", closeViewer);
function orderEditorRootForTarget(target) {
  return target.closest("#orderInspectorBody") || viewerBody;
}

function handleOrderSurfaceClick(e) {
  if (e.target === viewerBackdrop) closeViewer();

  const putMetersOrderTrigger = e.target.closest(".put-meters-order-open");
  if (putMetersOrderTrigger) {
    e.preventDefault();
    openPutMetersOrder(putMetersOrderTrigger.dataset.recordId || "");
    return;
  }

  if (e.target.closest(".put-meters-row") && !e.target.closest(".put-meters-editor, input, button, select, textarea")) {
    const rowEl = e.target.closest(".put-meters-row");
    const recordId = rowEl?.dataset?.id || "";
    e.preventDefault();
    openPutMetersOrder(recordId);
    return;
  }

  // Handle attachment view inside order popup
  if (e.target.closest(".order-attach-view")) {
    e.preventDefault();
    const el = e.target.closest(".order-attach-view");
    openViewer({
      jobId: el.dataset.jobid,
      jobName: el.dataset.jobname,
      url: el.dataset.url,
      filename: el.dataset.filename,
      mime: el.dataset.mime,
    });
    return;
  }

  // Handle attachment download inside order popup
  if (e.target.closest(".order-attach-download")) {
    e.preventDefault();
    const el = e.target.closest(".order-attach-download");
    const url = el.dataset.url;
    const filename = el.dataset.filename || "download";
    if (!url) return;
    const a = document.createElement("a");
    a.href = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  if (e.target.closest(".carton-in-submit")) {
    const btn = e.target.closest(".carton-in-submit");
    const recordId = btn.dataset.recordId;
    const input = orderEditorRootForTarget(e.target).querySelector(`.carton-in-input[data-record-id="${recordId}"]`);
    if (!input) return;

    const val = input.value.trim();
    if (val === "" || isNaN(Number(val)) || Number(val) < 0) {
      alert("Please enter a valid number for Carton IN.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Saving…";
    setError("");

    fetch("/api/order-cartons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: recordId, cartonIn: Number(val) }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        btn.textContent = "Saved ✓";
        setTimeout(() => { btn.textContent = "Save"; }, 1500);
        await load();
      })
      .catch((err) => {
        setError(err?.message || String(err));
        alert("Failed to save Carton IN. See error above.");
        btn.textContent = "Save";
      })
      .finally(() => {
        btn.disabled = false;
      });
    return;
  }

  if (e.target.closest(".cartons-out-submit")) {
    const btn = e.target.closest(".cartons-out-submit");
    const recordId = btn.dataset.recordId;
    const input = orderEditorRootForTarget(e.target).querySelector(`.cartons-out-input[data-record-id="${recordId}"]`);
    if (!input) return;

    const val = input.value.trim();
    if (val === "" || isNaN(Number(val)) || Number(val) < 0) {
      alert("Please enter a valid number for Carton OUT.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Saving…";
    setError("");

    fetch("/api/order-cartons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: recordId, cartonsOut: Number(val) }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        btn.textContent = "Saved ✓";
        setTimeout(() => { btn.textContent = "Save"; }, 1500);
        await load();
      })
      .catch((err) => {
        setError(err?.message || String(err));
        alert("Failed to save Carton OUT. See error above.");
        btn.textContent = "Save";
      })
      .finally(() => {
        btn.disabled = false;
      });
    return;
  }

  if (e.target.closest(".order-number-submit")) {
    const btn = e.target.closest(".order-number-submit");
    const recordId = btn.dataset.recordId;
    const fieldName = btn.dataset.field;
    const editor = btn.closest("[data-order-number-editor]");
    const input = editor?.querySelector(".order-number-input");
    if (!input || !EDITABLE_ORDER_NUMBER_FIELDS.has(fieldName)) return;

    const rawValue = input.value.trim();
    if (rawValue !== "" && !Number.isFinite(Number(rawValue))) {
      alert(`Please enter a valid number for ${fieldName}.`);
      return;
    }

    btn.disabled = true;
    btn.textContent = "Saving…";
    setError("");

    fetch("/api/order-numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: recordId,
        fieldName,
        value: rawValue === "" ? null : Number(rawValue),
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        const result = await r.json().catch(() => ({}));
        const row = allRows.find(item => item.id === recordId);
        if (row?.order && typeof row.order === "object") {
          row.order[fieldName] = result.value ?? null;
        }
        btn.textContent = "Saved ✓";
        setTimeout(() => { btn.textContent = "Save"; }, 1500);
        await load();
      })
      .catch((err) => {
        setError(err?.message || String(err));
        alert(`Failed to save ${fieldName}. See error above.`);
        btn.textContent = "Save";
      })
      .finally(() => {
        btn.disabled = false;
      });
    return;
  }

  if (e.target.closest(".put-meters-submit")) {
    const btn = e.target.closest(".put-meters-submit");
    const recordId = btn.dataset.recordId;
    const input = viewerBody.querySelector(`.put-meters-input[data-record-id="${recordId}"]`);
    if (!input) return;

    const val = input.value.trim();
    if (val === "" || isNaN(Number(val))) {
      alert("Please enter a valid number for Meters.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Saving…";
    setError("");

    fetch("/api/meters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: recordId, meters: Number(val) }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        await refreshPutMetersPopup();
        await load();
      })
      .catch((err) => {
        setError(err?.message || String(err));
        alert("Failed to save Meters. See error above.");
        btn.textContent = "Save";
      })
      .finally(() => {
        btn.disabled = false;
      });
    return;
  }

  // Handle Meters save button inside order popup
  if (e.target.closest(".meters-submit")) {
    const btn = e.target.closest(".meters-submit");
    const recordId = btn.dataset.recordId;
    const input = viewerBody.querySelector(`.meters-input[data-record-id="${recordId}"]`);
    if (!input) return;

    const val = input.value.trim();
    if (val === "" || isNaN(Number(val))) {
      alert("Please enter a valid number for Meters.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Saving…";
    setError("");

    fetch("/api/meters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: recordId, meters: Number(val) }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        btn.textContent = "Saved ✓";
        setTimeout(() => { btn.textContent = "Save"; }, 1500);
        // Refresh data in background
        await load();
        refreshPutMetersBadge();
      })
      .catch((err) => {
        setError(err?.message || String(err));
        alert("Failed to save Meters. See error above.");
        btn.textContent = "Save";
      })
      .finally(() => {
        btn.disabled = false;
      });
    return;
  }

  if (e.target.closest(".printed-north-submit")) {
    const btn = e.target.closest(".printed-north-submit");
    const recordId = btn.dataset.recordId;
    const select = viewerBody.querySelector(`.printed-north-select[data-record-id="${recordId}"]`);
    if (!select) return;

    const val = select.value.trim();
    if (val === "") {
      alert("Please select a value for Printed North.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Saving…";
    setError("");

    fetch("/api/printed-north", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: recordId, printedNorth: val }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        btn.textContent = "Saved ✓";
        setTimeout(() => { btn.textContent = "Save"; }, 1500);
        // Refresh data in background
        await load();
      })
      .catch((err) => {
        setError(err?.message || String(err));
        alert("Failed to save Printed North. See error above.");
        btn.textContent = "Save";
      })
      .finally(() => {
        btn.disabled = false;
      });
    return;
  }
}
viewerBackdrop.addEventListener("click", handleOrderSurfaceClick);
orderInspector.addEventListener("click", handleOrderSurfaceClick);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (viewerBackdrop.style.display === "flex") {
    closeViewer();
  } else if (!orderInspector.hidden) {
    closeOrderInspector();
  }
});

function renderTable(rows) {
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="12" class="muted">No records</td></tr>`;
    return;
  }

  const rowHtml = (r, rowClass) => `
    <tr data-id="${r.id}" class="${escapeHtml(rowClass || "")}">
      <td><a href="#" class="pill job-emph job-open">${escapeHtml(r.jobId)}</a></td>
      <td>${escapeHtml(r.clientNameText ?? "")}</td>
      <td>${escapeHtml(r.jobName ?? "")}</td>
      <td>${escapeHtml(r.outsourceNorth ?? "")}</td>
      <td style="max-width:240px;">${mockupsCell(r.mockup)}</td>
      <td>${escapeHtml(displayMethod(r.method))}</td>
      <td>
        <div>
          <div><strong>${escapeHtml(r.cartonIn ?? "")}</strong></div>
          <button class="product-in" type="button"><i class="ph ph-package" aria-hidden="true"></i><span>Product in</span></button>
        </div>
      </td>
      <td class="right">${escapeHtml(r.impressions)}</td>
      <td class="right">${r.meters != null ? escapeHtml(r.meters) : '<span class="muted">—</span>'}</td>
      <td>
        <button class="start" type="button"><i class="ph ph-play" aria-hidden="true"></i><span>Start</span></button>
      </td>
      <td>
        <button class="ready-sent" type="button" data-action="ready"><i class="ph ph-check" aria-hidden="true"></i><span>Ready</span></button>
      </td>
      <td>
        <button class="ready-sent" type="button" data-action="sent"><i class="ph ph-paper-plane-tilt" aria-hidden="true"></i><span>Sent</span></button>
      </td>
    </tr>
  `;

  // Group by Outsource North
  let lastGroup = null;
  const html = rows
    .map((r) => {
      const groupLabel = String(r.outsourceNorth ?? "").trim() || "—";
      const key = statusKey(groupLabel);
      const slug = slugifyGroup(key);
      const groupClass = `group-${slug}`;
      const rowClass = `row-${slug}`;
      const header = groupLabel !== lastGroup
        ? `<tr class="group-row ${groupClass}" data-group="${escapeHtml(key)}"><td colspan="12"><i class="ph ph-caret-down" aria-hidden="true"></i><span>${escapeHtml(groupLabel)}</span></td></tr>`
        : "";
      lastGroup = groupLabel;
      return header + rowHtml(r, rowClass);
    })
    .join("");

  tbody.innerHTML = html;
}

function renderKanban(rows) {
  const columns = columnsForCurrentKanban();
  const groups = new Map();
  for (const column of columns) {
    groups.set(column.key, []);
  }

  for (const row of rows) {
    const column = columnForRow(row);
    if (!column) continue;
    groups.get(column.key).push(row);
  }

  const cardHtml = (row) => `
    <article
      class="kanban-card${row.id === selectedInspectorId ? " selected" : ""}"
      data-id="${escapeHtml(row.id)}"
      draggable="true"
      tabindex="0"
      aria-label="Select order ${escapeHtml(row.jobId)} for details"
    >
      <div class="kanban-card-head">
        <i class="ph ph-dots-six-vertical kanban-drag-handle" title="Drag order" aria-label="Drag order"></i>
        <a href="#" class="pill job-emph job-open">${escapeHtml(row.jobId)}</a>
        ${displayMethod(row.method).trim() ? `<span class="pill">${escapeHtml(displayMethod(row.method))}</span>` : ""}
      </div>
      <div class="kanban-title">${escapeHtml(row.jobName ?? "")}</div>
      <div class="kanban-card-identity">
        <div class="kanban-label">Client</div>
        <div class="kanban-value">${displayCardTextValue(row.clientNameText)}</div>
        <div class="kanban-manager">Manager - ${displayCardTextValue(row.manager)}</div>
        <div class="kanban-material">${displayCardTextValue(displayMaterialOnlyCardValue(row.materialOnlyPress))}</div>
      </div>
      <div class="kanban-cartons">
        ${kanbanCartonEditor({ row, field: "cartonIn", label: "Carton IN", value: row.cartonIn })}
        ${kanbanCartonEditor({ row, field: "cartonsOut", label: "Carton OUT", value: row.cartonsOut, fallbackValue: row.cartonIn })}
      </div>
      <dl class="kanban-meta">
        <dt>Impressions</dt>
        <dd>${escapeHtml(row.impressions ?? "")}</dd>
        <dt>Meters</dt>
        <dd>${row.meters != null ? escapeHtml(row.meters) : '<span class="muted">—</span>'}</dd>
      </dl>
      <div class="kanban-mockups">${kanbanMockupsCell(row.mockup)}</div>
    </article>
  `;

  kanbanEl.innerHTML = columns
    .map((column) => {
      const groupRows = groups.get(column.key) || [];
      const slug = slugifyGroup(column.label);
      const writeAttr = column.writeValue === null || column.writeValue === undefined
        ? ""
        : ` data-kanban-value="${escapeHtml(column.writeValue)}"`;
      return `
        <section class="kanban-column group-${escapeHtml(slug)}" data-kanban-key="${escapeHtml(column.key)}"${writeAttr}>
          <div class="kanban-column-header">
            <span>${escapeHtml(column.label)}</span>
            <span class="pill">${groupRows.length}</span>
          </div>
          <div class="kanban-column-body">
            ${groupRows.length ? groupRows.map(cardHtml).join("") : '<div class="muted">No orders</div>'}
          </div>
        </section>
      `;
    })
    .join("");

  reconcileOrderInspector();
}

function render(rows) {
  if (VIEW_MODES[currentView]?.kanban) {
    renderKanban(rows);
    return;
  }

  renderTable(rows);
}

function applyFilter() {
  const q = searchEl.value.trim();
  if (!q) return render(allRows);
  const filtered = allRows.filter(r => String(r.jobId || "").includes(q));
  render(filtered);
}

function sortListRows(rows) {
  return rows.sort((a, b) => {
    const ka = statusKey(a.outsourceNorth);
    const kb = statusKey(b.outsourceNorth);
    const wa = groupWeightFor(ka);
    const wb = groupWeightFor(kb);
    if (wa !== wb) return wa - wb;

    const ga = normStatus(a.outsourceNorth);
    const gb = normStatus(b.outsourceNorth);
    if (ga !== gb) return ga.localeCompare(gb);

    const na = Number(a.jobId);
    const nb = Number(b.jobId);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.jobId ?? "").localeCompare(String(b.jobId ?? ""));
  });
}

async function load() {
  setError("");
  const viewConfig = VIEW_MODES[currentView] || VIEW_MODES.list;
  setStatus(`Loading ${viewConfig.label}…`);
  try {
    const r = await fetch(viewConfig.endpoint, { cache: "no-store" });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`GET ${viewConfig.endpoint} failed (${r.status})\n${t}`);
    }
    const data = await r.json();
    allRows = VIEW_MODES[currentView]?.kanban ? data : sortListRows(data);
    applyFilter();
    setStatus(`Loaded ${allRows.length} records`);
    if (currentView === "mainFlow") refreshPutMetersBadge();
  } catch (e) {
    setStatus("Error");
    setError(e?.message || String(e));
    if (VIEW_MODES[currentView]?.kanban) {
      kanbanEl.innerHTML = `<div class="muted">Failed to load</div>`;
    } else {
      tbody.innerHTML = `<tr><td colspan="12" class="muted">Failed to load</td></tr>`;
    }
  }
}

function setView(nextView) {
  if (!VIEW_MODES[nextView] || nextView === currentView) return;

  currentView = nextView;
  allRows = [];
  setError("");
  searchEl.value = "";

  const isKanban = Boolean(VIEW_MODES[currentView]?.kanban);
  document.body.dataset.view = currentView;
  jobsTableShell.hidden = isKanban;
  jobsTable.hidden = isKanban;
  kanbanWorkspace.hidden = !isKanban;
  kanbanEl.hidden = !isKanban;
  listLegend.hidden = isKanban;
  mainFlowActions.hidden = currentView !== "mainFlow";
  if (!isKanban) closeOrderInspector();
  tbody.innerHTML = `<tr><td colspan="12" class="muted">Loading…</td></tr>`;
  kanbanEl.innerHTML = "";

  listViewBtn.classList.toggle("active", !isKanban);
  listViewBtn.setAttribute("aria-selected", String(!isKanban));
  mainFlowViewBtn.classList.toggle("active", currentView === "mainFlow");
  mainFlowViewBtn.setAttribute("aria-selected", String(currentView === "mainFlow"));

  load();
}

function rowForTarget(target) {
  const item = target.closest("[data-id]");
  const id = item?.dataset?.id;
  if (!id) return null;
  return allRows.find(r => r.id === id) || null;
}

async function moveKanbanCard(recordId, nextKanbanValue) {
  const row = allRows.find(r => r.id === recordId);
  if (!row) return;

  const viewConfig = VIEW_MODES[currentView] || VIEW_MODES.mainFlow;
  const valueField = viewConfig.valueField || "printerNumber";
  const bodyField = viewConfig.bodyField || valueField;
  const updateEndpoint = viewConfig.updateEndpoint || "/api/printer-number";
  const currentValue = String(row[valueField] ?? "").trim();
  const nextValue = String(nextKanbanValue ?? "").trim();
  const currentColumn = columnForRow(row);
  const nextColumn = columnsForCurrentKanban().find((column) => column.writeValue === nextValue) || null;
  if (currentValue === nextValue || (currentColumn && currentColumn === nextColumn)) return;

  setError("");
  setStatus(`Saving ${VIEW_MODES[currentView]?.label || "kanban"} column…`);
  row[valueField] = nextValue;
  applyFilter();

  try {
    const r = await fetch(updateEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: recordId, [bodyField]: nextValue }),
    });

    if (!r.ok) throw new Error(await r.text());
    const result = await r.json().catch(() => ({}));
    if (result?.outsourceNorth) {
      row.outsourceNorth = result.outsourceNorth;
    }
    if (Object.prototype.hasOwnProperty.call(result, valueField)) {
      row[valueField] = result[valueField];
    }
    await load();
  } catch (err) {
    row[valueField] = currentValue;
    applyFilter();
    setStatus("Error");
    setError(err?.message || String(err));
    alert("Kanban column update failed. See error above.");
  }
}

function clearKanbanDragOver() {
  kanbanEl.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
}

function setKanbanDragOver(column) {
  clearKanbanDragOver();
  if (column) column.classList.add("drag-over");
}

function columnAtPoint(x, y) {
  return document.elementFromPoint(x, y)?.closest?.(".kanban-column") || null;
}

function createPointerDragGhost(card, rect) {
  const ghost = card.cloneNode(true);
  ghost.classList.add("pointer-drag-ghost");
  ghost.style.width = `${rect.width}px`;
  document.body.appendChild(ghost);
  return ghost;
}

function movePointerDragGhost(state, x, y) {
  if (!state.ghost) return;
  state.ghost.style.left = `${x - state.offsetX}px`;
  state.ghost.style.top = `${y - state.offsetY}px`;
}

function scrollKanbanNearEdge(x) {
  const rect = kanbanEl.getBoundingClientRect();
  const edge = 56;
  const step = 24;
  if (x > rect.right - edge) {
    kanbanEl.scrollLeft += step;
  } else if (x < rect.left + edge) {
    kanbanEl.scrollLeft -= step;
  }
}

function cleanupPointerDrag({ shouldMove = false, clientX = 0, clientY = 0 } = {}) {
  const state = pointerDragState;
  if (!state) return;

  pointerDragState = null;
  draggedKanbanId = null;
  state.card.classList.remove("dragging");
  state.ghost?.remove();
  clearKanbanDragOver();

  if (state.active) suppressKanbanSelectionUntil = Date.now() + 350;

  if (!shouldMove || !state.active) return;

  const column = state.overColumn || columnAtPoint(clientX, clientY);
  if (!column) return;
  if (!column.hasAttribute("data-kanban-value")) {
    alert("This column is display-only for dragging.");
    return;
  }

  moveKanbanCard(state.recordId, column.dataset.kanbanValue || "");
}

// Events
function handleJobsClick(e) {
  if (e.target.closest(".kanban-carton-submit")) {
    e.preventDefault();
    e.stopPropagation();

    const btn = e.target.closest(".kanban-carton-submit");
    const recordId = btn.dataset.recordId;
    const field = btn.dataset.cartonField;
    const input = kanbanEl.querySelector(`.kanban-carton-input[data-record-id="${recordId}"][data-carton-field="${field}"]`);
    if (!recordId || !input) return;

    const val = input.value.trim();
    if (val === "" || isNaN(Number(val)) || Number(val) < 0) {
      alert(`Please enter a valid number for ${field === "cartonsOut" ? "Carton OUT" : "Carton IN"}.`);
      return;
    }

    const body = { id: recordId };
    if (field === "cartonsOut") {
      body.cartonsOut = Number(val);
    } else if (field === "cartonIn") {
      body.cartonIn = Number(val);
    } else {
      return;
    }

    btn.disabled = true;
    btn.textContent = "Saving…";
    setError("");
    setStatus(`Saving ${field === "cartonsOut" ? "Carton OUT" : "Carton IN"}…`);

    fetch("/api/order-cartons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        await load();
      })
      .catch((err) => {
        setStatus("Error");
        setError(err?.message || String(err));
        alert(`Failed to save ${field === "cartonsOut" ? "Carton OUT" : "Carton IN"}. See error above.`);
        btn.textContent = "Save";
      })
      .finally(() => {
        btn.disabled = false;
      });
    return;
  }

  if (e.target.closest(".job-open")) {
    e.preventDefault();
    const row = rowForTarget(e.target);
    if (row) openOrderModal(row);
    return;
  }

  if (e.target.closest(".product-in")) {
    const btn = e.target.closest(".product-in");
    const row = rowForTarget(btn);
    const id = row?.id;
    if (!id) return;

    btn.disabled = true;
    setError("");
    fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "Delivered to North" })
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        await load();
      })
      .catch((err) => {
        setError(err?.message || String(err));
        alert("Product in failed. See error above.");
      })
      .finally(() => {
        btn.disabled = false;
      });
    return;
  }

  if (e.target.closest(".start")) {
    const btn = e.target.closest(".start");
    const row = rowForTarget(btn);
    const id = row?.id;
    if (!id) return;

    btn.disabled = true;
    setError("");
    fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "In work North" })
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        await load();
      })
      .catch((err) => {
        setError(err?.message || String(err));
        alert("Start failed. See error above.");
      })
      .finally(() => {
        btn.disabled = false;
      });
    return;
  }

  if (e.target.closest(".ready-sent")) {
    const btn = e.target.closest(".ready-sent");
    const row = rowForTarget(btn);
    const id = row?.id;
    if (!id) return;

    const action = String(btn.dataset.action || "").trim().toLowerCase();
    const status = action === "ready"
      ? "Finished North"
      : action === "sent"
        ? "Arrived to PM"
        : "";

    if (!status) return;

    btn.disabled = true;
    setError("");
    fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        await load();
      })
      .catch((err) => {
        setError(err?.message || String(err));
        alert("Status update failed. See error above.");
      })
      .finally(() => {
        btn.disabled = false;
      });
    return;
  }

  if (e.target.closest(".mockup-view")) {
    e.preventDefault();
    const el = e.target.closest(".mockup-view");
    const row = rowForTarget(e.target);
    openViewer({
      jobId: row?.jobId ?? "",
      jobName: row?.jobName ?? "",
      url: el.dataset.url,
      filename: el.dataset.filename,
      mime: el.dataset.mime,
    });
    return;
  }

  if (e.target.closest(".mockup-download")) {
    e.preventDefault();
    const el = e.target.closest(".mockup-download");
    const url = el.dataset.url;
    const filename = el.dataset.filename || "download";
    if (!url) return;

    // Use same-origin API proxy to force a real download (Content-Disposition: attachment)
    const a = document.createElement("a");
    a.href = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  if (currentView === "mainFlow" && Date.now() >= suppressKanbanSelectionUntil) {
    const card = e.target.closest(".kanban-card");
    const isInteractive = e.target.closest("a, button, input, select, textarea, .kanban-drag-handle");
    if (card && !isInteractive) {
      const row = rowForTarget(card);
      if (row) selectOrderInspector(row);
    }
  }
}
tbody.addEventListener("click", handleJobsClick);
kanbanEl.addEventListener("click", handleJobsClick);
orderInspector.addEventListener("click", handleJobsClick);
orderInspectorClose.addEventListener("click", closeOrderInspector);
kanbanEl.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".kanban-card");
  if (!card || e.target !== card) return;

  e.preventDefault();
  const row = rowForTarget(card);
  if (row) selectOrderInspector(row);
});
kanbanEl.addEventListener("pointerdown", (e) => {
  const handle = e.target.closest(".kanban-drag-handle");
  const card = e.target.closest(".kanban-card");
  if (!handle || !card || e.button !== 0) return;

  const recordId = card.dataset.id || "";
  if (!recordId) return;

  e.preventDefault();
  const rect = card.getBoundingClientRect();
  pointerDragState = {
    pointerId: e.pointerId,
    recordId,
    card,
    startX: e.clientX,
    startY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    active: false,
    ghost: null,
    overColumn: null,
  };
  card.setPointerCapture?.(e.pointerId);
});
kanbanEl.addEventListener("pointermove", (e) => {
  const state = pointerDragState;
  if (!state || state.pointerId !== e.pointerId) return;

  const distance = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
  if (!state.active && distance < 4) return;

  if (!state.active) {
    const rect = state.card.getBoundingClientRect();
    state.active = true;
    state.ghost = createPointerDragGhost(state.card, rect);
    state.card.classList.add("dragging");
    draggedKanbanId = state.recordId;
  }

  e.preventDefault();
  scrollKanbanNearEdge(e.clientX);
  movePointerDragGhost(state, e.clientX, e.clientY);
  state.overColumn = columnAtPoint(e.clientX, e.clientY);
  setKanbanDragOver(state.overColumn);
});
kanbanEl.addEventListener("pointerup", (e) => {
  if (!pointerDragState || pointerDragState.pointerId !== e.pointerId) return;
  e.preventDefault();
  cleanupPointerDrag({ shouldMove: true, clientX: e.clientX, clientY: e.clientY });
});
kanbanEl.addEventListener("pointercancel", () => cleanupPointerDrag());
kanbanEl.addEventListener("dragstart", (e) => {
  if (e.target.closest("input, button, select, textarea")) {
    e.preventDefault();
    return;
  }

  const card = e.target.closest(".kanban-card");
  if (!card) return;

  draggedKanbanId = card.dataset.id || "";
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", draggedKanbanId);
  card.classList.add("dragging");
});
kanbanEl.addEventListener("dragend", (e) => {
  const card = e.target.closest(".kanban-card");
  if (card) card.classList.remove("dragging");
  draggedKanbanId = null;
  suppressKanbanSelectionUntil = Date.now() + 350;
  clearKanbanDragOver();
});
kanbanEl.addEventListener("dragover", (e) => {
  const column = e.target.closest(".kanban-column");
  if (!column || !draggedKanbanId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  column.classList.add("drag-over");
});
kanbanEl.addEventListener("dragleave", (e) => {
  const column = e.target.closest(".kanban-column");
  if (!column || column.contains(e.relatedTarget)) return;
  column.classList.remove("drag-over");
});
kanbanEl.addEventListener("drop", (e) => {
  const column = e.target.closest(".kanban-column");
  if (!column) return;

  e.preventDefault();
  suppressKanbanSelectionUntil = Date.now() + 350;
  column.classList.remove("drag-over");
  const recordId = e.dataTransfer.getData("text/plain") || draggedKanbanId;
  if (!recordId) return;
  if (!column.hasAttribute("data-kanban-value")) {
    alert("This column is display-only for dragging.");
    return;
  }

  moveKanbanCard(recordId, column.dataset.kanbanValue || "");
});
searchEl.addEventListener("input", applyFilter);
refreshBtn.addEventListener("click", load);
listViewBtn.addEventListener("click", () => setView("list"));
mainFlowViewBtn.addEventListener("click", () => setView("mainFlow"));
putMetersBtn.addEventListener("click", openPutMetersModal);

// Init
load();
