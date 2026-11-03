import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { SAMPLE_SUBMISSION_PROTOCOL } from "../api/_sample-customer-routing.js";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const messageStart = source.indexOf("function setSampleMessage(");
const messageEnd = source.indexOf("function addSampleFiles(", messageStart);
const submitStart = source.indexOf("async function submitSample(");
const submitEnd = source.indexOf("function attachmentsList(", submitStart);
assert.ok(messageStart >= 0 && messageEnd > messageStart && submitStart >= 0 && submitEnd > submitStart);
const protocolDeclaration = source.match(/^const SAMPLE_SUBMISSION_PROTOCOL = ("[^"]+");$/m);
assert.ok(protocolDeclaration);
assert.equal(JSON.parse(protocolDeclaration[1]), SAMPLE_SUBMISSION_PROTOCOL);
const sampleFunctions = `${protocolDeclaration[0]}\n${source.slice(messageStart, messageEnd)}\n${source.slice(submitStart, submitEnd)}`;

function element() {
  const attributes = {};
  const classes = new Set();
  return { disabled: false, textContent: "", attributes, classes,
    classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } },
    setAttribute(key, value) { attributes[key] = value; }, removeAttribute(key) { delete attributes[key]; } };
}

function uiContext(result, { status = 202 } = {}) {
  const label = element();
  const timers = [];
  let requests = 0, loads = 0, closes = 0;
  const context = vm.createContext({
    sampleRow: { id: "recJS7xwhFXHaoPJd", jobId: "48441" },
    pendingSampleFiles: [{ uploaded: true, attachmentId: "attABCDEFGHIJKLMN", file: { name: "sample.jpg" } }],
    sampleSubmissionInProgress: false, sampleSubmissionAccepted: false,
    sampleSubmit: Object.assign(element(), { querySelector() { return label; } }),
    sampleClose: element(), sampleCancel: element(), sampleCameraInput: element(), sampleFilesInput: element(),
    sampleBackdrop: element(), sampleMessage: element(),
    fetch: async (url, options) => {
      requests++;
      assert.equal(url, "/api/send-sample");
      assert.deepEqual(JSON.parse(options.body), { id: "recJS7xwhFXHaoPJd", attachmentIds: ["attABCDEFGHIJKLMN"], submissionProtocol: SAMPLE_SUBMISSION_PROTOCOL });
      return new Response(JSON.stringify(result), { status });
    },
    uploadSampleFile: async () => { throw new Error("Already saved files must not be uploaded again."); },
    renderPendingSampleFiles() {}, load: async () => { loads++; },
    closeSampleDialog() { closes++; }, setTimeout(callback, delay) { timers.push({ callback, delay }); },
  });
  vm.runInContext(sampleFunctions, context);
  return { context, label, timers, counts: () => ({ requests, loads, closes }) };
}

test("configured group unavailability is a persistent operator alert without repeating the accepted customer submit", async () => {
  const reason = "The order has no single nonblank Client name text value. No group notification may be sent.";
  const ui = uiContext({ ok: true, submitted: true, jobId: "48441", groupNotification: { requested: true, status: "unavailable", reason } });
  await ui.context.submitSample();
  assert.match(ui.context.sampleMessage.textContent, /was submitted to the WhatsApp workflow/);
  assert.ok(ui.context.sampleMessage.textContent.includes(`Group notification was not submitted: ${reason}`));
  assert.match(ui.context.sampleMessage.textContent, /Do not resubmit/);
  assert.equal(ui.context.sampleMessage.attributes.role, "alert");
  assert.ok(ui.context.sampleMessage.classes.has("sample-message-error"));
  assert.equal(ui.context.sampleSubmissionAccepted, true); assert.equal(ui.context.sampleSubmissionInProgress, false);
  assert.equal(ui.context.sampleSubmit.disabled, true);
  assert.equal(ui.context.sampleClose.disabled, false); assert.equal(ui.context.sampleCancel.disabled, false);
  assert.equal(ui.context.sampleCameraInput.disabled, true); assert.equal(ui.context.sampleFilesInput.disabled, true);
  assert.equal(ui.context.sampleBackdrop.attributes["aria-busy"], undefined);
  assert.equal(ui.label.textContent, "Submitted ✓");
  assert.equal(ui.timers.length, 0); assert.deepEqual(ui.counts(), { requests: 1, loads: 1, closes: 0 });
  await ui.context.submitSample();
  assert.deepEqual(ui.counts(), { requests: 1, loads: 1, closes: 0 });
});

test("disabled, submitted and legacy group metadata retain the existing quiet success flow", async () => {
  for (const groupNotification of [{ requested: false, status: "disabled" }, { requested: true, status: "submitted" }, undefined]) {
    const ui = uiContext({ ok: true, submitted: true, jobId: "48441", groupNotification });
    await ui.context.submitSample();
    assert.equal(ui.context.sampleMessage.attributes.role, "status");
    assert.ok(!ui.context.sampleMessage.classes.has("sample-message-error"));
    assert.ok(!ui.context.sampleMessage.textContent.includes("Group notification"));
    assert.equal(ui.timers.length, 1); assert.equal(ui.timers[0].delay, 1200);
    ui.timers[0].callback();
    assert.equal(ui.context.sampleSubmissionInProgress, false); assert.equal(ui.counts().closes, 1);
  }
});

test("a rejected workflow submission remains retryable and is not marked accepted", async () => {
  const ui = uiContext({ error: "Workflow unavailable" }, { status: 502 });
  await ui.context.submitSample();
  assert.equal(ui.context.sampleMessage.textContent, "Workflow unavailable");
  assert.equal(ui.context.sampleMessage.attributes.role, "alert");
  assert.equal(ui.context.sampleSubmissionAccepted, false); assert.equal(ui.context.sampleSubmissionInProgress, false);
  assert.equal(ui.context.sampleSubmit.disabled, false); assert.equal(ui.label.textContent, "Submit sample");
  assert.equal(ui.context.sampleClose.disabled, false); assert.equal(ui.context.sampleCameraInput.disabled, false);
  assert.equal(ui.timers.length, 0);
});
