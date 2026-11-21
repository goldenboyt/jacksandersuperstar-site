import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatHandler} from '../lib/jack-prime-chat.js';
const request=()=>new Request('https://jacksandersuperstar.com/api/jack-prime',{method:'POST',headers:{'Content-Type':'application/json','X-Prime-Stream':'1'},body:JSON.stringify({messages:[{role:'user',content:'Tell me about magic (tragic)'}]})});
const handlerFor=parts=>createChatHandler({verifyPricing:async()=>{},stream:()=>({fullStream:(async function*(){for(const p of parts)yield p})(),finishReason:Promise.resolve('stop'),usage:Promise.resolve({inputTokens:12,outputTokens:8})})});
test('streams partial updates and returns final text with song metadata',async()=>{const r=await handlerFor([{type:'text-delta',text:'magic '},{type:'text-delta',text:'(tragic) is a vibe.'}])(request());assert.equal(r.status,200);const lines=(await r.text()).trim().split('\n').map(JSON.parse);assert.equal(lines[0].text,'magic');assert.equal(lines.at(-1).text,'magic (tragic) is a vibe.');assert.ok(lines.at(-1).songs.length>0)});
test('image tool remains an image action, without leaking earlier text into the final response',async()=>{const r=await handlerFor([{type:'text-delta',text:'making it'},{type:'tool-call',toolName:'create_image',invalid:false}])(request());const lines=(await r.text()).trim().split('\n').map(JSON.parse);assert.deepEqual(lines.at(-1),{type:'done',action:'image'})});
test('stream errors send a usable error without a false successful reply',async()=>{const r=await handlerFor([{type:'error',error:new Error('failure')}])(request());const lines=(await r.text()).trim().split('\n').map(JSON.parse);assert.equal(lines.at(-1).type,'error');assert.ok(!lines.some(line=>line.type==='done'))});

test('uses the installed SDK stream format end to end',async()=>{
  const {streamText,simulateReadableStream}=await import('ai');
  const {MockLanguageModelV4}=await import('ai/test');
  const model=new MockLanguageModelV4({doStream:async()=>({stream:simulateReadableStream({chunks:[
    {type:'text-start',id:'t'}, {type:'text-delta',id:'t',delta:'magic '}, {type:'text-delta',id:'t',delta:'(tragic) hits.'}, {type:'text-end',id:'t'},
    {type:'finish',finishReason:{unified:'stop',raw:undefined},usage:{inputTokens:{total:10,noCache:10,cacheRead:undefined,cacheWrite:undefined},outputTokens:{total:4,text:4,reasoning:undefined}}}
  ]})})});
  const handler=createChatHandler({verifyPricing:async()=>{},stream:options=>streamText({...options,model})});
  const response=await handler(request());const lines=(await response.text()).trim().split('\n').map(JSON.parse);
  assert.ok(lines.filter(x=>x.type==='text').length>=2);assert.equal(lines.at(-1).text,'magic (tragic) hits.');
});
