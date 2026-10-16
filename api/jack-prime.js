import {generateText} from 'ai';
import {instructions,model,validateMessages} from '../lib/jack-prime.js';
import {ModelPricingBlocked,verifyModelPricing,tokenPriceCeilings} from '../lib/jack-prime-cost.js';
import {instantReply,shortReply} from '../lib/jack-prime-reply.js';

const headers = {'Cache-Control':'no-store'};
export async function POST(request) {
  try {
    if (request.headers.get('origin') && new URL(request.headers.get('origin')).host !== new URL(request.url).host) throw new Error('Other origin');
  } catch { return Response.json({error:'This conversation must start on the site.'},{status:403,headers}); }
  let body;
  try { body = await request.json(); } catch { return Response.json({error:'Please send a message.'},{status:400,headers}); }
  const messages = validateMessages(body);
  if (!messages) return Response.json({error:'Please shorten your message or start a new conversation.'},{status:400,headers});
  // Routine greetings need neither model quota nor a pricing lookup.
  const instant=instantReply(messages.at(-1).content);
  if(instant)return Response.json({text:instant},{headers});
  try {
    await verifyModelPricing(request.signal);
    const result = await generateText({model, instructions, messages, reasoning:'none', maxOutputTokens:96, maxRetries:0, abortSignal:AbortSignal.any([request.signal,AbortSignal.timeout(25000)])});
    const text=shortReply(result.text,result.finishReason,messages.at(-1).content);
    if (!text) throw new Error('Empty reply');
    console.info('Jack Prime reply', {model, generationId:result.finalStep.providerMetadata?.gateway?.generationId ?? result.finalStep.response.id, inputTokens:result.usage.inputTokens, outputTokens:result.usage.outputTokens, pricing:'verified-capped', estimatedBaseTokenCostUsd:result.usage.inputTokens*tokenPriceCeilings.input+result.usage.outputTokens*tokenPriceCeilings.output});
    return Response.json({text},{headers});
  } catch (error) {
    if (error instanceof ModelPricingBlocked) return Response.json({error:'Jack Prime is taking a break. Please check back later.'},{status:402,headers});
    if (error.statusCode === 429) {
      const seconds=Math.min(60,Math.max(1,Number(String(error.message).match(/Retry after (\d+)s/i)?.[1])||60));
      console.warn('Jack Prime temporarily busy',{status:429,retryAfter:seconds});
      return Response.json({error:`give me a moment. try again in ${seconds} seconds.`},{status:429,headers:{...headers,'Retry-After':String(seconds)}});
    }
    console.error('Jack Prime request failed', {name:error.name, status:error.statusCode, message:String(error.message).slice(0,500)});
    return Response.json({error:"Can't reach Jack Prime right now. Try again in a moment."},{status:503,headers});
  }
}
