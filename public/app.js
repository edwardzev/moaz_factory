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
    tbody.innerHTML = `<tr><td colspan="12" class="muted">No records</td></tr>`;
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

  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td><span class="pill job-emph">${escapeHtml(r.jobId)}</span></td>
      <td>${escapeHtml(r.clientNameText ?? "")}</td>
      <td class="job-emph">${escapeHtml(r.jobName ?? "")}</td>
      <td>${escapeHtml(r.outsourceSouth ?? "")}</td>
      <td style="max-width:240px;">${mockupsCell(r.mockup)}</td>
      <td>${escapeHtml(r.method ?? "")}</td>
      <td>
        <input class="cartons" type="number" min="0" step="1" placeholder="0" style="width:120px" value="${escapeHtml(r.cartonsIn ?? "")}"/>
      </td>
      <td class="right">${escapeHtml(r.impressions)}</td>
      <td class="right"><strong>${escapeHtml(r.impr_left ?? "")}</strong></td>
      <td>
        <select class="machine">
          <option value="">—</option>
          <option value="6">6</option>
          <option value="8">8</option>
          <option value="10">10</option>
        </select>
      </td>
      <td>
        <input class="qty" type="number" min="1" placeholder="Qty" style="width:80px"/>
        <button class="save">Save</button>
      </td>
      <td class="log" style="max-width:520px;">
        ${fmtLogPreview(r.impr_log)}
      </td>
    </tr>
  `).join("");
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
    allRows = data.sort((a, b) => Number(a.jobId) - Number(b.jobId));
    applyFilter();
    setStatus(`Loaded ${allRows.length} records`);
  } catch (e) {
    setStatus("Error");
    setError(e?.message || String(e));
    tbody.innerHTML = `<tr><td colspan="12" class="muted">Failed to load</td></tr>`;
  }
}

function nowStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function onSave(rowEl) {
  const id = rowEl.dataset.id;
  const qtyEl = rowEl.querySelector(".qty");
  const machineEl = rowEl.querySelector(".machine");
  const btn = rowEl.querySelector(".save");
  const cartonsEl = rowEl.querySelector(".cartons");

  const qtyRaw = qtyEl.value;
  const qty = Number(qtyRaw);
  const machine = Number(machineEl.value);

  const cartonsRaw = cartonsEl?.value;
  const cartons = cartonsRaw === "" ? null : Number(cartonsRaw);

  const hasQty = qtyRaw !== "" && !isNaN(qty) && qty > 0;
  const hasCartons = cartonsRaw !== "" && cartons !== null && !isNaN(cartons) && cartons >= 0;

  if (!hasQty && !hasCartons) {
    return alert("Enter Done Qty and/or Cartons IN -");
  }
  if (hasQty && ![6, 8, 10].includes(machine)) {
    return alert("Select machine (6 / 8 / 10)");
  }

  btn.disabled = true;
  btn.textContent = "Saving…";
  setError("");

  try {
    if (hasCartons) {
      const rCartons = await fetch("/api/cartons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, cartons })
      });

      if (!rCartons.ok) {
        const t = await rCartons.text();
        throw new Error(`POST /api/cartons failed (${rCartons.status})\n${t}`);
      }
    }

    if (hasQty) {
      const r = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, qty, machine })
      });

      if (!r.ok) {
        const t = await r.text();
        throw new Error(`POST /api/log failed (${r.status})\n${t}`);
      }

      // Optimistic UI update (append log preview)
      const logCell = rowEl.querySelector(".log");
      const stamp = `${nowStamp()} - ${qty} - ${machine}`;
      logCell.innerHTML = (logCell.innerHTML.includes("—") ? "" : logCell.innerHTML + "<br/>") + escapeHtml(stamp);

      // Clear inputs
      qtyEl.value = "";
      machineEl.value = "";
    }

    setStatus("Saved");
    await load();
  } catch (e) {
    setError(e?.message || String(e));
    alert("Save failed. See error above.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save";
  }
}

// Events
tbody.addEventListener("click", (e) => {
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

  if (e.target.classList.contains("save")) {
    const tr = e.target.closest("tr");
    onSave(tr);
  }
});
searchEl.addEventListener("input", applyFilter);
refreshBtn.addEventListener("click", load);

// Init
load();