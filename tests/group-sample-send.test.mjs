import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import test from "node:test";
import send from "../api/send-sample.js";
import reply from "../api/sample-native-reply.js";
const group="120363000000000001@g.us",record="recABCDEFGHIJKLMN",attachment="attABCDEFGHIJKLMN";
function res(){return{statusCode:200,body:null,setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},end(){return this;}};}
test("Moaz group send retains selected media and enables only authenticated scoped group approval",async()=>{
 const keys=["AIRTABLE_TOKEN","SAMPLE_APPROVAL_SECRET","MOAZ_PUBLIC_URL","SAMPLE_GROUP_ID","SAMPLE_NATIVE_REPLY_CALLBACK_SECRET","SAMPLE_NATIVE_REPLY_ISSUER"];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;
 const issuer={organizationId:"fixture-org",lineId:"fixture-line",bindingGeneration:"fixture-generation",activationId:"fixture-activation"};
 const callbackSecret="fixture-native-callback-key-more-than-32-bytes";
 Object.assign(process.env,{AIRTABLE_TOKEN:"fixture-airtable",SAMPLE_APPROVAL_SECRET:"fixture-shared-sample-key-more-than-32-bytes",MOAZ_PUBLIC_URL:"https://moaz.example",SAMPLE_GROUP_ID:group,SAMPLE_NATIVE_REPLY_CALLBACK_SECRET:callbackSecret,SAMPLE_NATIVE_REPLY_ISSUER:JSON.stringify(issuer)});
 const fields={"JOB ID":"12345","Client name text":["Fixture Customer"],"Clean phone number":"972500000001",Sample:[{id:attachment,url:"https://v5.airtableusercontent.com/fixture.png",filename:"fixture.png",type:"image/png"}],"Main Flow":"Sample","Send sample link":"https://connect.pabbly.com/workflow/sendwebhookdata/fixture"};
 const posted=[],patches=[];globalThis.fetch=async(url,options={})=>{
  if(String(url).startsWith("https://api.airtable.com/")){if(options.method==="PATCH"){const p=JSON.parse(options.body).fields;patches.push(p);Object.assign(fields,p);}return Response.json({id:record,fields});}
  assert.equal(new URL(url).hostname,"connect.pabbly.com");posted.push(JSON.parse(options.body));return new Response("accepted",{status:200});
 };
 try{
  const accepted=res();await send({method:"POST",headers:{},body:{id:record,attachmentIds:[attachment]}},accepted);assert.equal(accepted.statusCode,202);
  const p=posted[0];assert.equal(p.sample_group_message,"The sample of 12345 is sent to Fixture Customer.");assert.equal(p.sample_group_id,group);assert.match(p.sample_group_approve_button_id,/^ms3\./);assert.match(p.sample_approve_button_id,/^ms2\./);assert.equal(p.sample_group_media_idempotency_keys,`sample-${p.sample_submission_id}-group-120363000000000001-asset-${attachment}`);assert.deepEqual(p.sample_assets.map(a=>a.id),[attachment]);
  const body=Buffer.from(JSON.stringify({version:"native-reply.v2",...issuer,deliveryId:"fixture-delivery",originMessageId:"fixture-origin",originProviderMessageId:"fixture-provider-origin",replyProviderMessageId:"fixture-reply",rawEventId:"fixture-raw",recipientChatId:group,participantChatId:"972500000002@s.whatsapp.net",selectedButtonId:p.sample_group_approve_button_id,occurredAt:new Date().toISOString()}));
  const timestamp=String(Math.floor(Date.now()/1000));const req=Readable.from([body]);req.method="POST";req.headers={"x-platform-native-reply-timestamp":timestamp,"x-platform-native-reply-signature":crypto.createHmac("sha256",callbackSecret).update(`${timestamp}.`).update(body).digest("hex")};const approved=res();await reply(req,approved);assert.equal(approved.statusCode,200);assert.deepEqual(patches,[{"Sample approved by client":true,"Main Flow":"Sample Approved"}]);
  fields["Client name text"]=["one","two"];const invalid=res();await send({method:"POST",headers:{},body:{id:record,attachmentIds:[attachment]}},invalid);assert.equal(invalid.statusCode,409);assert.equal(posted.length,1);
 }finally{globalThis.fetch=oldFetch;for(const[k,v]of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
