import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {model,providerOptions} from '../lib/jack-prime.js';
import {isApprovedModel,isApprovedEndpoint,verifyModelPricing,tokenPriceCeilings} from '../lib/jack-prime-cost.js';
import {POST} from '../api/jack-prime.js';
import {createChatHandler} from '../lib/jack-prime-chat.js';

const entry = pricing => ({id:model, type:'language', pricing});
const reviewed = JSON.parse(readFileSync(new URL('../lib/jack-prime-pricing.json',import.meta.url),'utf8'));
const approvedPricing = reviewed.pricing;
const endpoint = pricing => ({provider_name:reviewed.provider,pricing});
const changedPricing = change => {const pricing=structuredClone(approvedPricing);change(pricing);return pricing;};
const request = () => new Request('https://jacksandersuperstar.com/api/jack-prime', {
  method:'POST', headers:{'Content-Type':'application/json','Origin':'https://jacksandersuperstar.com'},
  body:JSON.stringify({messages:[{role:'user',content:'Which song should I start with?'}]})
});

test('greetings and acknowledgments reach the model with conversation history and retain its response',async()=>{
  const expected='That track fits the mood you mentioned.';
  const generated=[];let priced=0;
  const handler=createChatHandler({verifyPricing:async()=>{priced++},generate:async options=>{
    generated.push(options);
    return {text:expected,finishReason:'stop',usage:{inputTokens:100,outputTokens:10},finalStep:{providerMetadata:{gateway:{generationId:'test-conversation'}}}};
  }});
  for(const input of ['Hiiii','hey!','Fine','thanks','okay','yo']){
    const messages=[{role:'user',content:'I want a song for a quiet drive.'},{role:'assistant',content:'Try cybertruck.'},{role:'user',content:input}];
    const req=new Request('https://jacksandersuperstar.com/api/jack-prime',{
      method:'POST',headers:{'Content-Type':'application/json',Origin:'https://jacksandersuperstar.com'},body:JSON.stringify({messages})
    });
    const response=await handler(req);
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{text:expected});
    assert.deepEqual(generated.at(-1).messages,messages);
  }
  assert.equal(generated.length,6);assert.equal(priced,6);
});

test('math and essay requests are declined before pricing or generation, including with music history',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('No model call expected');};
  try{
    for(const input of ['What is 37 * 48?','Write an essay about Jack Sander']){
      const response=await POST(new Request('https://jacksandersuperstar.com/api/jack-prime',{
        method:'POST',headers:{'Content-Type':'application/json',Origin:'https://jacksandersuperstar.com'},
        body:JSON.stringify({messages:[{role:'user',content:'Who is Jack?'},{role:'assistant',content:'Jack Sander is the artist behind the music.'},{role:'user',content:input}]})
      }));
      assert.equal(response.status,200);
      assert.match((await response.json()).text,/i don't (?:do math problems|write essays)/);
    }
    assert.equal(calls,0);
  }finally{globalThis.fetch=original;}
});

test('only the pinned model with the complete reviewed pricing snapshot can pass', () => {
  assert.equal(model,'spacexai/grok-4.20-non-reasoning');
  assert.equal(approvedPricing.input,'0.00000125');
  assert.equal(approvedPricing.output,'0.0000025');
  assert.equal(approvedPricing.input_cache_read,'0.0000002');
  assert.deepEqual(tokenPriceCeilings,{input:0.00000125,output:0.0000025});
  assert.deepEqual(providerOptions,{gateway:{only:['xai']}});
  assert.equal(isApprovedModel(entry(approvedPricing)),true);
  const reordered=value=>Array.isArray(value)?value.map(reordered):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reordered(item)])):value;
  assert.equal(isApprovedModel(entry(reordered(approvedPricing))),true);
  assert.equal(isApprovedModel({...entry(approvedPricing),id:'openai/gpt-6-luna'}),false);
  assert.equal(isApprovedModel({...entry(approvedPricing),id:'spacexai/grok-4.1-fast-reasoning'}),false);
  assert.equal(isApprovedModel({...entry(approvedPricing),type:'image'}),false);
});

