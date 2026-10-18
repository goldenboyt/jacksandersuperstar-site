import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {photoMediaType,withPhoto} from '../lib/jack-prime-media.js';
import {createChatHandler} from '../lib/jack-prime-chat.js';
import {createImageHandler as imageHandler} from '../lib/jack-prime-images.js';
import {defaultFaceReference} from '../lib/jack-prime-references.js';
const createImageHandler=options=>imageHandler({selectReference:async()=>defaultFaceReference,...options});

const photo=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
const artist=readFileSync(new URL('../lib/references/jack-portrait-front.jpg',import.meta.url));
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
  assert.equal(options.model,'spacexai/grok-4.20-non-reasoning');assert.deepEqual(options.providerOptions,{gateway:{only:['xai']}});assert.equal(options.reasoning,undefined);assert.equal(options.maxOutputTokens,96);assert.equal(options.maxRetries,0);
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

test('unrelated image ideas generate once with their subject preserved and a visible Jack connection',async()=>{
  let priced=0,generated=0,options;
  const image={mediaType:'image/png',uint8Array:photo};
  const prompt='Draw a watercolor portrait of a golden retriever for grandma';
  const context='Keep the soft colors. Remove all Jack branding.';
  const handler=createImageHandler({verifyPricing:async()=>{priced++},generate:async value=>{generated++;options=value;return {image,images:[image]}}});
  for(let retry=0;retry<2;retry++){
    const response=await handler(request('/api/jack-prime-image',{prompt,context,requestId:id}));
    assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'image/png');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),photo);
  }
  assert.equal(priced,1);assert.equal(generated,1);
  assert.deepEqual(options.prompt.images,[artist]);assert.equal(photoMediaType(artist),'image/jpeg');
  assert.ok(options.prompt.text.includes(JSON.stringify(prompt)));assert.ok(options.prompt.text.includes(JSON.stringify(context)));
  assert.match(options.prompt.text,/#jacksandersuperstar® wordmark/);
  assert.match(options.prompt.text,/Jack's recognizable face from the supplied portrait/);
  assert.match(options.prompt.text,/identity reference, not an image to edit or recreate/);
  assert.match(options.prompt.text,/Keep the requested subject central/);
  assert.match(options.prompt.text,/cannot remove this Jack connection/);
});

test('general photo edits pass actual reference bytes, and changed photos or context cannot reuse a request ID',async()=>{
  let options;
  const image={mediaType:'image/png',uint8Array:photo};
  const handler=createImageHandler({verifyPricing:async()=>{},generate:async value=>{options=value;return {image,images:[image]}}});
  const fields={prompt:'make the background a sunset',context:'keep the subject recognizable',requestId:id};
  assert.equal((await handler(request('/api/jack-prime-image',form(fields)))).status,200);
  assert.deepEqual(options.prompt.images,[photo,artist]);assert.ok(options.prompt.text.includes(JSON.stringify(fields.prompt)));
  assert.match(options.prompt.text,/#jacksandersuperstar® wordmark/);
  assert.match(options.prompt.text,/Reference image 1 is the visitor's image to edit/);
  assert.match(options.prompt.text,/Reference image 2 is Jack's selected identity portrait/);
  assert.match(options.prompt.text,/Do not replace the visitor's face or another person's identity with Jack unless the visitor explicitly requests/);
  assert.match(options.prompt.text,/preserving the recognizable subject and composition/);
  assert.equal((await handler(request('/api/jack-prime-image',form({...fields,context:'different artwork'})))).status,409);
  const changedPhoto=Uint8Array.from(photo);changedPhoto[changedPhoto.length-1]^=1;
  assert.equal((await handler(request('/api/jack-prime-image',form(fields,changedPhoto)))).status,409);
});
