const abbreviations=new Set(['ft','feat','mr','mrs','ms','dr','jr','sr','vs','e.g','i.e']);
function sentenceParts(text) {
  const parts=[];let start=0;
  for(const match of text.matchAll(/[.!?]+(?:['"”’)\]]|\*\*|__)*\s+/g)){
    const word=text.slice(0,match.index).match(/[a-z.]+$/i)?.[0].toLowerCase();
    if(match[0].startsWith('.') && abbreviations.has(word)) continue;
    const end=match.index+match[0].length;
    parts.push({segment:text.slice(start,end)});start=end;
  }
  if(start<text.length) parts.push({segment:text.slice(start)});
  return parts;
}
const complete = text => /[.!?]['"”’)\]]*$/.test(text.replace(/\*\*|__/g,'').trim());
const greeting=/^(?:hi+|hey+|hello+|yo+|sup|wass?up|what['’]?s up|hi+ there|hey+ there)\s*[.!?]*$/i;
const acknowledgment=/^(?:fine|okay|ok|thanks|thank\s*you|thx|bet|cool|got\s*it)\s*[.!]*$/i;
const checkIn=/\b(?:how (?:are you|you (?:doin[g']?|been|feeling)|have you been)|how(?:['’]s| is) (?:it going|your day)|what(?:['’]s| is) (?:up|good|on your mind))\b/i;

export function instantReply(message) {
  const user=message.trim();
  if(greeting.test(user))return 'yo.';
  if(acknowledgment.test(user))return 'bet.';
  return null;
}

export function shortReply(text,finishReason='stop',lastUser='') {
  const normalized=text.trim().replace(/\s+/g,' ');
  const user=lastUser.trim();
  const isGreeting=greeting.test(user),isAcknowledgment=acknowledgment.test(user);
  // Old chat history can pull the model back into generic check-in questions.
  // Limit only standalone greetings/acknowledgments; real questions stay generative.
  if(isGreeting||isAcknowledgment){
    const first=sentenceParts(normalized)[0]?.segment.trim();
    if(!first||first.includes('?')||checkIn.test(first))return isGreeting?'yo.':'bet.';
    return shortReply(first.replace(/\bhi{2,}\b/gi,'hi').replace(/\bhey{2,}\b/gi,'hey').replace(/!+/g,'.'),finishReason);
  }
  const sentences=sentenceParts(normalized);
  const selected=sentences.slice(0,2);
  const incomplete=finishReason==='length' && selected.length===sentences.length && selected.length && !complete(selected.at(-1).segment);
  if(incomplete && selected.length>1) selected.pop();
  let reply=selected.map(part=>part.segment).join('').trim();
  if(incomplete && sentences.length===1) reply=reply.replace(/\s+\S*$/,'').trim()+'…';
  // A sentence boundary can occur immediately before a closing bold marker.
  for(const marker of ['**','__']) if(reply.split(marker).length%2===0) reply+=marker;
  return reply;
}
