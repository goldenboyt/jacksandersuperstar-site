import test from 'node:test';
import assert from 'node:assert/strict';
import {model} from '../lib/jack-prime.js';
import {isFreeModel} from '../lib/jack-prime-cost.js';
import {POST} from '../api/jack-prime.js';

const entry = pricing => ({id:model, type:'language', pricing});
const request = () => new Request('https://jacksandersuperstar.com/api/jack-prime', {
  method:'POST', headers:{'Content-Type':'application/json','Origin':'https://jacksandersuperstar.com'},
  body:JSON.stringify({messages:[{role:'user',content:'hello'}]})
});

test('only the pinned zero-price model can pass the cost check', () => {
  assert.equal(isFreeModel(entry({input:'0',output:'0'})),true);
  for (const pricing of [
    {input:'0.0000001',output:'0'},
    {input:'0',output:'0.0000001'},
    {input:'0',output:'0',input_tiers:[{min:0,cost:'0'},{min:10000,cost:'0.000001'}]},
    {input:'0',output:'0',regional:{us:{input:'0',output:'0.01'}}},
    {input:'0',output:'0',input_cache_write:'0.01'},
    {input:'0',output:'0',request_fee:'0.001'},
    {input:'',output:'0'},
    {output:'0'}
  ]) assert.equal(isFreeModel(entry(pricing)),false);
  assert.equal(isFreeModel({...entry({input:'0',output:'0'}),id:'another/free-model'}),false);
});

test('a pricing change blocks the route before any AI request is sent', async () => {
  const original = globalThis.fetch;
  const calls=[];
  globalThis.fetch = async (url,options) => {
    calls.push({url,options});
    assert.equal(url,'https://ai-gateway.vercel.sh/v1/models');
    return Response.json({data:[entry({input:'0',output:'0.001'})]});
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
