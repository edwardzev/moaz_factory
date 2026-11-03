import assert from "node:assert/strict";
import test from "node:test";

import handler from "../api/send-sample.js";

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    end() {
      return this;
    },
  };
}

test("Send Sample posts only the selected Airtable assets to Pabbly", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    AIRTABLE_TOKEN: process.env.AIRTABLE_TOKEN,
    SAMPLE_APPROVAL_SECRET: process.env.SAMPLE_APPROVAL_SECRET,
    MOAZ_PUBLIC_URL: process.env.MOAZ_PUBLIC_URL,
  };
  const pabblyRequests = [];

  process.env.AIRTABLE_TOKEN = "test-airtable-token";
  process.env.SAMPLE_APPROVAL_SECRET = "test-approval-secret";
  process.env.MOAZ_PUBLIC_URL = "https://moaz.example";

  globalThis.fetch = async (url, init = {}) => {
    const requestUrl = String(url);
    if (requestUrl.startsWith("https://api.airtable.com/")) {
      return new Response(JSON.stringify({
        id: "recJS7xwhFXHaoPJd",
        fields: {
          "JOB ID": "48441",
          "Clean phone number": "972546969974",
          "Client name": ["recABCDEFGHIJKLMN"],
          Sample: [
            {
              id: "attABCDEFGHIJKLMN",
              url: "https://dl.airtable.com/image-one",
              filename: "sample-one.jpg",
              type: "image/jpeg",
            },
            {
              id: "attNOPQRSTUVWXYZA",
              url: "https://dl.airtable.com/video-two",
              filename: "sample-two.mp4",
              type: "video/mp4",
            },
            {
              id: "attCDEFGHIJKLMNOP",
              url: "https://dl.airtable.com/old-file",
              filename: "old-file.jpg",
              type: "image/jpeg",
            },
          ],
          "Send sample link": "https://connect.pabbly.com/workflow/sendwebhookdata/test",
        },
      }), { status: 200 });
    }

    pabblyRequests.push({ url: requestUrl, init });
    return new Response("accepted", { status: 200 });
  };

  try {
    const req = {
      method: "POST",
      headers: { host: "ignored.example" },
      body: {
        id: "recJS7xwhFXHaoPJd",
        attachmentIds: ["attNOPQRSTUVWXYZA", "attABCDEFGHIJKLMN"],
      },
    };
    const res = responseRecorder();

    await handler(req, res);

    assert.equal(res.statusCode, 202);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.jobId, "48441");
    assert.match(res.body.submissionId, /^[a-f0-9]{32}$/);
    assert.equal(pabblyRequests.length, 1);
    assert.equal(pabblyRequests[0].init.method, "POST");
    assert.equal(pabblyRequests[0].init.redirect, "manual");
    assert.equal(pabblyRequests[0].init.headers["Content-Type"], "application/json");

    const payload = JSON.parse(pabblyRequests[0].init.body);
    assert.equal(payload.rec_id, "recJS7xwhFXHaoPJd");
    assert.equal(payload.sample_job_id, "48441");
    assert.equal(payload.sample_attachment_ids, "attNOPQRSTUVWXYZA,attABCDEFGHIJKLMN");
    assert.equal(payload.sample_submission_id, res.body.submissionId);
    assert.deepEqual(payload.sample_assets, [
      {
        id: "attNOPQRSTUVWXYZA",
        url: "https://dl.airtable.com/video-two",
        filename: "sample-two.mp4",
        contentType: "video/mp4",
        mediaKind: "video",
      },
      {
        id: "attABCDEFGHIJKLMN",
        url: "https://dl.airtable.com/image-one",
        filename: "sample-one.jpg",
        contentType: "image/jpeg",
        mediaKind: "image",
      },
    ]);
    assert.ok(!payload.sample_assets.some(asset => asset.filename === "old-file.jpg"));
    assert.deepEqual(JSON.parse(payload.sample_assets_json), payload.sample_assets);
    assert.match(payload.approve_url, /^https:\/\/moaz\.example\/api\/sample-approve\?token=/);
    assert.match(payload.comment_url, /^https:\/\/wa\.me\/972559664485\?text=/);
    assert.match(payload.sample_approve_button_id, /^ms2\./);
    assert.match(payload.sample_comment_button_id, /^ms2\./);
    assert.notEqual(payload.sample_approve_button_id, payload.sample_comment_button_id);
    assert.ok(Buffer.byteLength(payload.sample_approve_button_id) <= 256);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