test('any price, fee, tier, or schema change fails closed, including lower prices', () => {
  for (const change of [
    pricing=>pricing.input='0.00000126',
    pricing=>pricing.input='0.00000124',
    pricing=>pricing.output='0.0000026',
    pricing=>pricing.input_cache_read='0.0000003',
    pricing=>pricing.input_tiers=[{min:0,max:10000,cost:pricing.input},{min:10000,cost:'0.0000004'}],
    pricing=>pricing.output_tiers=[{min:0,cost:pricing.output,request_fee:'0.01'}],
    pricing=>pricing.regional={us:{input:'0.0000003'}},
    pricing=>pricing.input_cache_write='0.00000025',
    pricing=>pricing.request_fee='0',
    pricing=>pricing.web_search='6',
    pricing=>pricing.service_tiers={priority:{input:'0.0000004'}},
    pricing=>pricing.fast={output:'0.000001'},
    pricing=>delete pricing.input_cache_read,
    pricing=>pricing.input=0.0000002,
    pricing=>pricing.input='',
    pricing=>pricing.input='NaN',
    pricing=>pricing.input=-1
  ]) assert.equal(isApprovedModel(entry(changedPricing(change))),false,String(change));
  for(const pricing of [undefined,null,[],{}])assert.equal(isApprovedModel(entry(pricing)),false);
});

test('the selected provider must match its entire reviewed pricing, including cache tiers and tool fees',()=>{
  assert.equal(isApprovedEndpoint(endpoint(reviewed.providerPricing)),true);
  assert.equal(isApprovedEndpoint({...endpoint(reviewed.providerPricing),provider_name:'vertex'}),false);
  for(const change of [
    p=>p.prompt='0.000002',p=>p.prompt='0.000001',p=>p.completion='0.000003',
    p=>p.input_cache_read_tiers[1].cost='0.0000005',p=>p.prompt_tiers[0].max=10000,
    p=>p.request='0.01',p=>p.x_search_user='0.02',p=>p.extra_fee='0',p=>delete p.discount
  ]){
    const pricing=structuredClone(reviewed.providerPricing);change(pricing);
    assert.equal(isApprovedEndpoint(endpoint(pricing)),false,String(change));
  }
});

test('fresh catalog and provider snapshots are both checked before approved chat',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url,options});
    if(url==='https://ai-gateway.vercel.sh/v1/models')return Response.json({data:[entry(approvedPricing)]});
    assert.equal(url,`https://ai-gateway.vercel.sh/v1/models/${model}/endpoints`);
    return Response.json({data:{endpoints:[endpoint(reviewed.providerPricing)]}});
  };
  try{
    await verifyModelPricing();
    assert.equal(calls.length,2);assert(calls.every(call=>call.options.cache==='no-store'));
  }finally{globalThis.fetch=original}
});

test('changed, missing, and unavailable provider pricing block the route before an AI call',async()=>{
  const original=globalThis.fetch;
  try{
    for(const status of [402,503]){
      const calls=[];
      globalThis.fetch=async(url)=>{
        calls.push(url);
        if(url==='https://ai-gateway.vercel.sh/v1/models')return Response.json({data:[entry(approvedPricing)]});
        assert.equal(url,`https://ai-gateway.vercel.sh/v1/models/${model}/endpoints`);
        return status===503?new Response('',{status}):Response.json({data:{endpoints:[endpoint({...reviewed.providerPricing,prompt:'0.000002'})]}});
      };
      assert.equal((await POST(request())).status,status);assert.equal(calls.length,2);
    }
    globalThis.fetch=async url=>Response.json(url.endsWith('/endpoints')?{data:{endpoints:[]}}:{data:[entry(approvedPricing)]});
    assert.equal((await POST(request())).status,402);
  }finally{globalThis.fetch=original}
});

test('a pricing change blocks the route before any AI request is sent', async () => {
  const original = globalThis.fetch;
  const calls=[];
  globalThis.fetch = async (url,options) => {
    calls.push({url,options});
    assert.equal(url,'https://ai-gateway.vercel.sh/v1/models');
    return Response.json({data:[entry(changedPricing(pricing=>pricing.output='0.000001'))]});
  };
  try {
    const response=await POST(request());
    assert.equal(response.status,402);
    assert.equal(calls.length,1);
    assert.equal(calls[0].options.cache,'no-store');
  } finally { globalThis.fetch=original; }
});

test('unavailable pricing never falls through to generation', async () => {
  const original=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async url => {
    calls++; assert.equal(url,'https://ai-gateway.vercel.sh/v1/models');
    return new Response('',{status:503});
  };
  try {
    const response=await POST(request());
    assert.equal(response.status,503);
    assert.equal(calls,1);
  } finally { globalThis.fetch=original; }
});
