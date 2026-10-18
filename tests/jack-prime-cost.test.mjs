import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {model} from '../lib/jack-prime.js';
import {isApprovedModel} from '../lib/jack-prime-cost.js';
import {POST} from '../api/jack-prime.js';

const entry = pricing => ({id:model, type:'language', pricing});
const approvedPricing = JSON.parse(readFileSync(new URL('../lib/jack-prime-pricing.json',import.meta.url),'utf8')).pricing;
const changedPricing = change => {const pricing=structuredClone(approvedPricing);change(pricing);return pricing;};
const request = () => new Request('https://jacksandersuperstar.com/api/jack-prime', {
  method:'POST', headers:{'Content-Type':'application/json','Origin':'https://jacksandersuperstar.com'},
  body:JSON.stringify({messages:[{role:'user',content:'Which song should I start with?'}]})
});

test('routine greetings and acknowledgments do not use model quota, even if the provider is unavailable',async()=>{
  const original=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('Provider must not be contacted');};
  try{
    for(const [input,expected] of [['Hiiii','yo.'],['hey!','yo.'],['Fine','bet.'],['thanks','bet.'],['okay','bet.'],['yo','yo.']]){
      const req=new Request('https://jacksandersuperstar.com/api/jack-prime',{
        method:'POST',headers:{'Content-Type':'application/json',Origin:'https://jacksandersuperstar.com'},
        body:JSON.stringify({messages:[{role:'user',content:input}]})
      });
      const response=await POST(req);
      assert.equal(response.status,200);
      assert.deepEqual(await response.json(),{text:expected});
    }
    assert.equal(calls,0);
  }finally{globalThis.fetch=original;}
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
  assert.equal(model,'openai/gpt-6-luna');
  assert.equal(approvedPricing.input,'0.0000001');
  assert.equal(approvedPricing.output,'0.0000005');
  assert.equal(approvedPricing.input_cache_write,'0.000000125');
  assert.equal(isApprovedModel(entry(approvedPricing)),true);
  const reordered=value=>Array.isArray(value)?value.map(reordered):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reordered(item)])):value;
  assert.equal(isApprovedModel(entry(reordered(approvedPricing))),true);
  assert.equal(isApprovedModel({...entry(approvedPricing),id:'anthropic/claude-haiku-5.5'}),false);
  assert.equal(isApprovedModel({...entry(approvedPricing),type:'image'}),false);
});

test('any price, fee, tier, or schema change fails closed, including lower prices', () => {
  for (const change of [
    pricing=>pricing.input='0.00000011',
    pricing=>pricing.input='0.00000009',
    pricing=>pricing.output='0.0000006',
    pricing=>pricing.input_tiers[1].cost='0.0000003',
    pricing=>pricing.input_tiers[0].max=10000,
    pricing=>pricing.input_tiers[0].request_fee='0.01',
    pricing=>pricing.regional.us.input='0.00000012',
    pricing=>pricing.regional.unknown=pricing.regional.us,
    pricing=>pricing.regional.us.fast.output='0.0000012',
    pricing=>pricing.input_cache_write='0.00000013',
    pricing=>pricing.request_fee='0',
    pricing=>pricing.web_search='11',
    pricing=>pricing.service_tiers.priority.input='0.0000003',
    pricing=>pricing.fast.output='0.0000011',
    pricing=>delete pricing.input_cache_read,
    pricing=>pricing.input=0.0000001,
    pricing=>pricing.input='',
    pricing=>pricing.input='NaN',
    pricing=>pricing.input=-1
  ]) assert.equal(isApprovedModel(entry(changedPricing(change))),false,String(change));
  for(const pricing of [undefined,null,[],{}])assert.equal(isApprovedModel(entry(pricing)),false);
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
