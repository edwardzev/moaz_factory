const pageTitle = document.getElementById("pageTitle");
const printStatus = document.getElementById("printStatus");
const printButton = document.getElementById("printButton");
const closeButton = document.getElementById("closeButton");
const errorPanel = document.getElementById("errorPanel");
const labelSheet = document.getElementById("labelSheet");
const methodEl = document.getElementById("method");
const jobIdEl = document.getElementById("jobId");
const clientNameEl = document.getElementById("clientName");
const jobNameEl = document.getElementById("jobName");
const cutOrderEl = document.getElementById("cutOrder");
const graphicSlotsEl = document.getElementById("graphicSlots");

const SOURCE_ENDPOINTS = {
  list: "/api/jobs",
  mainFlow: "/api/jobs?view=main-flow",
  putMeters: "/api/put-meters-list",
};

const GRAPHIC_FIELDS = [
  { graphic: "Graphic 1", width: "Width 1 cm", number: "Number 1" },
  { graphic: "Graphic 2", width: "Width 2 cm", number: "Number 2" },
  { graphic: "Graphic 3", width: "Width 3", number: "Number 3" },
  { graphic: "Graphic 4", width: "Width 4", number: "Number 4" },
  { graphic: "Graphic 5", width: "Width 5", number: "Number 5" },
];

let readyToPrint = false;

function scalarText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.filter(item => item !== null && item !== undefined && item !== "").join(", ");
  return String(value);
}

function literalValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function setText(element, value) {
  element.textContent = scalarText(value);
}

function fitExactText(element, minimumFontSize) {
  element.style.removeProperty("font-size");
  let fontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);

  while (
    fontSize > minimumFontSize &&
    (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
  ) {
    fontSize -= 1;
    element.style.fontSize = `${fontSize}px`;
  }

  return element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1;
}

function fail(message) {
  readyToPrint = false;
  labelSheet.hidden = true;
  errorPanel.textContent = message;
  errorPanel.hidden = false;
  printButton.disabled = true;
  printStatus.textContent = "Printing unavailable";
}

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (payload?.row && typeof payload.row === "object") return [payload.row];
  return [];
}

function endpointForSource(source, jobId) {
  if (source === "global") {
    if (!/^[1-9]\d*$/.test(jobId) || jobId.length > 32) return "";
    return `/api/global-search?jobId=${encodeURIComponent(jobId)}`;
  }
  return SOURCE_ENDPOINTS[source] || "";
}

function renderGraphicSlot(definition, index, order) {
  const attachments = Array.isArray(order[definition.graphic]) ? order[definition.graphic] : [];
  const width = order[definition.width];
  const number = order[definition.number];
  const hasWidth = width !== null && width !== undefined && width !== "";
  const hasNumber = number !== null && number !== undefined && number !== "";

  if (attachments.length > 1) {
    throw new Error(`${definition.graphic} contains ${attachments.length} attachments. Printing is blocked because the label requires one exact graphic per field.`);
  }
  if (!attachments.length && !hasWidth && !hasNumber) return null;

  const slot = document.createElement("section");
  slot.className = "graphic-slot";
  slot.dataset.index = String(index + 1);
  slot.setAttribute("aria-label", definition.graphic);

  const imageFrame = document.createElement("div");
  imageFrame.className = "graphic-image-frame";
  const attachment = attachments[0] || null;
  let image = null;

  if (attachment) {
    const type = String(attachment.type || "");
    const originalUrl = String(attachment.url || "");
    const thumbnailUrl = String(
      attachment.thumbnails?.full?.url ||
      attachment.thumbnails?.large?.url ||
      attachment.thumbnails?.small?.url ||
      ""
    );
    const imageUrl = type.startsWith("image/") ? originalUrl : thumbnailUrl;
    if (!imageUrl) {
      throw new Error(`${definition.graphic} cannot be rendered as an image. Printing is blocked to avoid an incomplete sticker.`);
    }

    image = document.createElement("img");
    image.src = imageUrl;
    image.alt = attachment.filename ? `${definition.graphic}: ${attachment.filename}` : definition.graphic;
    imageFrame.appendChild(image);
  }

  const values = document.createElement("div");
  values.className = "graphic-values";
  const widthEl = document.createElement("span");
  const numberEl = document.createElement("span");
  widthEl.textContent = literalValue(width);
  numberEl.textContent = literalValue(number);
  values.append(widthEl, numberEl);
  slot.append(imageFrame, values);

  return { slot, image };
}

