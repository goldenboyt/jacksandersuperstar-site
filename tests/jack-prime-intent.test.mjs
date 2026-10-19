import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatHandler} from '../lib/jack-prime-chat.js';

const result={text:'',finishReason:'tool-calls',toolCalls:[{toolName:'create_image',input:{}}],usage:{inputTokens:100,outputTokens:8},finalStep:{providerMetadata:{gateway:{generationId:'test-image-intent'}}}};
const messages=[{role:'user',content:'Draw Jack in a supermarket.'},{role:'assistant',content:'[Generated image for: "Draw Jack in a supermarket."]'},{role:'user',content:'make it weirder'}];
const request=body=>new Request('https://jacksandersuperstar.com/api/jack-prime',{method:'POST',headers:{Origin:'https://jacksandersuperstar.com',...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body)});

test('a model image decision returns one action and keeps the original request and history',async()=>{
 let calls=0,priced=0,options;
 const handler=createChatHandler({verifyPricing:async()=>{priced++},generate:async value=>{calls++;options=value;return {...result,text:'unneeded acknowledgment',toolCalls:[...result.toolCalls,...result.toolCalls]}}});
 const response=await handler(request({messages}));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{action:'image'});
 assert.equal(calls,1);assert.equal(priced,1);assert.deepEqual(options.messages,messages);
 assert.equal(options.tools.create_image.execute,undefined);
});

test('image requests with a photo retain the actual upload for the model decision',async()=>{
 const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
 const form=new FormData();form.set('messages',JSON.stringify([{role:'user',content:'take the background out of this'}]));form.set('photo',new Blob([bytes],{type:'image/png'}),'reference.png');
 let options;
 const response=await createChatHandler({verifyPricing:async()=>{},generate:async value=>{options=value;return result}})(request(form));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{action:'image'});
 assert.deepEqual(options.messages[0].content,[{type:'text',text:'take the background out of this'},{type:'file',mediaType:'image/png',data:bytes}]);
});

test('normal text and song previews are preserved; invalid or unknown tool calls do not start images',async()=>{
 for(const toolCalls of [[],[{toolName:'create_image',invalid:true}],[{toolName:'unknown',input:{}}]]){
  const handler=createChatHandler({verifyPricing:async()=>{},generate:async()=>({...result,text:'try **cybertruck**.',toolCalls,finishReason:'stop'})});
  const response=await handler(request({messages:[{role:'user',content:'What should I listen to?'}]}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{text:'try **cybertruck**.',songs:[{releasePage:'/cybertruck',trackIndex:0}]});
 }
});

test('questions about an image stay in chat even after a generated image',async()=>{
 for(const content of ["What's different about the image?",'Can you explain this photo?','Why does he have three arms?']){
  let options;
  const handler=createChatHandler({verifyPricing:async()=>{},generate:async value=>{options=value;return {...result,text:'the proportions changed.',toolCalls:[],finishReason:'stop'}}});
  const response=await handler(request({messages:[...messages.slice(0,2),{role:'user',content}]}));
  assert.deepEqual(await response.json(),{text:'the proportions changed.'});assert.equal(options.toolChoice,'none');
 }
});
