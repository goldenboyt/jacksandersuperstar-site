import {generateText} from 'ai';
import {instructions,model,validateMessages} from '../lib/jack-prime.js';

const headers = {'Cache-Control':'no-store'};
export async function POST(request) {
  try {
    if (request.headers.get('origin') && new URL(request.headers.get('origin')).host !== new URL(request.url).host) throw new Error('Other origin');
  } catch { return Response.json({error:'This conversation must start on the site.'},{status:403,headers}); }
  let body;
  try { body = await request.json(); } catch { return Response.json({error:'Please send a message.'},{status:400,headers}); }
  const messages = validateMessages(body);
  if (!messages) return Response.json({error:'Please shorten your message or start a new conversation.'},{status:400,headers});
  try {
    const result = await generateText({model, instructions, messages, reasoning:'none', maxOutputTokens:280, maxRetries:0, abortSignal:AbortSignal.any([request.signal,AbortSignal.timeout(25000)])});
    if (!result.text.trim()) throw new Error('Empty reply');
    return Response.json({text:result.text.trim()},{headers});
  } catch (error) {
    console.error('Jack Prime request failed', {name:error.name, status:error.statusCode, message:String(error.message).slice(0,500)});
    return Response.json({error:"Can't reach Jack Prime right now. Try again in a moment."},{status:503,headers});
  }
}