function waitForImage(image) {
  if (!image) return Promise.resolve();
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error(`${image.alt} failed to load.`));
  }

  return new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", () => reject(new Error(`${image.alt} failed to load.`)), { once: true });
  });
}

async function renderLabel(row) {
  const order = row?.order && typeof row.order === "object" ? row.order : {};
  const jobId = literalValue(row?.jobId);
  const clientName = scalarText(row?.clientNameText || order["Client name text"]);
  const jobName = scalarText(row?.jobName || order["Job Name"]);

  setText(methodEl, row?.method || order.Method);
  setText(jobIdEl, jobId);
  setText(clientNameEl, clientName);
  setText(jobNameEl, jobName);
  cutOrderEl.textContent = order["Cut order"] === true ? "✓" : "";
  cutOrderEl.setAttribute("aria-label", order["Cut order"] === true ? "Cut order: yes" : "Cut order: no");

  graphicSlotsEl.replaceChildren();

  const images = [];
  for (const [index, definition] of GRAPHIC_FIELDS.entries()) {
    const rendered = renderGraphicSlot(definition, index, order);
    if (!rendered) continue;
    graphicSlotsEl.appendChild(rendered.slot);
    if (rendered.image) images.push(rendered.image);
  }

  pageTitle.textContent = jobId ? `Sticker label - ${jobId}` : "Sticker label";
  document.title = jobId ? `${jobId} sticker - Moaz Factory` : "Sticker label - Moaz Factory";
  labelSheet.hidden = false;
  errorPanel.hidden = true;
  printStatus.textContent = images.length ? "Loading graphics..." : "Ready to print";

  await new Promise(resolve => window.requestAnimationFrame(resolve));
  const textFits = [
    { element: methodEl, minimumFontSize: 9, fieldName: "Method" },
    { element: clientNameEl, minimumFontSize: 12, fieldName: "Client name text" },
    { element: jobNameEl, minimumFontSize: 10, fieldName: "Job Name" },
  ];
  for (const textFit of textFits) {
    if (!fitExactText(textFit.element, textFit.minimumFontSize)) {
      throw new Error(`${textFit.fieldName} is too long for the sticker layout. Printing is blocked to avoid clipped order data.`);
    }
  }

  try {
    await Promise.all(images.map(waitForImage));
  } catch (error) {
    throw new Error(`${error?.message || "A graphic failed to load"} Refresh the page before printing.`);
  }

  readyToPrint = true;
  printButton.disabled = false;
  printStatus.textContent = "Ready to print";
}

async function load() {
  const params = new URLSearchParams(window.location.search);
  const recordId = String(params.get("id") || "").trim();
  const jobId = String(params.get("jobId") || "").trim();
  const source = String(params.get("source") || "list");
  const endpoint = endpointForSource(source, jobId);

  if (!/^rec[A-Za-z0-9]+$/.test(recordId)) {
    fail("The sticker link is missing a valid Airtable record ID.");
    return;
  }
  if (!endpoint) {
    fail("The sticker link names an unsupported Moaz data source.");
    return;
  }

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("The Moaz order source could not be loaded.");
    const payload = await response.json();
    const row = rowsFromPayload(payload).find(item => item?.id === recordId);
    if (!row) throw new Error("This order is not available in the selected Moaz view.");

    await renderLabel(row);
    if (params.get("autoprint") === "1" && readyToPrint) {
      window.setTimeout(() => window.print(), 120);
    }
  } catch (error) {
    fail(error?.message || "The sticker label could not be prepared.");
  }
}

printButton.addEventListener("click", () => {
  if (readyToPrint) window.print();
});

closeButton.addEventListener("click", () => {
  window.close();
  if (!window.closed && window.history.length > 1) window.history.back();
});

load();
