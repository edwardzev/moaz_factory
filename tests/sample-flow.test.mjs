import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import upload from "../api/sample-upload.js";
import send from "../api/send-sample.js";
import approve from "../api/sample-approve.js";

function recorder() {
  return { statusCode: null, body: null, headers: {}, status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; }, json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; }, end() { return this; } };
}

test("full selected image/video flow uploads, submits exact assets, and confirms the anchored approval fields", async () => {
  const originalFetch = globalThis.fetch;
  const env = Object.fromEntries(["AIRTABLE_TOKEN", "SAMPLE_APPROVAL_SECRET", "MOAZ_PUBLIC_URL"].map(key => [key, process.env[key]]));
  Object.assign(process.env, { AIRTABLE_TOKEN: "fixture", SAMPLE_APPROVAL_SECRET: "fixture-signing", MOAZ_PUBLIC_URL: "https://moaz.example" });
  const recordId = "recJS7xwhFXHaoPJd";
  const fields = { "JOB ID": 48441, "Clean phone number": "972546969974", "Main Flow": "Truck left", Sample: [], "Send sample link": "https://connect.pabbly.com/workflow/sendwebhookdata/fixture" };
  const attachmentIds = ["attABCDEFGHIJKLMN", "attNOPQRSTUVWXYZA"];
  const patches = [], submissions = [];
  let uploads = 0, ambiguousUpload = false, workflowStatus = 200;
  globalThis.fetch = async (value, options = {}) => {
    const url = String(value);
    if (url.startsWith("https://api.airtable.com/")) {
      if (options.method === "PATCH") { const patch = JSON.parse(options.body).fields; patches.push(patch); Object.assign(fields, patch); }
      return new Response(JSON.stringify({ id: recordId, fields }), { status: 200 });
    }
    if (url.startsWith("https://content.airtable.com/")) {
      const file = JSON.parse(options.body);
      if (ambiguousUpload) {
        return new Response(JSON.stringify({ fields: { fldNTD26J1QlI7WOb: [
          ...fields.Sample,
          { id: "attCDEFGHIJKLMNOP" },
          { id: "attDEFGHIJKLMNOPQ" },
        ] } }), { status: 200 });
      }
      assert.equal(Buffer.from(file.file, "base64").toString(), uploads ? "fixture-video" : "fixture-photo");
      fields.Sample.push({ id: attachmentIds[uploads++], url: `https://v5.airtableusercontent.com/${file.filename}`, filename: file.filename, type: file.contentType });
      return new Response(JSON.stringify({ id: recordId, fields: { fldNTD26J1QlI7WOb: fields.Sample } }), { status: 200 });
    }
    if (url.startsWith("https://connect.pabbly.com/")) { submissions.push(JSON.parse(options.body)); assert.equal(options.redirect, "manual"); return new Response("workflow response", { status: workflowStatus }); }
    throw new Error("Unexpected test transport.");
  };
  try {
    for (const [index, type] of ["image/png", "video/mp4"].entries()) {
      const req = Readable.from([Buffer.from(index ? "fixture-video" : "fixture-photo")]);
      req.method = "POST"; req.url = `/api/sample-upload?id=${recordId}&filename=${index ? "clip.mp4" : "photo.png"}&contentType=${encodeURIComponent(type)}`;
      const res = recorder(); await upload(req, res);
      assert.equal(res.statusCode, 200); assert.equal(res.body.attachmentId, attachmentIds[index]);
    }
    const sent = recorder(); await send({ method: "POST", headers: {}, body: { id: recordId, attachmentIds } }, sent);
    assert.equal(sent.statusCode, 202); assert.equal(submissions.length, 1);
    assert.deepEqual(submissions[0].sample_assets.map(item => item.mediaKind), ["image", "video"]);
    assert.deepEqual(submissions[0].sample_assets.map(item => item.id), attachmentIds);
    assert.deepEqual(JSON.parse(submissions[0].sample_assets_json), submissions[0].sample_assets);
    assert.deepEqual(JSON.parse(decodeURIComponent(submissions[0].sample_assets_encoded)), submissions[0].sample_assets);
    assert.match(submissions[0].comment_url, /^https:\/\/wa\.me\/972559664485\?text=/);
    assert.equal(patches.length, 0);
    workflowStatus = 302;
    const redirected = recorder(); await send({ method: "POST", headers: {}, body: { id: recordId, attachmentIds } }, redirected);
    assert.equal(redirected.statusCode, 502); assert.equal(redirected.body.submitted, undefined);
    workflowStatus = 200;
    ambiguousUpload = true;
    const ambiguousReq = Readable.from([Buffer.from("fixture-photo")]);
    ambiguousReq.method = "POST"; ambiguousReq.url = `/api/sample-upload?id=${recordId}&filename=ambiguous.png&contentType=image%2Fpng`;
    const ambiguousRes = recorder(); await upload(ambiguousReq, ambiguousRes);
    assert.equal(ambiguousRes.statusCode, 502); assert.equal(ambiguousRes.body.attachmentId, undefined);
    assert.match(ambiguousRes.body.error, /uniquely identify/);
    const url = submissions[0].approve_url;
    const page = recorder(); await approve({ method: "GET", url }, page);
    assert.equal(page.statusCode, 200); assert.match(page.body, /<form method="post"/); assert.equal(patches.length, 0);
    assert.equal(page.headers["Content-Type"], "text/html; charset=utf-8");
    assert.equal(page.headers["Cache-Control"], "no-store");
    const confirmed = recorder(); await approve({ method: "POST", url }, confirmed);
    assert.equal(confirmed.statusCode, 200);
    assert.deepEqual(patches, [{ "Sample approved by client": true, "Main Flow": "Sample Approved" }]);
    assert.equal(fields["Sample approved by client"], true); assert.equal(fields["Main Flow"], "Sample Approved");
    assert.equal(fields.Sample.length, 2);
    fields["JOB ID"] = 99999;
    const stale = recorder(); await approve({ method: "POST", url }, stale);
    assert.equal(stale.statusCode, 409); assert.equal(patches.length, 1);
    const invalid = recorder(); await approve({ method: "POST", url: `${url}tampered` }, invalid);
    assert.equal(invalid.statusCode, 400); assert.equal(patches.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
