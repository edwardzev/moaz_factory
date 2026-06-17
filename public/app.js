const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");
const errEl = document.getElementById("error");
const searchEl = document.getElementById("search");
const refreshBtn = document.getElementById("refreshBtn");
const jobsTable = document.getElementById("jobsTable");
const kanbanEl = document.getElementById("kanban");
const listViewBtn = document.getElementById("listViewBtn");
const kanbanViewBtn = document.getElementById("kanbanViewBtn");

const viewerBackdrop = document.getElementById("viewerBackdrop");
const viewerTitle = document.getElementById("viewerTitle");
const viewerBody = document.getElementById("viewerBody");
const viewerClose = document.getElementById("viewerClose");

let allRows = [];
let currentView = "list";

const VIEW_MODES = {
  list: {
    label: "Full list",
    endpoint: "/api/jobs",
  },
  kanban: {
    label: "Priority kanban",
    endpoint: "/api/jobs?view=priority",
  },
};

// Fields shown in the Job-ID popup (order matters; names must match Airtable exactly)
const ORDER_FIELD_ORDER = [
  "Impressions",
  "Client name text",
  "Job Name",
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
  "Manager Field",
  "Carton IN",
  "# of packages",
  "Printed North",
  "Meters",
];

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
  { value: "", label: "Incoming" },
  { value: "PRT ready", label: "PRT ready" },
  { value: "Unclear", label: "Unclear" },
  { value: "Big mama", label: "Big DTF" },
  { value: "Sublimation", label: "Sublimation" },
  { value: "UV DTF", label: "UV DTF" },
  { value: "Printed material north", label: "Printed material north" },
  { value: "Press Started", label: "Press Started" },
  { value: "Press Finished", label: "Press Finished" },
];
const PRIORITY_VALUES = new Set(PRIORITY_COLUMNS.map((column) => column.value));

let draggedKanbanId = null;

function displayMethod(method) {
  const m = String(method ?? "").trim().toLowerCase();
  if (m === "press" || m === "cutting to pieces") return "";
  return String(method ?? "");
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

function attachmentsList(items, { jobId, jobName }) {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return `<span class="muted">—</span>`;

  return arr
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
        ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(filename)}" style="width:168px;height:auto;border:1px solid #ddd;vertical-align:middle;"/>`
        : `<span class="pill">${escapeHtml(filename)}</span>`;

      return `
        <div style="display:inline-block;margin-right:10px;margin-bottom:10px;vertical-align:top;">
          <a href="#" class="order-attach-view" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}" data-mime="${escapeHtml(mime)}" data-jobid="${escapeHtml(jobId ?? "")}" data-jobname="${escapeHtml(jobName ?? "")}" title="View ${escapeHtml(filename)}" style="text-decoration:none;">
            ${preview}
          </a>
          <div style="margin-top:4px;">
            <a href="#" class="order-attach-view muted" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}" data-mime="${escapeHtml(mime)}" data-jobid="${escapeHtml(jobId ?? "")}" data-jobname="${escapeHtml(jobName ?? "")}" style="text-decoration:underline;">view</a>
            <span class="muted"> · </span>
            <a href="#" class="order-attach-download muted" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}" style="text-decoration:underline;">download</a>
          </div>
        </div>
      `;
    })
    .join("");
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
        ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(filename)}" style="width:56px;height:auto;border:1px solid #ddd;"/>`
        : `<span class="pill">${escapeHtml(filename)}</span>`;

      return `
        <div style="display:inline-block;margin-right:8px;margin-bottom:6px;vertical-align:top;">
          <button
            type="button"
            class="mockup-view"
            data-url="${escapeHtml(url)}"
            data-filename="${escapeHtml(filename)}"
            data-mime="${escapeHtml(mime)}"
            title="View ${escapeHtml(filename)}"
            style="border:0;background:transparent;padding:0;cursor:pointer;"
          >
            ${img}
          </button>
          <div style="margin-top:4px;">
            <a href="#" class="mockup-view muted" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}" data-mime="${escapeHtml(mime)}" style="text-decoration:underline;">view</a>
            <span class="muted"> · </span>
            <a href="#" class="mockup-download muted" data-url="${escapeHtml(url)}" data-filename="${escapeHtml(filename)}" style="text-decoration:underline;">download</a>
          </div>
        </div>
      `;
    })
    .join("");
}

