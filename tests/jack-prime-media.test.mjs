import test from 'node:test';
import assert from 'node:assert/strict';
import {photoMediaType,withPhoto,isJackImage,imageDecline} from '../lib/jack-prime-media.js';
import {createChatHandler} from '../lib/jack-prime-chat.js';
import {createImageHandler} from '../lib/jack-prime-images.js';

const photo=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
const id='d6c27f5e-d95d-4df5-b188-0629cc362953';
const host='https://jacksandersuperstar.com';
const request=(path,body)=>new Request(host+path,{method:'POST',headers:{Origin:host,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body)});
function form(fields,bytes=photo){const value=new FormData();for(const [key,item]of Object.entries(fields))value.set(key,item);if(bytes)value.set('photo',new Blob([bytes],{type:'image/png'}),'reference.png');return value;}
const reply={text:'That tee has the white Superstar wordmark.',finishReason:'stop',usage:{inputTokens:100,outputTokens:12},finalStep:{providerMetadata:{gateway:{generationId:'test-vision'}}}};

test('uploaded images enter only the latest model message as a binary file',()=>{
  const messages=[{role:'user',content:'earlier question'},{role:'assistant',content:'earlier answer'},{role:'user',content:'what does this say?'}];
  const result=withPhoto(messages,photo);
  assert.equal(photoMediaType(photo),'image/png');assert.deepEqual(result.slice(0,2),messages.slice(0,2));
  assert.deepEqual(result.at(-1).content,[{type:'text',text:'what does this say?'},{type:'file',mediaType:'image/png',data:photo}]);
  assert.equal(messages.at(-1).content,'what does this say?');
});

test('photo questions reach the vision-capable chat model and keep the short response contract',async()=>{
  let options,priced=0;
  const handler=createChatHandler({verifyPricing:async()=>{priced++},generate:async value=>{options=value;return reply}});
  const response=await handler(request('/api/jack-prime',form({messages:JSON.stringify([{role:'user',content:'what does this say?'}])})));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{text:reply.text});assert.equal(priced,1);
  assert.equal(options.model,'openai/gpt-6-luna');assert.equal(options.maxOutputTokens,96);assert.equal(options.maxRetries,0);
  assert.deepEqual(options.messages.at(-1).content[1].data,photo);
});

test('invalid uploads and photographed-math text requests cannot start a model call',async()=>{
  let calls=0;const handler=createChatHandler({verifyPricing:async()=>{calls++},generate:async()=>{calls++;return reply}});
  for(const bytes of [new Uint8Array(32),new Uint8Array(2100001)]){
    const response=await handler(request('/api/jack-prime',form({messages:JSON.stringify([{role:'user',content:'look at this'}])},bytes)));assert.equal(response.status,400);
  }
  const response=await handler(request('/api/jack-prime',form({messages:JSON.stringify([{role:'user',content:'solve my math problem'}])})));
  assert.match((await response.json()).text,/don't do math/);assert.equal(calls,0);
});

test('scope classification uses the pinned model, photo, and follow-up context',async()=>{
  let options,priced=0;
  const deps={verifyPricing:async()=>{priced++},generate:async value=>{options=value;return {output:'related'}}};
  assert.equal(await isJackImage({prompt:'make it darker',context:'user: make a Superstar album poster',photo},deps),true);
  assert.equal(priced,1);assert.equal(options.model,'openai/gpt-6-luna');assert.equal(options.maxRetries,0);
  assert.match(options.messages[0].content[0].text,/Superstar album poster/);assert.deepEqual(options.messages[0].content[1].data,photo);
  assert.equal(await isJackImage({prompt:'unrelated wallpaper'},{...deps,generate:async()=>({output:'unrelated'})}),false);
  await assert.rejects(isJackImage({prompt:'a poster'},{...deps,verifyPricing:async()=>{throw new Error('price blocked')}}),/price blocked/);
});

test('unrelated image requests return a conversational decline without image generation or duplicate classification',async()=>{
  let checked=0,generated=0;
  const handler=createImageHandler({verifyPricing:async()=>{},allowImage:async()=>{checked++;return false},generate:async()=>{generated++;throw new Error('must not create')}});
  for(let retry=0;retry<2;retry++){
    const response=await handler(request('/api/jack-prime-image',{prompt:'a random landscape wallpaper',requestId:id}));
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{declined:true,text:imageDecline});
  }
  assert.equal(checked,1);assert.equal(generated,0);
});

test('general photo edits pass actual reference bytes, and changed photos or context cannot reuse a request ID',async()=>{
  let options;
  const image={mediaType:'image/png',uint8Array:photo};
  const handler=createImageHandler({verifyPricing:async()=>{},allowImage:async parsed=>{assert.deepEqual(parsed.photo,photo);return true},generate:async value=>{options=value;return {image,images:[image]}}});
  const fields={prompt:'put this on a Jack concert poster',context:'fan artwork',requestId:id};
  assert.equal((await handler(request('/api/jack-prime-image',form(fields)))).status,200);
  assert.deepEqual(options.prompt.images,[photo]);assert.match(options.prompt.text,/Jack concert poster/);
  assert.equal((await handler(request('/api/jack-prime-image',form({...fields,context:'different artwork'})))).status,409);
});
