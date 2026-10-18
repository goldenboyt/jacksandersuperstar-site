import {generateText} from 'ai';
import {instructions,model,providerOptions,validateMessages} from './jack-prime.js';
import {ModelPricingBlocked,verifyModelPricing,tokenPriceCeilings} from './jack-prime-cost.js';
import {taskReply,shortReply} from './jack-prime-reply.js';
import {resolveSongMentions} from './jack-prime-songs.js';
import {uploadedPhoto,withPhoto} from './jack-prime-media.js';

const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const errorResponse=(error,status=400,extra={})=>Response.json({error},{status,headers:{...headers,...extra}});

export function createChatHandler({generate=generateText,verifyPricing=verifyModelPricing}={}){
  return async function POST(request){
    try{
      if(request.headers.get('origin')&&new URL(request.headers.get('origin')).host!==new URL(request.url).host)throw new Error('Other origin');
    }catch{return errorResponse('This conversation must start on the site.',403)}
    let body,photo;
    const multipart=request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data');
    if(Number(request.headers.get('content-length'))>(multipart?2300000:60000))return errorResponse('Please use a smaller image or shorter message.',413);
    try{
      if(multipart){
        const form=await request.formData();body={messages:JSON.parse(form.get('messages'))};photo=await uploadedPhoto(form.get('photo'));
      }else body=await request.json();
    }catch{return errorResponse('Send a message and a JPEG, PNG, or WebP image.')}
    const messages=validateMessages(body);
    if(!messages)return errorResponse('Please shorten your message or start a new conversation.');
    const lastUser=messages.at(-1).content;
    const declinedTask=taskReply(lastUser);
    if(declinedTask)return Response.json({text:declinedTask},{headers});
    try{
      await verifyPricing(request.signal);
      const result=await generate({model,providerOptions,instructions,messages:withPhoto(messages,photo),maxOutputTokens:96,maxRetries:0,abortSignal:AbortSignal.any([request.signal,AbortSignal.timeout(25000)])});
      const text=shortReply(result.text,result.finishReason);
      if(!text)throw new Error('Empty reply');
      console.info('Jack Prime reply',{model,resolvedModel:result.finalStep.response?.modelId??model,provider:result.finalStep.providerMetadata?.gateway?.routing?.finalProvider,generationId:result.finalStep.providerMetadata?.gateway?.generationId??result.finalStep.response.id,inputTokens:result.usage.inputTokens,outputTokens:result.usage.outputTokens,photo:Boolean(photo),pricing:'verified-capped',estimatedBaseTokenCostUsd:result.usage.inputTokens*tokenPriceCeilings.input+result.usage.outputTokens*tokenPriceCeilings.output});
      const songs=resolveSongMentions(text,lastUser);
      return Response.json({text,...(songs.length?{songs}:{})},{headers});
    }catch(error){
      if(error instanceof ModelPricingBlocked)return errorResponse('Jack Prime is taking a break. Please check back later.',402);
      if(error.statusCode===429){
        const seconds=Math.min(60,Math.max(1,Number(String(error.message).match(/Retry after (\d+)s/i)?.[1])||60));
        console.warn('Jack Prime temporarily busy',{status:429,retryAfter:seconds});
        return errorResponse(`give me a moment. try again in ${seconds} seconds.`,429,{'Retry-After':String(seconds)});
      }
      console.error('Jack Prime request failed',{name:error.name,status:error.statusCode});
      if(photo&&error.statusCode===400)return errorResponse("that image couldn't be read. try a JPEG or PNG.");
      return errorResponse("Can't reach Jack Prime right now. Try again in a moment.",503);
    }
  };
}
