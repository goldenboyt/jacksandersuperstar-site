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

export function shortReply(text,finishReason='stop') {
  const normalized=text.trim().replace(/\s+/g,' ');
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
