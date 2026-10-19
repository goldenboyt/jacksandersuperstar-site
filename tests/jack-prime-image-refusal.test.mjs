import test from 'node:test';
import assert from 'node:assert/strict';
import {NoImageGeneratedError} from 'ai';
import {createImageRefusalWriter,isImageSafetyRefusal} from '../lib/jack-prime-image-refusal.js';
import {createImageHandler} from '../lib/jack-prime-images.js';
import {defaultFaceReference} from '../lib/jack-prime-references.js';
import {model,providerOptions} from '../lib/jack-prime.js';

const body={prompt:'A refused creative request',context:'Earlier creative context',requestId:'3212b026-5ca7-4ee8-afdb-827c5e4fc5ec'};
const request=(value=body)=>new Request('https://jacksandersuperstar.com/api/jack-prime-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
const safetyError=()=>Object.assign(new Error('Image request rejected'),{statusCode:400,code:'moderation_blocked'});
const handler=options=>createImageHandler({verifyPricing:async()=>{},selectReference:async()=>defaultFaceReference,...options});

test('recognizes explicit provider safety signals through SDK wrappers',()=>{
  for(const error of [
    safetyError(),
    {cause:{code:'content_policy_violation'}},
    {responseBody:JSON.stringify({error:{code:'moderation_blocked'}})},
    new NoImageGeneratedError({calls:[{warnings:[{type:'content-filter'}]}],responses:[]}),
    new Error('Your request was rejected as a result of our safety system.')
  ])assert.equal(isImageSafetyRefusal(error),true);
});

test('does not label operational failures, empty output, or user text as inappropriate',()=>{
  const cycle={};cycle.cause=cycle;
  for(const error of [
    Object.assign(new Error('credits unavailable'),{statusCode:402}),
    Object.assign(new Error('request limit'),{statusCode:429}),
    new DOMException('Generation timed out','TimeoutError'),
    new NoImageGeneratedError({calls:[],responses:[]}),
    {prompt:'rejected as a result of our safety system',revisedPrompt:'content_policy_violation'},
    {responseBody:'not JSON'},cycle
  ])assert.equal(isImageSafetyRefusal(error),false);
});

test('refusal writer uses the approved model and text brief, without forwarding photo bytes',async()=>{
  let verified=0,options;
  const writer=createImageRefusalWriter({verifyPricing:async signal=>{assert.ok(signal instanceof AbortSignal);verified++;},generate:async value=>{options=value;return {output:{refusal:"ain't making that image.",reason:'it crosses the safety limits.'},finishReason:'stop'};}});
  const text=await writer({...body,photo:new Uint8Array([1,2,3])});
  assert.equal(text,"ain't making that image. it crosses the safety limits.");
  assert.equal(verified,1);assert.equal(options.model,model);assert.deepEqual(options.providerOptions,providerOptions);
  assert.equal(options.maxRetries,0);assert.equal(options.maxOutputTokens,64);assert.equal(options.tools,undefined);
  assert.match(options.instructions,/brief reason/);assert.match(options.instructions,/without inventing a category/i);
  assert.match(options.instructions,/Both parts are required/);assert.doesNotMatch(options.instructions,/call create_image/);
  const brief=JSON.parse(options.messages[0].content);
  assert.deepEqual(brief,{request:body.prompt,recentContext:body.context});
});

test('pricing failure never calls the model and empty replies do not become canned persona text',async()=>{
  let generated=0;
  const blocked=createImageRefusalWriter({verifyPricing:async()=>{throw new Error('unavailable');},generate:async()=>{generated++;}});
  assert.equal(await blocked(body),null);assert.equal(generated,0);
  const empty=createImageRefusalWriter({verifyPricing:async()=>{},generate:async()=>({output:{refusal:'not making that.',reason:''},finishReason:'stop'})});
  assert.equal(await empty(body),null);
});

test('blocked image retries share one generated refusal and keep no-store JSON',async()=>{
  let generations=0,refusals=0,release;
  const pending=new Promise(done=>{release=done;});
  const post=handler({generate:async()=>{generations++;await pending;throw safetyError();},writeRefusal:async parsed=>{refusals++;assert.equal(parsed.prompt,body.prompt);return "can't make that image with that content.";}});
  const first=post(request()),second=post(request());
  await new Promise(done=>setImmediate(done));assert.equal(generations,1);release();
  const responses=await Promise.all([first,second]);responses.push(await post(request()));
  for(const response of responses){
    assert.equal(response.status,422);assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.deepEqual(await response.json(),{code:'image_refused',reason:'content_safety',text:"can't make that image with that content."});
  }
  assert.equal(generations,1);assert.equal(refusals,1);
  assert.equal((await post(request({...body,prompt:'A different request'}))).status,409);
});

test('a blocked request still explains the known reason if generated wording is unavailable',async()=>{
  const post=handler({generate:async()=>{throw safetyError();},writeRefusal:async()=>null});
  const response=await post(request()),data=await response.json();
  assert.equal(response.status,422);assert.equal(data.reason,'content_safety');assert.equal(data.text,undefined);
  assert.match(data.error,/blocked.*content-safety/);
});

test('service failures state their cause without generating a safety refusal',async()=>{
  let refusals=0;
  const cases=[
    [Object.assign(new Error('credits'),{statusCode:402}),402,/credits/],
    [Object.assign(new Error('limit'),{statusCode:429}),429,/request limit/],
    [new DOMException('Timed out','TimeoutError'),504,/took too long/],
    [{cause:new DOMException('Aborted','AbortError')},504,/took too long/],
    [new NoImageGeneratedError({calls:[],responses:[]}),422,/returned no picture/],
    [Object.assign(new Error('invalid request'),{statusCode:400}),422,/could not accept/],
    [new Error('server unavailable'),503,/failed to return/]
  ];
  for(const [error,status,reason] of cases){
    const post=handler({generate:async()=>{throw error;},writeRefusal:async()=>{refusals++;return 'wrong';}});
    const response=await post(request()),data=await response.json();
    assert.equal(response.status,status);assert.match(data.error,reason);assert.equal(data.reason,undefined);
  }
  assert.equal(refusals,0);
});
