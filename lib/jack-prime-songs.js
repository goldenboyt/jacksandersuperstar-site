import {readFileSync} from 'node:fs';

// Share the published catalog with the player, including its exact preview order.
const catalogSource=readFileSync(new URL('../release-data.js',import.meta.url),'utf8');
const catalog=JSON.parse(catalogSource.replace(/^\s*window\.SuperstarCatalog\s*=\s*/,'').replace(/;\s*$/,''));
const normalize=value=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/['’‘]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\b(?:feat|featuring)\b/g,'ft');
const withoutFeature=title=>title.replace(/\s*[([]\s*(?:ft|feat|featuring)\.?\s+[^)\]]*[)\]]/gi,'').trim();
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const visibleContent=value=>value.replace(/\]\([^\s)]+\)/g,']').replace(/https?:\/\/[^\s<>()]+|\/[a-z][a-z0-9#/?&=._%-]*/gi,' ');
const musicContext=/\b(?:songs?|tracks?|albums?|singles?|music|listen(?:ing)?|stream(?:ing)?|playlists?|previews?|play(?:ing)?|replay|lyrics?|verse|chorus|hooks?|beats?|banger|catalog|records?|mixtape|discography)\b/i;
// These also occur naturally in conversations unrelated to the catalog.
const ambiguous=new Set(['bb','swag','designer','breathe','spend it','kill you','idgaf','omg','brainstorm','cybertruck','leprechaun','around the town','no wings','sexy party','soboda']);

function hasPreview(value){
  if(typeof value!=='string')return false;
  // Cats Cash is an existing same-site preview, rather than an Apple preview.
  if(/^\/?assets\/previews\/[a-z0-9-]+\.m4a$/.test(value))return true;
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&url.hostname==='audio-ssl.itunes.apple.com'&&!url.username&&!url.password;
  }catch{return false;}
}

function markedTitles(text){
  const titles=new Set();
  for(const match of text.matchAll(/\*\*([^*\n]+)\*\*|["“]([^"”\n]+)["”]|(?:^|[\s(])['‘]([^'’\n]+)['’](?=$|[\s.,!?;)])/g)){
    const title=match[1]??match[2]??match[3];
    titles.add(normalize(title));
    titles.add(normalize(withoutFeature(title)));
  }
  return titles;
}

export function resolveSongMentions(text,lastUser='',releases=catalog.releases){
  if(typeof text!=='string'||!text.trim()||!Array.isArray(releases))return [];
  const normalized=normalize(visibleContent(text));
  const marked=markedTitles(text);
  const hasMusicContext=musicContext.test(text)||musicContext.test(lastUser);
  const albums=new Set(releases.filter(release=>release.type==='album').map(release=>normalize(release.title)));
  const tracks=new Map();

  for(const release of releases){
    if(typeof release.page!=='string'||!Array.isArray(release.tracks)||!Array.isArray(release.previews))continue;
    if(!/^[a-z0-9-]+$/.test(release.page))continue;
    release.tracks.forEach((title,trackIndex)=>{
      if(typeof title!=='string'||!hasPreview(release.previews[trackIndex]))return;
      const key=normalize(withoutFeature(title));
      if(!key)return;
      const aliases=[...new Set([key,normalize(title)])];
      const existing=tracks.get(key);
      const track={releasePage:`/${release.page}`,trackIndex,single:release.type==='single',aliases,destinations:[`/${release.page}#track-${trackIndex+1}`]};
      if(!existing)tracks.set(key,track);
      else{
        const chosen=track.single&&!existing.single?track:existing;
        chosen.aliases=[...new Set([...existing.aliases,...aliases])];
        chosen.destinations=[...new Set([...existing.destinations,...track.destinations])];
        tracks.set(key,chosen);
      }
    });
  }

  const found=[];
  for(const [key,track] of tracks){
    const matches=track.aliases.flatMap(alias=>[...normalized.matchAll(new RegExp(`(?:^| )${escape(alias)}(?= |$)`,'g'))]);
    const singleRelease=releases.find(release=>`/${release.page}`===track.releasePage&&release.type==='single');
    const paths=singleRelease?[singleRelease.page,singleRelease.slug,...(singleRelease.aliases??[])].filter(path=>typeof path==='string'&&/^[a-z0-9-]+$/.test(path)):[];
    const pathMatch=paths.length?text.match(new RegExp(`(?:^|[^a-z0-9_/.:-])/(?:${paths.map(escape).join('|')})(?=$|[/?#\\s.,!?;)<\\]])`,'i')):null;
    const trackLink=text.match(new RegExp(`(?:^|[^a-z0-9_/.:-])(?:${track.destinations.map(escape).join('|')})(?=$|[\\s.,!?;)<\\]])`,'i'));
    if(!matches.length&&!pathMatch&&!trackLink)continue;
    const isMarked=track.aliases.some(alias=>marked.has(alias));
    const isFeatureMention=track.aliases.some(alias=>alias!==key&&new RegExp(`(?:^| )${escape(alias)}(?= |$)`).test(normalized));
    const isRecommendation=track.aliases.some(alias=>new RegExp(`\\b(?:start with|try|go with|put on|bump|check out|spin) (?:the )?${escape(alias)}(?: |$)`).test(normalized));
    // The album's brand also names its final track. Naming the album is not a
    // request to attach that track (or the entire album's fifteen previews).
    const isTitleTrack=albums.has(key)&&[normalized,normalize(visibleContent(lastUser))].some(context=>new RegExp(`(?:^| )(?:song|track)(?: called| named| is| the| title)? ${escape(key)}(?: |$)|(?:^| )${escape(key)} (?:is )?(?:the )?(?:title )?(?:song|track)(?: |$)`).test(context));
    if(albums.has(key)&&!isTitleTrack&&!trackLink)continue;
    if(ambiguous.has(key)&&!pathMatch&&!trackLink&&!isMarked&&!isFeatureMention&&!hasMusicContext&&!isRecommendation)continue;
    const index=matches.length?Math.min(...matches.map(match=>match.index)):(pathMatch||trackLink).index;
    found.push({index,releasePage:track.releasePage,trackIndex:track.trackIndex});
  }
  return found.sort((a,b)=>a.index-b.index).map(({releasePage,trackIndex})=>({releasePage,trackIndex}));
}
