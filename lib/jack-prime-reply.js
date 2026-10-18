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
export function taskReply(message) {
  const user=message.trim().replace(/[’]/g,"'");
  // Questions about the artist's interests or writing are not work requests.
  if(/\b(?:does|did|can|is|was|has|would|will)\s+(?:Jack(?:\s+Sander)?|he)\b/i.test(user))return null;
  const number='(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|hundred)';
  const arithmetic=new RegExp(`\\b${number}\\s*(?:[+*/^×÷−]|plus|minus|times|divided\\s+by|multiplied\\s+by)\\s*${number}\\b`,'i');
  const subtraction=new RegExp(`(?:^(?:please\\s+)?|\\b(?:what(?:'s|\\s+is)|calculate|compute|evaluate)\\s+)${number}\\s*-\\s*${number}\\s*(?:=\\s*)?[?.!]*$`,'i');
  const withoutDates=user.replace(/\b(?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/g,'date');
  const mathematics=/\b(?:algebra|calculus|geometry|trigonometry|arithmetic|quadratic|pythagorean|derivatives?|integrals?)\b|\b(?:math(?:s|ematics)?|equation)\s+(?:questions?|problems?|homework|help|solutions?)\b|\b(?:solve|simplify|factor|differentiate|integrate)\b.{0,70}(?:\b(?:equations?|for\s+[a-z]|[a-z]\s*(?:[=^]|squared))\b|[=^])|\b(?:do|help|solve|explain|teach|calculate|compute)\b.{0,50}\bmath(?:s|ematics)?\b/i;
  if(arithmetic.test(withoutDates)||subtraction.test(withoutDates)||mathematics.test(user))return "i don't do math problems. ask me about Jack.";
  const essay=/\b(?:write|draft|compose|generate|produce|create|do|make|give\s+me)\b.{0,80}\b(?:essays?|dissertations?|research\s+papers?|term\s+papers?|book\s+reports?)\b|\b(?:write|draft|compose|give\s+me)\b.{0,50}\b\d[\d,]*[ -]words?\b/i;
  if(essay.test(user))return "i don't write essays. i can keep it short about Jack, though.";
  return null;
}

export function shortReply(text,finishReason='stop') {
  const normalized=text.trim().replace(/\s+/g,' ');
  // Keep a missing fact brief even when old history pulls the model formal again.
  if(/^(?:i (?:do not|don['’]?t) have [^.!?]+ (?:confirmed|verified)|i (?:do not|don['’]?t) have (?:that|this|the) (?:information|info|detail)|i (?:cannot|can['’]?t) confirm (?:that|this)|(?:that|this|the) (?:information|info|detail) (?:is not|isn['’]?t) (?:publicly available|confirmed|verified))[.!]?$/i.test(normalized))return 'ion know';
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
