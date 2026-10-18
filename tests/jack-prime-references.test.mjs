import test from 'node:test';
import assert from 'node:assert/strict';
import {faceReferences,faceReference,faceReferenceImage,createReferenceSelector,defaultFaceReference} from '../lib/jack-prime-references.js';
import {createImageHandler} from '../lib/jack-prime-images.js';
import {ModelPricingBlocked} from '../lib/jack-prime-cost.js';
import {model,providerOptions} from '../lib/jack-prime.js';

const id='d6c27f5e-d95d-4df5-b188-0629cc362953';
const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,0,1,2,3]);
const generated={image:{mediaType:'image/png',uint8Array:bytes},images:[{mediaType:'image/png',uint8Array:bytes}]};
const request=body=>new Request('https://jacksandersuperstar.com/api/jack-prime-image',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://jacksandersuperstar.com'},body:JSON.stringify(body)});

test('three distinct real JPEG references are available, with a safe neutral default',()=>{
  assert.equal(faceReferences.length,3);assert.equal(new Set(faceReferences.map(r=>r.id)).size,3);
  const photos=faceReferences.map(r=>faceReferenceImage(r.id));
  for(const photo of photos){assert.equal(photo[0],255);assert.equal(photo[1],216);assert.ok(photo.length>10000)}
  assert.notDeepEqual(photos[0],photos[1]);assert.notDeepEqual(photos[1],photos[2]);
  assert.equal(faceReference('../../etc/passwd'),defaultFaceReference);
});

test('selection uses bounded creative context and only the approved model after price verification',async()=>{
  const order=[];let options;
  const choose=createReferenceSelector({verifyPricing:async()=>{order.push('pricing')},generate:async value=>{order.push('model');options=value;return {output:'wide-eyed-smile',usage:{inputTokens:200,outputTokens:8}}}});
  const parsed={prompt:'Make Jack look surprised.',context:'x'.repeat(6000),requestId:id};
  assert.equal((await choose(parsed)).id,'wide-eyed-smile');assert.deepEqual(order,['pricing','model']);
  assert.equal(options.model,model);assert.deepEqual(options.providerOptions,providerOptions);
  assert.equal(options.maxRetries,0);assert.equal(options.maxOutputTokens,32);assert.ok(options.abortSignal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(options.prompt),{request:parsed.prompt,recentContext:'x'.repeat(1600)});
});

test('routing failures and invalid choices fall back without a second paid call',async()=>{
  for(const output of ['../../etc/passwd','another-face',undefined]){
    let calls=0;const choose=createReferenceSelector({verifyPricing:async()=>{},generate:async()=>{calls++;return {output}}});
    assert.equal(await choose({prompt:'anything'}),defaultFaceReference);assert.equal(calls,1);
  }
  let calls=0;const choose=createReferenceSelector({verifyPricing:async()=>{},generate:async()=>{calls++;throw new Error('offline')}});
  assert.equal(await choose({prompt:'anything'}),defaultFaceReference);assert.equal(calls,1);
});

test('unapproved routing prices never trigger a text model call',async()=>{
  let calls=0;const choose=createReferenceSelector({verifyPricing:async()=>{throw new ModelPricingBlocked()},generate:async()=>{calls++;return {output:'tilted-closeup'}}});
  assert.equal(await choose({prompt:'a tilted selfie'}),defaultFaceReference);assert.equal(calls,0);
});

test('only the chosen portrait reaches image generation and manual retries reuse its selection',async()=>{
  let selections=0,generations=0,options;
  const handler=createImageHandler({verifyPricing:async()=>{},selectReference:async parsed=>{selections++;assert.equal(parsed.prompt,'An angled portrait');return faceReference('tilted-closeup')},generate:async value=>{generations++;options=value;return generated}});
  const body={requestId:id,prompt:'An angled portrait'};
  assert.equal((await handler(request(body))).status,200);assert.equal((await handler(request(body))).status,200);
  assert.equal(selections,1);assert.equal(generations,1);assert.deepEqual(options.prompt.images,[faceReferenceImage('tilted-closeup')]);
});

test('visitor photo stays first and cover templates bypass artist-reference routing',async()=>{
  const photo=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
  let selections=0,options;
  const handler=createImageHandler({verifyPricing:async()=>{},selectReference:async()=>{selections++;return faceReference('wide-eyed-smile')},generate:async value=>{options=value;return generated}});
  const form=new FormData();form.set('requestId',id);form.set('prompt','Put Jack next to this person');form.set('photo',new Blob([photo],{type:'image/png'}),'visitor.png');
  assert.equal((await handler(new Request('https://jacksandersuperstar.com/api/jack-prime-image',{method:'POST',body:form}))).status,200);
  assert.deepEqual(options.prompt.images,[photo,faceReferenceImage('wide-eyed-smile')]);assert.equal(selections,1);
  assert.equal((await handler(request({requestId:'94bb3730-09af-4034-b6f1-dac66f1e179d',template:'superstar',text:'my cover'}))).status,200);
  assert.equal(selections,1);assert.equal(options.prompt.images.length,1);
});