function openOrderModal(row) {
  const jobId = row?.jobId ?? "";
  const jobName = row?.jobName ?? "";
  const title = `${jobId}${jobName ? ` — ${jobName}` : ""}`.trim();
  viewerTitle.textContent = title || "Order";

  const order = row?.order && typeof row.order === "object" ? row.order : {};
  const lines = ORDER_FIELD_ORDER.map((fieldName) => {
    const v = order[fieldName];
    let rendered;

    if (fieldName === "Meters") {
      // Editable number input with submit button
      const current = v != null ? escapeHtml(String(v)) : "";
      rendered = `
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="number" class="meters-input" data-record-id="${escapeHtml(row.id)}" value="${current}" step="any" style="width:120px;padding:8px 10px;font-size:1em;border:1px solid var(--border);border-radius:var(--radiusSm);background:var(--surface);color:var(--text);" />
          <button type="button" class="meters-submit" data-record-id="${escapeHtml(row.id)}" style="padding:8px 14px;font-size:0.9em;">Save</button>
        </div>`;
    } else if (fieldName === "Printed North") {
      // Editable single-select with submit button
      const current = v != null ? escapeHtml(String(v)) : "";
      const options = ["Printed North DTF", "Printed North Sublim...", "Printed North UVDTF"];
      const optionsHtml = options.map(opt => {
        const selected = current === opt ? "selected" : "";
        return `<option value="${escapeHtml(opt)}" ${selected}>${escapeHtml(opt)}</option>`;
      }).join("");
      rendered = `
        <div style="display:flex;align-items:center;gap:8px;">
          <select class="printed-north-select" data-record-id="${escapeHtml(row.id)}" style="width:180px;padding:8px 10px;font-size:1em;border:1px solid var(--border);border-radius:var(--radiusSm);background:var(--surface);color:var(--text);">
            <option value="">-- Select --</option>
            ${optionsHtml}
          </select>
          <button type="button" class="printed-north-submit" data-record-id="${escapeHtml(row.id)}" style="padding:8px 14px;font-size:0.9em;">Save</button>
        </div>`;
    } else if (fieldName === "Method") {
      const m = displayMethod(v);
      rendered = m.trim() ? escapeHtml(m) : `<span class="muted">—</span>`;
    } else if (isAirtableAttachmentArray(v)) {
      rendered = attachmentsList(v, { jobId, jobName });
    } else if (Array.isArray(v)) {
      rendered = v.length ? escapeHtml(v.join(", ")) : `<span class="muted">—</span>`;
    } else {
      rendered = fmtScalar(v);
    }

    return `
      <tr>
        <td style="width:260px;"><strong>${escapeHtml(fieldName)}</strong></td>
        <td>${rendered}</td>
      </tr>
    `;
  }).join("");

  viewerBody.innerHTML = `
    <div style="overflow:auto;max-height:65vh;font-size:0.7em;">
      <table style="width:100%;border-collapse:separate;border-spacing:0;">
        <tbody>${lines}</tbody>
      </table>
    </div>
  `;

  viewerBackdrop.style.display = "flex";
  viewerBackdrop.setAttribute("aria-hidden", "false");
}

function closeViewer() {
  viewerBackdrop.style.display = "none";
  viewerBackdrop.setAttribute("aria-hidden", "true");
  viewerBody.innerHTML = "";
}

viewerClose.addEventListener("click", closeViewer);
viewerBackdrop.addEventListener("click", (e) => {
  if (e.target === viewerBackdrop) closeViewer();

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
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && viewerBackdrop.style.display === "flex") closeViewer();
});

function renderTable(rows) {
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="12" class="muted">No records</td></tr>`;
    return;
  }

  const rowHtml = (r, rowClass) => `
    <tr data-id="${r.id}" class="${escapeHtml(rowClass || "")}">
      <td><a href="#" class="pill job-emph job-open" style="text-decoration:none;">${escapeHtml(r.jobId)}</a></td>
      <td>${escapeHtml(r.clientNameText ?? "")}</td>
      <td>${escapeHtml(r.jobName ?? "")}</td>
      <td>${escapeHtml(r.outsourceNorth ?? "")}</td>
      <td style="max-width:240px;">${mockupsCell(r.mockup)}</td>
      <td>${escapeHtml(displayMethod(r.method))}</td>
      <td>
        <div>
          <div><strong>${escapeHtml(r.cartonIn ?? "")}</strong></div>
          <button class="product-in" type="button">Product in</button>
        </div>
      </td>
      <td class="right">${escapeHtml(r.impressions)}</td>
      <td class="right">${r.meters != null ? escapeHtml(r.meters) : '<span class="muted">—</span>'}</td>
      <td>
        <button class="start" type="button">Start</button>
      </td>
      <td>
        <button class="ready-sent" type="button" data-action="ready">Ready</button>
      </td>
      <td>
        <button class="ready-sent" type="button" data-action="sent">Sent</button>
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
        ? `<tr class="group-row ${groupClass}" data-group="${escapeHtml(key)}"><td colspan="12">${escapeHtml(groupLabel)}</td></tr>`
        : "";
      lastGroup = groupLabel;
      return header + rowHtml(r, rowClass);
    })
    .join("");

  tbody.innerHTML = html;
}

