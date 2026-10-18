import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageHandler,imageGenerationPrompt} from '../lib/jack-prime-images.js';
import {createReferenceSelector,imageReference,faceReferenceImage,faceReferences} from '../lib/jack-prime-references.js';
import {sobodaReferenceImages,sobodaLore} from '../lib/jack-prime-soboda.js';

const id='d6c27f5e-d95d-4df5-b188-0629cc362953';
const photo=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
const generated={image:{mediaType:'image/png',uint8Array:photo},images:[{mediaType:'image/png',uint8Array:photo}]};

test('a Soboda image uses its actual archive artwork instead of an artist portrait',async()=>{
  let options,selected=0;
  const handler=createImageHandler({verifyPricing:async()=>{},selectReference:async()=>{selected++;return imageReference('soboda')},generate:async value=>{options=value;return generated}});
  const response=await handler(new Request('https://jacksandersuperstar.com/api/jack-prime-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:id,prompt:'Make a Soboda in the forest'})}));
  assert.equal(response.status,200);assert.equal(selected,1);assert.deepEqual(options.prompt.images,sobodaReferenceImages());
  assert.equal(options.prompt.images.length,2);assert.notDeepEqual(options.prompt.images[0],faceReferenceImage('straight-on'));
  assert.equal(faceReferences.length,3);
});

test('Soboda plus Jack keeps the two subjects references distinct and retains an uploaded photo first',()=>{
  for(const reference of faceReferences){
    const plan=imageReference(`soboda-${reference.id}`);
    const prompt=imageGenerationPrompt({prompt:'Put Jack next to Soboda in this photo',photo},plan);
    assert.deepEqual(prompt.images,[photo,...sobodaReferenceImages(),faceReferenceImage(reference.id)]);
  }
});

test('a routing outage still gives explicit and contextual Soboda requests their canonical reference',async()=>{
  let calls=0;const select=createReferenceSelector({verifyPricing:async()=>{throw new Error('offline')},generate:async()=>{calls++}});
  for(const prompt of ['Make a Soboda','A Sobota creature','Draw the Sabota'])assert.equal((await select({prompt})).id,'soboda');
  assert.equal((await select({prompt:'Now put it in a cave',context:'user: Draw a Soboda'})).id,'soboda');
  assert.equal((await select({prompt:'Jack riding the Soboda'})).id,'soboda-straight-on');
  assert.equal((await select({prompt:'Make a portrait of Jack alone',context:'user: Draw a Soboda'})).id,'straight-on');
  assert.equal(calls,0);
});

test('the archive facts point to the existing creature page and the separate song destination',()=>{
  assert.equal(sobodaLore.archive,'/soboda');assert.equal(sobodaLore.song.href,'/prodigygenius#track-7');
  for(const bytes of sobodaReferenceImages()){assert.equal(Buffer.from(bytes.subarray(0,4)).toString(),'RIFF');assert.ok(bytes.length>1000)}
});
