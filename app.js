const releases = [
  {title:'#jacksandersuperstar®', type:'album',year:'2026',date:'july 15, 2026',image:'album',apple:'https://music.apple.com/us/album/jacksandersuperstar/6787361171',spotify:'https://open.spotify.com/album/0Kg7F6T2gReUAx5563lJ5K',tracks:['magic (tragic)','idgaf','supervillan','step on them (ft. o1sea)','newports','kill you','shakesphere','around the town',"coco’s interlude (ft. coconut titty)",'spend it','no wings (ft. lazer dim 700)','sexy party','fuk me','breathe (ft. sk8star)','#jacksandersuperstar']},
  {title:'prodigy genius',type:'album',year:'2025',date:'april 18, 2025',image:'prodigy',apple:'https://music.apple.com/us/album/prodigy-genius/1807497988',spotify:'https://open.spotify.com/album/34xsZoIvBvUADQh4esp5WI',tracks:['cybertruck','omg','cuntry','swag','designer',"luca’s interlude",'soboda','g33k3d','leprechaun','bb','greasefire']},
  {title:'cybertruck',type:'single',year:'2024',date:'september 6, 2024',image:'cybertruck',apple:'https://music.apple.com/us/album/cybertruck-single/1763991815',spotify:'https://open.spotify.com/album/7G8xrs0hsvWJkF6lqQLqCE',tracks:['cybertruck']},
  {title:'designer',type:'single',year:'2024',date:'may 3, 2024',image:'designer',apple:'https://music.apple.com/us/album/designer-single/1741535831',spotify:'https://open.spotify.com/album/7jD7ughrCDuo3lSd7wB5Si',tracks:['designer']},
  {title:'brainstorm',type:'single',year:'2022',date:'january 21, 2022',image:'brainstorm',apple:'https://music.apple.com/us/album/brainstorm-single/1605574307',spotify:'https://open.spotify.com/search/Brainstorm%20Jack%20Sander/albums',tracks:['brainstorm']},
  {title:'cats cash',type:'single',year:'2020',date:'may 13, 2020',image:'cats',soundcloud:'https://soundcloud.com/user-826121617/cats-cash-full',tracks:['cats cash']}
];
const youtubeLinks={album:'https://www.youtube.com/playlist?list=PLEoIsNgKzgdo',prodigy:'https://www.youtube.com/playlist?list=PL0bEx_EOu-iBSMiRRqbVZ__gmXUxIKsR1',cybertruck:'https://www.youtube.com/watch?v=DV6aY2-8vew',designer:'https://www.youtube.com/watch?v=hsM1qfrtq28',brainstorm:'https://www.youtube.com/watch?v=F0gEt3vQ9LI'};
const releaseSlugs={album:'jacksandersuperstar',prodigy:'prodigy-genius',cybertruck:'cybertruck',designer:'designer',brainstorm:'brainstorm',cats:'cats-cash'};
for(const release of releases){release.youtube=youtubeLinks[release.image];release.slug=releaseSlugs[release.image]}
function releaseUrl(release){
  const url=new URL('./',window.location.href);url.searchParams.set('release',release.slug);url.hash='music';return url.href;
}
function releaseSharing(release){
  const area=document.createElement('div');area.className='release-share';
  const button=document.createElement('button');button.type='button';button.className='button release-share-button';button.textContent='copy link';button.setAttribute('aria-label',`Copy link to ${release.title}`);
  const status=document.createElement('span');status.className='release-share-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const fallback=document.createElement('input');fallback.type='url';fallback.className='release-share-url';fallback.readOnly=true;fallback.hidden=true;fallback.value=releaseUrl(release);fallback.setAttribute('aria-label',`Link to ${release.title}`);
  button.addEventListener('click',async()=>{
    button.disabled=true;status.textContent='';
    try{
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(fallback.value);fallback.hidden=true;status.textContent='link copied';
    }catch{
      fallback.hidden=false;fallback.focus();fallback.select();status.textContent='Select and copy this link.';
    }finally{button.disabled=false}
  });
  area.append(button,status,fallback);return area;
}
function brandTitle(element,release){
  const artwork={album:'brand-logo.png',cybertruck:'cybertruck-title.png',brainstorm:'brainstorm-title.png'};
  if(artwork[release.image]){
    const image=document.createElement('img');image.src=`assets/${artwork[release.image]}`;image.alt=release.title;image.className='release-title-art';element.replaceChildren(image);
  }else{
    element.textContent=release.title;
    if(release.image==='prodigy'||release.image==='designer')element.classList.add('title-papyrus');
    if(release.image==='designer')element.classList.add('title-designer');
    if(release.image==='cats')element.classList.add('title-cooper');
  }
}
function streamingLink(key,label,release){
 const a=document.createElement('a');a.href=release[key];a.target='_blank';a.rel='noopener';a.className=`button ${key==='apple'?'button-red':'button-black'}`;a.textContent=label;return a;
}
document.addEventListener('click',event=>{
 const button=event.target.closest('.streaming-more');if(!button)return;
 const panel=document.getElementById(button.getAttribute('aria-controls'));const expanded=button.getAttribute('aria-expanded')==='true';
 button.setAttribute('aria-expanded',String(!expanded));button.setAttribute('aria-label',expanded?'More streaming services':'Hide extra streaming services');button.textContent=expanded?'+':'−';panel.hidden=expanded;
});
const catalog = document.getElementById('catalog');
for (const [i,release] of releases.entries()) {
  if (!i) continue;
  const button = document.createElement('button');
  button.className='release-card';button.dataset.release=i;button.setAttribute('aria-label',`View ${release.title} details`);
  const imageWrap=document.createElement('div');imageWrap.className='card-image';
  const image=document.createElement('img');image.src=`assets/${release.image}.webp`;image.alt=`${release.title} cover`;image.loading='lazy';image.width=500;image.height=500;
  const plus=document.createElement('span');plus.className='card-plus';plus.textContent='+';plus.setAttribute('aria-hidden','true');imageWrap.append(image,plus);
  const title=document.createElement('h3');brandTitle(title,release);const meta=document.createElement('p');meta.textContent=`${release.type} / ${release.year}`;button.append(imageWrap,title,meta);catalog.append(button);
}
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog||dialog.id==='menu')return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()}));
const albumDialog=document.getElementById('release-dialog');
const defaultDocumentTitle=document.title;
function openRelease(index){
  const release=releases[index];const container=document.getElementById('release-content');container.replaceChildren();
  const body=document.createElement('div');body.className='release-dialog-body';const art=document.createElement('img');art.className='dialog-art';art.src=`assets/${release.image}.webp`;art.alt=`${release.title} cover`;
  const copy=document.createElement('div');const title=document.createElement('h2');title.id='release-dialog-title';title.className='dialog-release-title';brandTitle(title,release);
  const meta=document.createElement('p');meta.className='dialog-meta';meta.textContent=`${release.type} / ${release.date} / ${release.tracks.length} ${release.tracks.length===1?'track':'tracks'}`;
  const links=document.createElement('div');links.className='dialog-links';
  for(const [key,label] of [['apple','apple music'],['spotify','spotify']]){if(release[key])links.append(streamingLink(key,label,release))}
  const extras=[['youtube','youtube'],['soundcloud','soundcloud']].filter(([key])=>release[key]);
  if(extras.length){
    if(!release.apple&&!release.spotify){for(const [key,label] of extras)links.append(streamingLink(key,label,release))}
    else{
      const toggle=document.createElement('button');toggle.className='button streaming-more';toggle.type='button';toggle.textContent='+';toggle.setAttribute('aria-label','More streaming services');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','dialog-streaming-extra');
      const panel=document.createElement('div');panel.id='dialog-streaming-extra';panel.className='streaming-extra';panel.hidden=true;
      for(const [key,label] of extras)panel.append(streamingLink(key,label,release));links.append(toggle,panel);
    }
  }
  const tracks=document.createElement('ol');tracks.className='tracklist';for(const track of release.tracks){const li=document.createElement('li');li.textContent=track;tracks.append(li)}
  copy.append(title,meta,links,releaseSharing(release),tracks);body.append(art,copy);container.append(body);if(!albumDialog.open)albumDialog.showModal();albumDialog.scrollTop=0;document.title=`${release.title}`;
}
document.querySelectorAll('[data-release]').forEach(button=>button.addEventListener('click',()=>{
  const index=Number(button.dataset.release);const address=new URL(window.location.href);
  if(address.searchParams.get('release')!==releases[index].slug){
    address.searchParams.set('release',releases[index].slug);address.hash='music';
    history.pushState({...history.state,superstarReleaseNavigation:true},'',address);
  }
  openRelease(index);
}));
function syncReleaseFromAddress(){
  const slug=new URL(window.location.href).searchParams.get('release');
  const index=releases.findIndex(release=>release.slug===slug);
  if(index!==-1){openRelease(index)}else{if(albumDialog.open)albumDialog.close();document.title=defaultDocumentTitle}
}
albumDialog.addEventListener('close',()=>{
  if(albumDialog.open)return;
  document.title=defaultDocumentTitle;
  const address=new URL(window.location.href);if(!address.searchParams.has('release'))return;
  if(history.state?.superstarReleaseNavigation){history.back();return}
  address.searchParams.delete('release');history.replaceState(history.state,'',address);
});
window.addEventListener('popstate',syncReleaseFromAddress);
syncReleaseFromAddress();
const videoDialog=document.getElementById('video-dialog');const videoFrame=document.getElementById('video-frame');
document.getElementById('watch-live').addEventListener('click',()=>{const iframe=document.createElement('iframe');iframe.src='https://www.youtube.com/embed/pZm5ldOVBnI?autoplay=1';iframe.title='Live in Dallas';iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;videoFrame.replaceChildren(iframe);videoDialog.showModal()});
videoDialog.addEventListener('close',()=>videoFrame.replaceChildren());
