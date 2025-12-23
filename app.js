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

function render(rows) {
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No records</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((r) => {
      const log = (r.impr_log || "").trim();
      const logPreview = log ? escapeHtml(log).replaceAll("\n", "<br/>") : `<span class="muted">—</span>`;
      return `
        <tr>
          <td><span class="pill">${escapeHtml(r.jobId)}</span></td>
          <td class="right">${escapeHtml(r.impressions)}</td>
          <td class="right">${escapeHtml(r.impr_left ?? "")}</td>
          <td>${escapeHtml(r.rikmaMachine ?? "")}</td>
          <td class="muted">Step 2 (editable)</td>
          <td style="max-width:520px;">${logPreview}</td>
        </tr>
      `;
    })
    .join("");
}

function applyFilter() {
  const q = searchEl.value.trim();
  if (!q) return render(allRows);
  const filtered = allRows.filter((r) => String(r.jobId || "").includes(q));
  render(filtered);
}

async function load() {
  setError("");
  setStatus("Loading…");

  try {
    const r = await fetch("/api/jobs", { cache: "no-store" });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`GET /api/jobs failed (${r.status})\n${text}`);
    }

    const data = await r.json();

    // Sort by jobId numeric-ish
    allRows = data.sort((a, b) => Number(a.jobId) - Number(b.jobId));
    applyFilter();

    setStatus(`Loaded ${allRows.length} records`);
  } catch (e) {
    setStatus("Error");
    setError(e?.message || String(e));
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load</td></tr>`;
  }
}

searchEl.addEventListener("input", applyFilter);
refreshBtn.addEventListener("click", load);

load();