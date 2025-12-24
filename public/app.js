const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");
const errEl = document.getElementById("error");
const searchEl = document.getElementById("search");
const refreshBtn = document.getElementById("refreshBtn");

const viewerBackdrop = document.getElementById("viewerBackdrop");
const viewerTitle = document.getElementById("viewerTitle");
const viewerBody = document.getElementById("viewerBody");
const viewerClose = document.getElementById("viewerClose");

let allRows = [];

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
];

const GROUP_ORDER = [
  "outsource north",
  "prepared to send north",
  "delivered north",
  "in work north",
  "finished north",
  "arrived to pm north",
];
const GROUP_WEIGHT = new Map(GROUP_ORDER.map((k, i) => [k, i]));

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
        a?.thumbnails?.small?.url ||
        a?.thumbnails?.large?.url ||
        a?.thumbnails?.full?.url ||
        null;

      const preview = thumb
        ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(filename)}" style="width:56px;height:auto;border:1px solid #ddd;vertical-align:middle;"/>`
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

function openOrderModal(row) {
  const jobId = row?.jobId ?? "";
  const jobName = row?.jobName ?? "";
  const title = `${jobId}${jobName ? ` — ${jobName}` : ""}`.trim();
  viewerTitle.textContent = title || "Order";

  const order = row?.order && typeof row.order === "object" ? row.order : {};
  const lines = ORDER_FIELD_ORDER.map((fieldName) => {
    const v = order[fieldName];
    let rendered;

    if (fieldName === "Method") {
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
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && viewerBackdrop.style.display === "flex") closeViewer();
});

function render(rows) {
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="muted">No records</td></tr>`;
    return;
  }

  const mockupsCell = (mockups) => {
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
  };

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
      <td>
        <button class="start" type="button">Start</button>
      </td>
      <td>
        <button class="ready-sent" type="button">Ready Sent</button>
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
        ? `<tr class="group-row ${groupClass}" data-group="${escapeHtml(key)}"><td colspan="10">${escapeHtml(groupLabel)}</td></tr>`
        : "";
      lastGroup = groupLabel;
      return header + rowHtml(r, rowClass);
    })
    .join("");

  tbody.innerHTML = html;
}

function applyFilter() {
  const q = searchEl.value.trim();
  if (!q) return render(allRows);
  const filtered = allRows.filter(r => String(r.jobId || "").includes(q));
  render(filtered);
}

async function load() {
  setError("");
  setStatus("Loading…");
  try {
    const r = await fetch("/api/jobs", { cache: "no-store" });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`GET /api/jobs failed (${r.status})\n${t}`);
    }
    const data = await r.json();
    allRows = data.sort((a, b) => {
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
    applyFilter();
    setStatus(`Loaded ${allRows.length} records`);
  } catch (e) {
    setStatus("Error");
    setError(e?.message || String(e));
    tbody.innerHTML = `<tr><td colspan="10" class="muted">Failed to load</td></tr>`;
  }
}

// Events
tbody.addEventListener("click", (e) => {
  if (e.target.closest(".job-open")) {
    e.preventDefault();
    const tr = e.target.closest("tr");
    const id = tr?.dataset?.id;
    const row = allRows.find(r => r.id === id);
    if (row) openOrderModal(row);
    return;
  }

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

  if (e.target.classList.contains("product-in")) {
    const tr = e.target.closest("tr");
    const id = tr.dataset.id;

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
    const tr = e.target.closest("tr");
    const id = tr.dataset.id;
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
    const tr = e.target.closest("tr");
    const id = tr.dataset.id;
    e.target.disabled = true;
    setError("");
    fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "Arrived to PM North" })
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        await load();
      })
      .catch((err) => {
        setError(err?.message || String(err));
        alert("Ready Sent failed. See error above.");
      })
      .finally(() => {
        e.target.disabled = false;
      });
    return;
  }

  if (e.target.closest(".mockup-view")) {
    e.preventDefault();
    const el = e.target.closest(".mockup-view");
    const tr = el.closest("tr");
    const jobId = tr?.querySelector(".pill")?.textContent?.trim() || "";
    const jobName = tr?.children?.[2]?.textContent?.trim() || "";
    openViewer({
      jobId,
      jobName,
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

  
});
searchEl.addEventListener("input", applyFilter);
refreshBtn.addEventListener("click", load);

// Init
load();