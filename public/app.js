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
    tbody.innerHTML = `<tr><td colspan="13" class="muted">No records</td></tr>`;
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
      <td>${escapeHtml(r.jobName ?? "")}</td>
      <td>${escapeHtml(r.outsourceSouth ?? "")}</td>
      <td style="max-width:240px;">${mockupsCell(r.mockup)}</td>
      <td>${escapeHtml(r.method ?? "")}</td>
      <td>
        <div>
          <div><strong>${escapeHtml(r.cartonsIn ?? "")}</strong></div>
          <button class="product-in" type="button">Product in</button>
        </div>
      </td>
      <td class="right">${escapeHtml(r.impressions)}</td>
      <td class="right"><strong>${escapeHtml(r.impr_left ?? "")}</strong></td>
      <td>
        <select class="machine">
          <option value="">—</option>
          <option value="6" ${String(r.rikmaMachine ?? "") === "6" ? "selected" : ""}>6</option>
          <option value="8" ${String(r.rikmaMachine ?? "") === "8" ? "selected" : ""}>8</option>
          <option value="10" ${String(r.rikmaMachine ?? "") === "10" ? "selected" : ""}>10</option>
        </select>
        <button class="start" type="button">Start</button>
      </td>
      <td>
        <input class="qty" type="number" min="1" placeholder="Qty" style="width:80px"/>
        <button class="save">Save</button>
      </td>
      <td>
        <button class="ready-sent" type="button">Ready Sent</button>
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
    tbody.innerHTML = `<tr><td colspan="13" class="muted">Failed to load</td></tr>`;
  }
}

function nowStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function saveDone(rowEl) {
  const id = rowEl.dataset.id;
  const qtyEl = rowEl.querySelector(".qty");
  const btn = rowEl.querySelector(".save");

  const qtyRaw = qtyEl.value;
  const qty = Number(qtyRaw);
  if (qtyRaw === "" || isNaN(qty) || qty <= 0) return alert("Enter a valid Done Qty");

  btn.disabled = true;
  btn.textContent = "Saving…";
  setError("");

  try {
    const r = await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, qty })
    });

    if (!r.ok) {
      const t = await r.text();
      throw new Error(`POST /api/log failed (${r.status})\n${t}`);
    }

    // Optimistic UI update (append log preview)
    const logCell = rowEl.querySelector(".log");
    const stamp = `${nowStamp()} - ${qty}`;
    logCell.innerHTML = (logCell.innerHTML.includes("—") ? "" : logCell.innerHTML + "<br/>") + escapeHtml(stamp);

    qtyEl.value = "";
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

function openCartonsModal(rowEl) {
  const id = rowEl.dataset.id;
  const jobId = rowEl.querySelector(".pill")?.textContent?.trim() || "";
  const jobName = rowEl.children?.[2]?.textContent?.trim() || "";
  const currentCartons = rowEl.querySelector("td:nth-child(7) strong")?.textContent?.trim() || "";

  viewerTitle.textContent = `${jobId}${jobName ? ` — ${jobName}` : ""}`.trim() || "Product in";
  viewerBody.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
      <label>
        Cartons IN -
        <input id="cartonsInput" type="number" min="0" step="1" value="${escapeHtml(currentCartons)}" style="width:180px;" />
      </label>
      <button id="cartonsSave" type="button">Save</button>
    </div>
    <div class="muted" style="margin-top:10px;">Saves cartons and sets Outsource South to Delivered to South.</div>
  `;

  viewerBackdrop.style.display = "flex";
  viewerBackdrop.setAttribute("aria-hidden", "false");

  const saveBtn = document.getElementById("cartonsSave");
  saveBtn.addEventListener("click", async () => {
    const input = document.getElementById("cartonsInput");
    const cartonsRaw = input.value;
    const cartons = Number(cartonsRaw);
    if (cartonsRaw === "" || isNaN(cartons) || cartons < 0) return alert("Enter valid Cartons IN -");

    saveBtn.disabled = true;
    setError("");
    try {
      const r = await fetch("/api/cartons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, cartons })
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`POST /api/cartons failed (${r.status})\n${t}`);
      }
      closeViewer();
      await load();
    } catch (e) {
      setError(e?.message || String(e));
      alert("Save failed. See error above.");
    } finally {
      saveBtn.disabled = false;
    }
  }, { once: true });
}

// Events
tbody.addEventListener("click", (e) => {
  if (e.target.classList.contains("product-in")) {
    const tr = e.target.closest("tr");
    openCartonsModal(tr);
    return;
  }

  if (e.target.classList.contains("start")) {
    const tr = e.target.closest("tr");
    const id = tr.dataset.id;
    const machine = Number(tr.querySelector(".machine")?.value);
    if (![6, 8, 10].includes(machine)) return alert("Select machine (6 / 8 / 10)");

    e.target.disabled = true;
    setError("");
    fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, machine })
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
      body: JSON.stringify({ id, status: "Arrived to PM" })
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

  if (e.target.classList.contains("save")) {
    const tr = e.target.closest("tr");
    saveDone(tr);
  }
});
searchEl.addEventListener("input", applyFilter);
refreshBtn.addEventListener("click", load);

// Init
load();