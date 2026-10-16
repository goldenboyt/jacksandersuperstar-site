import {generateImage,gateway,NoImageGeneratedError} from 'ai';

export const imageModel='openai/gpt-image-2.5-sunburst';
const reviewedPricing={input:'0.000005',output:'0.00003',input_cache_read:'0.00000125'};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const expectedPricing=JSON.stringify(canonical(reviewedPricing));
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const errorResponse=(message,status=400,extra={})=>Response.json({error:message},{status,headers:{...headers,...extra}});

export class ImagePricingBlocked extends Error {}
export function isApprovedImageModel(entry){
  return entry?.id===imageModel&&entry.type==='image'&&JSON.stringify(canonical(entry.pricing))===expectedPricing;
}
export async function verifyImagePricing(){
  const response=await fetch('https://ai-gateway.vercel.sh/v1/models',{cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw new Error('Image pricing lookup unavailable.');
  const catalog=await response.json();
  if(!Array.isArray(catalog.data)||!isApprovedImageModel(catalog.data.find(entry=>entry.id===imageModel)))throw new ImagePricingBlocked('Image pricing has changed.');
}
export function validateImageRequest(body){
  if(typeof body?.prompt!=='string'||!body.prompt.trim()||body.prompt.trim().length>1600)return null;
  if(typeof body.requestId!=='string'||body.requestId.length!==36||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId))return null;
  return {prompt:body.prompt.trim(),requestId:body.requestId.toLowerCase()};
}

// Each warm function instance retains a small retry cache. This avoids duplicate
// work in that instance, without claiming globally durable exactly-once billing.
export function createImageHandler({generate=generateImage,verifyPricing=verifyImagePricing,now=Date.now}={}){
  const jobs=new Map(),ttl=10*60*1000;
  const cleanup=()=>{
    for(const [id,job] of jobs)if(!job.pending&&now()-job.finished>ttl)jobs.delete(id);
    const completed=[...jobs].filter(([,job])=>!job.pending).sort((a,b)=>a[1].finished-b[1].finished);
    for(const [id] of completed.slice(0,Math.max(0,completed.length-8)))jobs.delete(id);
  };
  return async function POST(request){
    try{
      const origin=request.headers.get('origin');
      if(origin&&new URL(origin).host!==new URL(request.url).host)return errorResponse('Start this image on the site.',403);
    }catch{return errorResponse('Start this image on the site.',403);}
    if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return errorResponse('Send an image prompt as JSON.',415);
    if(Number(request.headers.get('content-length'))>20000)return errorResponse('Please shorten your image prompt.',413);
    let body;try{body=await request.json();}catch{return errorResponse('Tell me what image you want.');}
    const parsed=validateImageRequest(body);
    if(!parsed)return errorResponse('Describe your image in 1,600 characters or fewer.');
    if(request.signal.aborted)return errorResponse('The image request was stopped.',499);
    cleanup();
    let job=jobs.get(parsed.requestId);
    if(job&&job.prompt!==parsed.prompt)return errorResponse('Please send this as a new image request.',409);
    if(!job){
      if([...jobs.values()].filter(item=>item.pending).length>=3)return errorResponse('Images are busy right now. Try again shortly.',429,{'Retry-After':'5'});
      job={prompt:parsed.prompt,pending:true,finished:0};
      jobs.set(parsed.requestId,job);
      job.promise=(async()=>{
        await verifyPricing();
        // Do not tie an already submitted generation to the browser disconnect:
        // retaining its result can satisfy a manual retry without another call.
        const result=await generate({model:gateway.image(imageModel),prompt:parsed.prompt,n:1,size:'1024x1024',maxRetries:0,abortSignal:AbortSignal.timeout(155000),providerOptions:{openai:{quality:'high',outputFormat:'png'}}});
        if(result.images?.length!==1||result.image?.mediaType!=='image/png')throw new Error('Unexpected image response.');
        const bytes=result.image.uint8Array;
        const signature=[137,80,78,71,13,10,26,10];
        if(!(bytes instanceof Uint8Array)||bytes.length<signature.length||bytes.length>4400000||!signature.every((byte,index)=>bytes[index]===byte))throw new Error('Image response could not be delivered.');
        console.info('Jack Prime image',{model:imageModel,requestId:parsed.requestId,bytes:bytes.length,pricing:'verified-image',images:1});
        return bytes;
      })();
      // Finish bookkeeping even when the requesting browser has gone away.
      job.promise=job.promise.finally(()=>{job.pending=false;job.finished=now();cleanup();});
    }
    try{
      const bytes=await job.promise;
      return new Response(bytes,{headers:{...headers,'Content-Type':'image/png','Content-Disposition':'inline; filename="jack-prime.png"'}});
    }catch(error){
      jobs.delete(parsed.requestId);
      if(error instanceof ImagePricingBlocked)return errorResponse('Images are taking a break. Please check back later.',402);
      const providerStatus=error.statusCode??error.cause?.statusCode;
      console.error('Jack Prime image failed',{name:error.name,status:providerStatus,requestId:parsed.requestId});
      if(providerStatus===402)return errorResponse('Image credits are unavailable right now.',402);
      if(providerStatus===429)return errorResponse('Images are busy right now. Try again shortly.',429,{'Retry-After':'5'});
      if(providerStatus===400||NoImageGeneratedError.isInstance(error))return errorResponse('That image could not be made. Try a different description.',422);
      return errorResponse('The image could not finish. Try again in a moment.',503);
    }
  };
}