function renderKanban(rows) {
  const groups = new Map();
  for (const column of PRIORITY_COLUMNS) {
    groups.set(column.value, []);
  }

  for (const row of rows) {
    const value = String(row.printerNumber ?? "").trim();
    if (!PRIORITY_VALUES.has(value)) continue;
    groups.get(value).push(row);
  }

  const cardHtml = (row) => `
    <article class="kanban-card" data-id="${escapeHtml(row.id)}" draggable="true">
      <div class="kanban-card-head">
        <a href="#" class="pill job-emph job-open" style="text-decoration:none;">${escapeHtml(row.jobId)}</a>
        ${displayMethod(row.method).trim() ? `<span class="pill">${escapeHtml(displayMethod(row.method))}</span>` : ""}
      </div>
      <div class="kanban-title">${escapeHtml(row.jobName ?? "")}</div>
      <dl class="kanban-meta">
        <dt>Client</dt>
        <dd>${escapeHtml(row.clientNameText ?? "")}</dd>
        <dt>Carton IN</dt>
        <dd>${escapeHtml(row.cartonIn ?? "")}</dd>
        <dt>Impressions</dt>
        <dd>${escapeHtml(row.impressions ?? "")}</dd>
        <dt>Meters</dt>
        <dd>${row.meters != null ? escapeHtml(row.meters) : '<span class="muted">—</span>'}</dd>
      </dl>
      <div class="kanban-mockups">${mockupsCell(row.mockup)}</div>
      <div class="kanban-actions">
        <button class="product-in" type="button">Product in</button>
        <button class="start" type="button">Start</button>
        <button class="ready-sent" type="button" data-action="ready">Ready</button>
        <button class="ready-sent" type="button" data-action="sent">Sent</button>
      </div>
    </article>
  `;

  kanbanEl.innerHTML = PRIORITY_COLUMNS
    .map((column) => {
      const groupRows = groups.get(column.value) || [];
      const slug = slugifyGroup(column.label);
      return `
        <section class="kanban-column group-${escapeHtml(slug)}" data-printer-value="${escapeHtml(column.value)}">
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
}

function render(rows) {
  if (currentView === "kanban") {
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
    allRows = currentView === "kanban" ? data : sortListRows(data);
    applyFilter();
    setStatus(`Loaded ${allRows.length} records`);
  } catch (e) {
    setStatus("Error");
    setError(e?.message || String(e));
    if (currentView === "kanban") {
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

  const isKanban = currentView === "kanban";
  jobsTable.hidden = isKanban;
  kanbanEl.hidden = !isKanban;
  tbody.innerHTML = `<tr><td colspan="12" class="muted">Loading…</td></tr>`;
  kanbanEl.innerHTML = "";

  listViewBtn.classList.toggle("active", !isKanban);
  listViewBtn.setAttribute("aria-selected", String(!isKanban));
  kanbanViewBtn.classList.toggle("active", isKanban);
  kanbanViewBtn.setAttribute("aria-selected", String(isKanban));

  load();
}

function rowForTarget(target) {
  const item = target.closest("[data-id]");
  const id = item?.dataset?.id;
  if (!id) return null;
  return allRows.find(r => r.id === id) || null;
}

async function moveKanbanCard(recordId, printerNumber) {
  const row = allRows.find(r => r.id === recordId);
  if (!row) return;

  const currentValue = String(row.printerNumber ?? "").trim();
  const nextValue = String(printerNumber ?? "").trim();
  if (currentValue === nextValue) return;

  setError("");
  setStatus("Saving Priority column…");
  row.printerNumber = nextValue;
  applyFilter();

  try {
    const r = await fetch("/api/printer-number", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: recordId, printerNumber: nextValue }),
    });

    if (!r.ok) throw new Error(await r.text());
    await load();
  } catch (err) {
    row.printerNumber = currentValue;
    applyFilter();
    setStatus("Error");
    setError(err?.message || String(err));
    alert("Priority column update failed. See error above.");
  }
}

// Events
function handleJobsClick(e) {
  if (e.target.closest(".job-open")) {
    e.preventDefault();
    const row = rowForTarget(e.target);
    if (row) openOrderModal(row);
    return;
  }

  if (e.target.classList.contains("product-in")) {
    const row = rowForTarget(e.target);
    const id = row?.id;
    if (!id) return;

    e.target.disabled = true;
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
        e.target.disabled = false;
      });
    return;
  }

  if (e.target.classList.contains("start")) {
    const row = rowForTarget(e.target);
    const id = row?.id;
    if (!id) return;

    e.target.disabled = true;
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
        e.target.disabled = false;
      });
    return;
  }

  if (e.target.classList.contains("ready-sent")) {
    const row = rowForTarget(e.target);
    const id = row?.id;
    if (!id) return;

    const action = String(e.target.dataset.action || "").trim().toLowerCase();
    const status = action === "ready"
      ? "Finished North"
      : action === "sent"
        ? "Arrived to PM"
        : "";

    if (!status) return;

    e.target.disabled = true;
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
        e.target.disabled = false;
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

  
}
tbody.addEventListener("click", handleJobsClick);
kanbanEl.addEventListener("click", handleJobsClick);
kanbanEl.addEventListener("dragstart", (e) => {
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
  kanbanEl.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
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
  column.classList.remove("drag-over");
  const recordId = e.dataTransfer.getData("text/plain") || draggedKanbanId;
  if (!recordId) return;

  moveKanbanCard(recordId, column.dataset.printerValue || "");
});
searchEl.addEventListener("input", applyFilter);
refreshBtn.addEventListener("click", load);
listViewBtn.addEventListener("click", () => setView("list"));
kanbanViewBtn.addEventListener("click", () => setView("kanban"));

// Init
load();
