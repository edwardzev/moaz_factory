import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import handler from "../api/sample-native-reply.js";
import { createNativeGroupSampleButton, createNativeSampleButton, verifyNativeSampleButton, sampleFingerprint } from "../api/_native-sample-replies.js";
const group = "120363000000000001@g.us";
const customer = "972500000001@s.whatsapp.net";
const issuer = { organizationId: "org-fixture", lineId: "line-fixture", bindingGeneration: "generation-fixture", activationId: "activation-fixture" };
const callbackSecret = "fixture-callback-signing-key-over-32-bytes";
const signing = "fixture-shared-moaz-effective-signing-key";
const recordId = "recABCDEFGHIJKLMN";
const assets = [{ id: "attABCDEFGHIJKLMN" }];
function recorder() { return { statusCode: 200, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, end() { return this; } }; }
function request(id, overrides = {}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = Buffer.from(JSON.stringify({version:"native-reply.v2", ...issuer, deliveryId:"delivery-fixture",originMessageId:"origin-fixture",originProviderMessageId:"provider-origin",replyProviderMessageId:"provider-reply",rawEventId:"raw-fixture",recipientChatId:group,participantChatId:"972500000002@s.whatsapp.net",selectedButtonId:id,occurredAt:new Date().toISOString(),...overrides}));
  const req=Readable.from([body]);req.method="POST";req.headers={"x-platform-native-reply-timestamp":timestamp,"x-platform-native-reply-signature":crypto.createHmac("sha256",callbackSecret).update(`${timestamp}.`).update(body).digest("hex")};return req;
}

test("group native approvals bind exact group and customer while retaining individual and repeat behavior", async () => {
 const keys=["AIRTABLE_TOKEN","SAMPLE_APPROVAL_SECRET","SAMPLE_NATIVE_REPLY_CALLBACK_SECRET","SAMPLE_NATIVE_REPLY_ISSUER","SAMPLE_GROUP_ID"];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const oldFetch=globalThis.fetch;
 Object.assign(process.env,{AIRTABLE_TOKEN:"fixture-airtable",SAMPLE_APPROVAL_SECRET:signing,SAMPLE_NATIVE_REPLY_CALLBACK_SECRET:callbackSecret,SAMPLE_NATIVE_REPLY_ISSUER:JSON.stringify(issuer),SAMPLE_GROUP_ID:group});
 const fields={"JOB ID":"12345","Clean phone number":"972500000001",Sample:assets,"Sample approved by client":false,"Main Flow":"Sample"};let reads=0;const patches=[];
 globalThis.fetch=async(url,init={})=>{assert.ok(String(url).startsWith("https://api.airtable.com/"));if(init.method==="PATCH"){const p=JSON.parse(init.body).fields;patches.push(p);Object.assign(fields,p);}else reads++;return Response.json({id:recordId,fields});};
 const capability={recordId,jobId:"12345",recipientChatId:group,customerRecipientChatId:customer,submissionId:"a".repeat(32),fingerprint:sampleFingerprint(assets)};
 async function run(id,overrides){const r=recorder();await handler(request(id,overrides),r);return r;}
 try {
  const approve=createNativeGroupSampleButton({...capability,action:"approve"});const comment=createNativeGroupSampleButton({...capability,action:"comment"});
  assert.match(approve,/^ms3\./);assert.ok(Buffer.byteLength(approve)<=256);
  const [,encoded,signature]=approve.split(".");const key=crypto.createHmac("sha256",signing).update("moaz-native-sample-group-reply-v3").digest();assert.equal(signature,crypto.createHmac("sha256",key).update(encoded).digest("base64url"));
  assert.equal(verifyNativeSampleButton(approve).customerRecipientChatId,customer);
  for(const overrides of [{participantChatId:""},{participantChatId:group},{version:"native-reply.v1"},{recipientChatId:"120363000000000002@g.us"}])assert.equal((await run(approve,overrides)).statusCode,400);
  assert.equal(reads,0);assert.equal(patches.length,0);
  process.env.SAMPLE_GROUP_ID="120363000000000002@g.us";assert.equal((await run(approve)).statusCode,400);process.env.SAMPLE_GROUP_ID=group;
  assert.equal((await run(comment)).body.commentInWhatsApp,true);assert.equal(patches.length,0);
  assert.equal((await run(approve)).body.approved,true);assert.deepEqual(patches,[{"Sample approved by client":true,"Main Flow":"Sample Approved"}]);
  assert.equal((await run(approve,{participantChatId:"123456789012345@lid"})).body.alreadyApproved,true);assert.equal(patches.length,1);
  const direct=createNativeSampleButton({...capability,recipientChatId:customer,action:"approve"});
  assert.equal((await run(direct,{version:"native-reply.v1",recipientChatId:customer})).body.alreadyApproved,true);assert.equal(patches.length,1);
  fields["Main Flow"]="Truck left";assert.equal((await run(approve)).statusCode,409);assert.equal(patches.length,1);fields["Main Flow"]="Sample Approved";
  for(const [field,value] of [["JOB ID","other"],["Clean phone number","972500000009"],["Sample",[...assets,{id:"attNOPQRSTUVWXYZA"}]]]){const old=fields[field];fields[field]=value;assert.equal((await run(approve)).statusCode,409);fields[field]=old;assert.equal(patches.length,1);}
  assert.throws(()=>createNativeGroupSampleButton({...capability,jobId:"",action:"approve"}));
  assert.equal(Buffer.byteLength(createNativeGroupSampleButton({...capability,jobId:"1".repeat(30),action:"approve"})),256);
  assert.throws(()=>createNativeGroupSampleButton({...capability,jobId:"1".repeat(31),action:"approve"}));
  process.env.SAMPLE_APPROVAL_SECRET="   ";assert.throws(()=>createNativeGroupSampleButton({...capability,action:"approve"}));
 } finally {globalThis.fetch=oldFetch;for(const[k,v]of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
