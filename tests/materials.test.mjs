import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../api/materials.js", import.meta.url), "utf8");
const { materialsHandler } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

function responseRecorder() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test("POST assigns new Moaz materials orders to North storage", async () => {
  const postBodies = [];
  let createdRecord = null;
  const fetchImpl = async (url, init = {}) => {
    if (url.includes("/meta/bases/")) {
      return new Response(JSON.stringify({
        tables: [{
          id: "tblxLxutIQmSKEDg9",
          fields: [{
            name: "direction",
            type: "singleSelect",
            options: { choices: [{ name: "Entered" }, { name: "Sold" }] },
          }],
        }],
      }), { status: 200 });
    }

    if (init.method === "POST") {
      const body = JSON.parse(init.body);
      postBodies.push(body);
      createdRecord = {
        id: "recbTuh8mB0SwPFUQ",
        createdTime: "2026-10-10T10:35:30.000Z",
        fields: {
          "Record#": 96,
          Created: "2026-10-10T10:35:30.000Z",
          ...body.fields,
        },
      };
      return new Response(JSON.stringify(createdRecord), { status: 200 });
    }

    if (url.includes("/tblxLxutIQmSKEDg9?")) {
      const records = createdRecord?.fields.Storage === "North" ? [createdRecord] : [];
      return new Response(JSON.stringify({ records }), { status: 200 });
    }

    return new Response(JSON.stringify({
      records: [{ id: "reczHeDR0kwnR9NyV", fields: { SKU: "D-UAP-7YE" } }],
    }), { status: 200 });
  };

  const req = {
    method: "POST",
    body: {
      fields: {
        direction: "Entered",
        Item: ["reczHeDR0kwnR9NyV"],
        Qty: 4,
      },
    },
  };
  const res = responseRecorder();

  await materialsHandler(req, res, { fetchImpl, airtableToken: () => "test-token" });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  assert.deepEqual(postBodies, [{
    fields: {
      direction: "Entered",
      Item: ["reczHeDR0kwnR9NyV"],
      Qty: 4,
      Storage: "North",
    },
  }]);

  const getRes = responseRecorder();
  await materialsHandler({ method: "GET" }, getRes, {
    fetchImpl,
    airtableToken: () => "test-token",
  });

  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.records.length, 1);
  assert.equal(getRes.body.records[0].id, "recbTuh8mB0SwPFUQ");
});

test("Storage remains server-owned and cannot be supplied as a UI field", async () => {
  const req = {
    method: "POST",
    body: { fields: { direction: "Entered", Storage: "South" } },
  };
  const res = responseRecorder();

  await materialsHandler(req, res, {
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
    airtableToken: () => "test-token",
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "Unsupported field: Storage" });
});
