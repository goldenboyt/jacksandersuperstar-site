import test from 'node:test';
import assert from 'node:assert/strict';
import {NoImageGeneratedError} from 'ai';
import {createImageHandler,imageModel,isApprovedImageModel,ImagePricingBlocked} from '../lib/jack-prime-images.js';

const id='d6c27f5e-d95d-4df5-b188-0629cc362953';
const body={prompt:'A black and white concert poster',requestId:id};
const request=(value=body,origin='https://jacksandersuperstar.com')=>new Request('https://jacksandersuperstar.com/api/jack-prime-image',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(value)});
const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,0,1,2,3]);
const generated=()=>({images:[{mediaType:'image/png',uint8Array:bytes}],image:{mediaType:'image/png',uint8Array:bytes}});

test('image price guard pins the model, rates, and all pricing fields',()=>{
  const pricing={input:'0.000005',output:'0.00003',input_cache_read:'0.00000125'};
  const entry={id:imageModel,type:'image',pricing};
  assert.equal(isApprovedImageModel(entry),true);
  assert.equal(isApprovedImageModel({...entry,pricing:{output:pricing.output,input_cache_read:pricing.input_cache_read,input:pricing.input}}),true);
  for(const changed of [{...entry,id:'another/image'},{...entry,type:'language'},{...entry,pricing:{...pricing,output:'0.000031'}},{...entry,pricing:{...pricing,request_fee:'0'}},{...entry,pricing:null}])assert.equal(isApprovedImageModel(changed),false);
});

test('invalid prompts and outside origins never reach pricing or generation',async()=>{
  let calls=0;
  const handler=createImageHandler({verifyPricing:async()=>{calls++;},generate:async()=>{calls++;return generated();}});
  for(const invalid of [{...body,prompt:''},{...body,prompt:'a'.repeat(1601)},{...body,requestId:'not-a-uuid'},{}])assert.equal((await handler(request(invalid))).status,400);
  assert.equal((await handler(request(body,'https://example.com'))).status,403);
  assert.equal(calls,0);
});

test('pricing changes and lookup failure prevent an image call',async()=>{
  for(const [error,status] of [[new ImagePricingBlocked('changed'),402],[new Error('lookup failed'),503]]){
    let generations=0;
    const handler=createImageHandler({verifyPricing:async()=>{throw error;},generate:async()=>{generations++;return generated();}});
    assert.equal((await handler(request())).status,status);
    assert.equal(generations,0);
  }
});

test('concurrent and completed retries reuse one binary image result',async()=>{
  let calls=0,resolve;
  const pending=new Promise(done=>{resolve=done;});
  const handler=createImageHandler({verifyPricing:async()=>{},generate:async options=>{calls++;assert.equal(options.n,1);assert.equal(options.maxRetries,0);await pending;return generated();}});
  const first=handler(request()),second=handler(request());
  await new Promise(done=>setImmediate(done));
  assert.equal(calls,1);resolve();
  const responses=await Promise.all([first,second]);
  responses.push(await handler(request()));
  for(const response of responses){assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/png');assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);}
  assert.equal(calls,1);
  assert.equal((await handler(request({...body,prompt:'A different picture'}))).status,409);
});

test('failed generations and oversized images return usable JSON errors',async()=>{
  for(const generate of [async()=>{throw Object.assign(new Error('credits'),{statusCode:402});},async()=>({images:[{}],image:{mediaType:'image/png',uint8Array:new Uint8Array(4400001)}})]){
    const handler=createImageHandler({verifyPricing:async()=>{},generate});
    const response=await handler(request());
    assert.ok([402,503].includes(response.status));assert.equal(typeof (await response.json()).error,'string');
  }
});

test('an SDK empty image result asks for a different description without retrying',async()=>{
  let calls=0;
  const handler=createImageHandler({verifyPricing:async()=>{},generate:async()=>{calls++;throw new NoImageGeneratedError({calls:[],responses:[]});}});
  const response=await handler(request());
  assert.equal(response.status,422);assert.match((await response.json()).error,/different description/);assert.equal(calls,1);
});
