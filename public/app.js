const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");
const errEl = document.getElementById("error");
const searchEl = document.getElementById("search");
const refreshBtn = document.getElementById("refreshBtn");

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

function render(rows) {
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="muted">No records</td></tr>`;
    return;
  }

  const mockupsCell = (mockups) => {
    const items = Array.isArray(mockups) ? mockups : [];
    if (!items.length) return `<span class="muted">—</span>`;

    return items
      .map((a) => {
        const url = a?.url;
        const filename = a?.filename || "file";
        if (!url) return "";

        const thumb =
          a?.thumbnails?.small?.url ||
          a?.thumbnails?.large?.url ||
          a?.thumbnails?.full?.url ||
          null;

        const img = thumb
          ? `<img src="${escapeHtml(thumb)}" alt="${escapeHtml(filename)}" style="width:56px;height:auto;border:1px solid #ddd;"/>`
          : `<span class="pill">${escapeHtml(filename)}</span>`;

        // View opens in a new tab. Download uses `download` attr (may be ignored by some browsers for cross-origin).
        return `
          <div style="display:inline-block;margin-right:8px;margin-bottom:6px;vertical-align:top;">
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="View ${escapeHtml(filename)}">
              ${img}
            </a>
            <div style="margin-top:4px;">
              <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="muted" style="text-decoration:underline;">view</a>
              <span class="muted"> · </span>
              <a href="${escapeHtml(url)}" download class="muted" style="text-decoration:underline;">download</a>
            </div>
          </div>
        `;
      })
      .join("");
  };

  tbody.innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td><span class="pill">${escapeHtml(r.jobId)}</span></td>
      <td>${escapeHtml(r.clientName ?? "")}</td>
      <td>${escapeHtml(r.jobName ?? "")}</td>
      <td style="max-width:240px;">${mockupsCell(r.mockup)}</td>
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
    tbody.innerHTML = `<tr><td colspan="9" class="muted">Failed to load</td></tr>`;
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

  const qty = Number(qtyEl.value);
  const machine = Number(machineEl.value);

  if (!qty || qty <= 0) return alert("Enter a valid Done Qty");
  if (![6,8,10].includes(machine)) return alert("Select machine (6 / 8 / 10)");

  btn.disabled = true;
  btn.textContent = "Saving…";
  setError("");

  try {
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

    setStatus("Saved");
    // Reload data to sync Impr_left
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
  if (e.target.classList.contains("save")) {
    const tr = e.target.closest("tr");
    onSave(tr);
  }
});
searchEl.addEventListener("input", applyFilter);
refreshBtn.addEventListener("click", load);

// Init
load();