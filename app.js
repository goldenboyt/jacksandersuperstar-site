const releases = window.SuperstarCatalog.releases;
const {brandTitle, releaseSharing, streamingLinks} = window.SuperstarReleaseUI;
const featuredStreaming = document.querySelector('.featured-release .release-actions');
featuredStreaming.replaceChildren(streamingLinks(releases[0], 'featured'));
const catalog = document.getElementById('catalog');
for (const [i,release] of releases.entries()) {
  if (!i) continue;
  const card = document.createElement('article');card.className='release-card';
  const button = document.createElement('button');
  button.className='release-cover-button';button.type='button';button.dataset.release=i;button.setAttribute('aria-label',`View ${release.title} details`);
  const imageWrap=document.createElement('div');imageWrap.className='card-image';
  const image=document.createElement('img');image.src=`assets/${release.image}.webp`;image.alt=`${release.title} cover`;image.loading='lazy';image.width=500;image.height=500;
  const plus=document.createElement('span');plus.className='card-plus';plus.textContent='+';plus.setAttribute('aria-hidden','true');imageWrap.append(image,plus);
  button.append(imageWrap);
  const title=document.createElement('h3');brandTitle(title,release);
  const meta=document.createElement('p');meta.textContent=`${release.type} / ${release.year}`;
  card.append(button,title,meta);
  if(release.type==='single')card.append(window.SuperstarPreviews.bindTitle(title,release));
  else{const link=document.createElement('button');link.type='button';link.className='release-open-title';link.dataset.release=i;link.append(...title.childNodes);title.append(link)}
  catalog.append(card);
}
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog||dialog.id==='menu')return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()}));
const albumDialog=document.getElementById('release-dialog');
const defaultDocumentTitle=document.title;
function openRelease(index){
  window.SuperstarPreviews.stop();
  const release=releases[index];const container=document.getElementById('release-content');container.replaceChildren();
  const body=document.createElement('div');body.className='release-dialog-body';const art=document.createElement('img');art.className='dialog-art';art.src=`assets/${release.image}.webp`;art.alt=`${release.title} cover`;
  const copy=document.createElement('div');const title=document.createElement('h2');title.id='release-dialog-title';title.className='dialog-release-title';brandTitle(title,release);
  const meta=document.createElement('p');meta.className='dialog-meta';meta.textContent=`${release.type} / ${release.date} / ${release.tracks.length} ${release.tracks.length===1?'track':'tracks'}`;
  const links=document.createElement('div');links.className='dialog-links';
  links.append(streamingLinks(release, 'dialog'));
  copy.append(title);
  if(release.type==='single')copy.append(window.SuperstarPreviews.bindTitle(title,release));
  copy.append(meta,links,releaseSharing(release));
  if(release.type==='album')copy.append(window.SuperstarPreviews.createTracklist(release));
  body.append(art,copy);container.append(body);if(!albumDialog.open)albumDialog.showModal();albumDialog.scrollTop=0;document.title=`${release.title}`;
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
  const index=releases.findIndex(release=>release.aliases.includes(slug));
  if(index!==-1){openRelease(index)}else{if(albumDialog.open)albumDialog.close();document.title=defaultDocumentTitle}
}
albumDialog.addEventListener('close',()=>{
  window.SuperstarPreviews.stopWithin(albumDialog);
  if(albumDialog.open)return;
  document.title=defaultDocumentTitle;
  const address=new URL(window.location.href);if(!address.searchParams.has('release'))return;
  if(history.state?.superstarReleaseNavigation){history.back();return}
  address.searchParams.delete('release');history.replaceState(history.state,'',address);
});
window.addEventListener('popstate',syncReleaseFromAddress);
syncReleaseFromAddress();
const videoDialog=document.getElementById('video-dialog');const videoFrame=document.getElementById('video-frame');
document.getElementById('watch-live').addEventListener('click',()=>{window.SuperstarPreviews.stop();const iframe=document.createElement('iframe');iframe.src='https://www.youtube.com/embed/pZm5ldOVBnI?autoplay=1';iframe.title='Live in Dallas';iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;videoFrame.replaceChildren(iframe);videoDialog.showModal()});
videoDialog.addEventListener('close',()=>videoFrame.replaceChildren());
