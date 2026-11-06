import assert from "node:assert/strict";
import test from "node:test";
import { notifyCustomerSampleApproval } from "../api/_sample-approval-notices.js";

test("customer approval queues exact wording to both groups with separate stable keys", async (t) => {
  const original = globalThis.fetch;
  const env = {
    SAMPLE_APPROVAL_NOTICES_SINCE: "2026-11-06T10:00:00Z",
    SAMPLE_APPROVAL_PM_TOKEN: "fixture-pm-token",
  };
  const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    globalThis.fetch = original;
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const requests = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://app.ezw.solutions/api/v1/messages/text");
    assert.equal(init.redirect, "error");
    const payload = JSON.parse(init.body);
    requests.push(payload);
    assert.equal(init.headers.Authorization, "Bearer fixture-pm-token");
    if (requests.length === 1) throw new Error("fixture response lost");
    return Response.json({
      status: "queued",
      channelId: "6befab5d-10e9-40f3-bbb4-6756a56f7e4d",
      groupId: payload.groupId,
      idempotencyKey: payload.idempotencyKey,
      outboundAttempt: { id: "fixture-attempt" },
    }, { status: 202 });
  };
  const event = {
    producer: "ahmed", fingerprint: "fixture-fingerprint", recordId: "recABCDEFGHIJKLMN", jobId: "12345", occurredAt: "2026-11-06T11:00:00Z",
    fields: { "Client name text": ["Test customer"], "Job Name": "Test job", Sample: [{ id: "attABCDEFGHIJKLMN" }] },
  };
  assert.equal(await notifyCustomerSampleApproval({ ...event, occurredAt: "2026-11-06T09:59:59Z" }), undefined);
  assert.equal(await notifyCustomerSampleApproval({ ...event, producer: undefined }), undefined);
  assert.equal(requests.length, 0);
  assert.equal((await notifyCustomerSampleApproval(event)).status, "queued");
  assert.deepEqual(requests.map(request => request.groupId), [
    "120363414125815359@g.us", "120363408115679594@g.us", "120363414125815359@g.us",
  ]);
  assert.ok(requests.every(request => request.body === "Test customer approved sample of Test job 12345"));
  assert.notEqual(requests[0].idempotencyKey, requests[1].idempotencyKey);
  assert.equal(requests[0].idempotencyKey, requests[2].idempotencyKey);
  await notifyCustomerSampleApproval(event);
  assert.equal(requests[3].idempotencyKey, requests[0].idempotencyKey);
  assert.equal(requests[4].idempotencyKey, requests[1].idempotencyKey);
  const incomplete = await notifyCustomerSampleApproval({ ...event, fields: { ...event.fields, "Client name text": ["A", "B"] } });
  assert.deepEqual(incomplete, { status: "unavailable", reason: "order_fields" });
  assert.equal(requests.length, 5);
});
