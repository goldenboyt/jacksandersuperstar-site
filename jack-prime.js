(() => {
  const form=document.getElementById('prime-form'),input=document.getElementById('prime-input');
  const embedded=document.documentElement.classList.contains('prime-embedded');
  const send=document.getElementById('prime-send'),stop=document.getElementById('prime-stop');
  const status=document.getElementById('prime-status'),log=document.getElementById('prime-messages');
  const intro=document.getElementById('prime-intro'),scroll=document.getElementById('prime-conversation');
  const coverEditor=document.getElementById('prime-cover-editor'),coverReference=document.getElementById('prime-cover-reference');
  const coverTitle=document.getElementById('prime-cover-title'),coverHelp=document.getElementById('prime-cover-help'),coverClose=document.getElementById('prime-cover-close');
  const coverUpload=document.getElementById('prime-cover-upload'),photoInput=document.getElementById('prime-cover-photo'),photoPreview=document.getElementById('prime-cover-photo-preview'),photoName=document.getElementById('prime-cover-photo-name');
  const photoAdd=document.getElementById('prime-photo-add'),photoRemove=document.getElementById('prime-photo-remove'),photoOpen=document.getElementById('prime-photo-open');
  const storage='superstar:jack-prime:conversation',imageStorage=`${storage}:image-request`,ownerStorage=`${storage}:image-owner`;
  const catalog=new Map((window.SuperstarCatalog?.releases||[]).map(release=>[release.page,release]));
  const imageURLs=new Map();
  const imageTimingStorage='superstar:jack-prime:image-times';
  let imageTimings=[];
  try{const saved=JSON.parse(localStorage.getItem(imageTimingStorage));if(Array.isArray(saved))imageTimings=saved.filter(value=>Number.isFinite(value)&&value>=5000&&value<=175000).slice(-6)}catch{}
  let history=[],controller=null,turn=0,imageRetry=null,database,coverTemplate=null,uploadedPhoto=null,photoURL=null,photoSerial=0,draftRevision=0;
  let imageOwner=crypto.randomUUID(),previousOwner;
  try{previousOwner=sessionStorage.getItem(ownerStorage);sessionStorage.removeItem(storage);sessionStorage.removeItem(imageStorage);sessionStorage.setItem(ownerStorage,imageOwner)}catch{}
  const idle='';
  const paths=new Map([['/merch','merch'],['/jacksandersuperstar','#jacksandersuperstar®'],['/prodigygenius','prodigy genius'],['/cybertruck','cybertruck'],['/designer','designer'],['/brainstorm','brainstorm'],['/catscash','cats cash'],['/soboda','Soboda'],['/#music','music'],['/#live','Live in Dallas'],['/#video','Magic (Tragic) music video']]);
  const itemPaths=new Map(),albumPaths=new Set([...catalog.values()].filter(release=>release.type==='album').map(release=>`/${release.page}`));
  const itemKey=value=>value.toLowerCase().replace(/\s*[([]\s*(?:ft|feat|featuring)\.?[^)\]]*[)\]]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const albumNames=new Set([...catalog.values()].filter(release=>release.type==='album').map(release=>itemKey(release.title)));
  for(const [id,title,aliases] of [['tees','superstar tees',['tee','tees','shirt','t shirt','superstar tee','superstar tees']],['vinyl','vinyl',['vinyl','vinyl record','jacksandersuperstar vinyl']],['cologne','cologne',['cologne','jack scent','fragrance','perfume']],['temporary-tattoo','temporary tattoos',['tattoo','tattoos','temporary tattoo','temporary tattoos']],['stickers','stickers',['sticker','stickers','die cut stickers']]]){
    const path=`/merch#${id}`;paths.set(path,title);aliases.forEach(alias=>itemPaths.set(alias,path));
  }
  for(const release of catalog.values())release.tracks.forEach((title,index)=>{
    const path=release.type==='single'?`/${release.page}`:`/${release.page}#track-${index+1}`,key=itemKey(title);paths.set(path,title);
    if(!albumNames.has(key)&&(!itemPaths.has(key)||release.type==='single'))itemPaths.set(key,path);
  });
  function nearBottom(){return scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<48}
  function followBottom(follow){if(follow)requestAnimationFrame(()=>{scroll.scrollTop=scroll.scrollHeight})}
  function validSongs(songs){
    if(!Array.isArray(songs))return [];
    const seen=new Set();
    return songs.slice(0,30).flatMap(song=>{
      const page=typeof song?.releasePage==='string'?song.releasePage.replace(/^\//,''):'',release=catalog.get(page),index=song?.trackIndex,key=`${page}:${index}`;
      if(!release||!Number.isInteger(index)||index<0||index>=release.tracks.length||!release.previews?.[index]||seen.has(key))return [];
      seen.add(key);return [{releasePage:`/${release.page}`,trackIndex:index}];
    });
  }
  function sitePath(target,label=''){
    if(!target.startsWith('/')&&!/^https:\/\/(?:www\.)?jacksandersuperstar\.com\//i.test(target))return null;
    try{
      const url=new URL(target,location.origin);
      if(![location.origin,'https://jacksandersuperstar.com','https://www.jacksandersuperstar.com'].includes(url.origin)||url.search)return null;
      let path=url.pathname+url.hash;
      const item=itemPaths.get(itemKey(label));
      if(item&&((path==='/merch'&&item.startsWith('/merch#'))||(albumPaths.has(path)&&!item.startsWith('/merch#'))))path=item;
      return paths.has(path)?path:null;
    }catch{return null}
  }
  function formattedText(text,element,emphasis=true){
    const tokens=/\[([^\]\n]+)\]\(([^\s)]+)\)|https?:\/\/[^\s<>()]+|\/(?:#[a-z]+|[a-z]+(?:#[a-z0-9-]+)?)(?![\w/#%-])|\*\*([^*\n]+)\*\*|__([^_\n]+)__/g;
    let position=0;
    for(const match of text.matchAll(tokens)){
      let node,trailing='';
      if(match[3]||match[4]){
        if(!emphasis)continue;
        node=document.createElement('strong');formattedText(match[3]??match[4],node,false);
      }else{
        let target=match[2]||match[0];
        if(!match[2]&&target.startsWith('/')&&match.index>0&&/[\w/:.]/.test(text[match.index-1]))continue;
        if(!match[2]&&target.startsWith('http')){trailing=target.match(/[.,!?;:]+$/)?.[0]||'';if(trailing)target=target.slice(0,-trailing.length);}
        const label=match[1]?.replace(/\*\*|__/g,''),path=sitePath(target,label);if(!path)continue;
        node=document.createElement('a');node.href=path;
        node.textContent=label&&!label.startsWith('/')&&!/^https?:/i.test(label)?label:paths.get(path);
      }
      element.append(document.createTextNode(text.slice(position,match.index)),node,document.createTextNode(trailing));
      position=match.index+match[0].length;
    }
    element.append(document.createTextNode(text.slice(position)));
  }
  function songCards(node,songs){
    if(!window.SuperstarPreviews)return;
    for(const song of validSongs(songs)){
      const release=catalog.get(song.releasePage.replace(/^\//,'')),index=song.trackIndex;
      const card=document.createElement('div');card.className='prime-song';
      const link=document.createElement('a');link.className='prime-song-cover';link.href=release.type==='single'?`/${release.page}`:`/${release.page}#track-${index+1}`;link.setAttribute('aria-label',`Open ${release.tracks[index]}`);
      const cover=document.createElement('img');cover.src=`/assets/${release.image}.webp`;cover.alt='';cover.width=64;cover.height=64;cover.loading='lazy';link.append(cover);
      const details=document.createElement('div');details.className='prime-song-details';
      const list=window.SuperstarPreviews.createTracklist(release,'prime-song-tracklist');
      [...list.children].forEach((row,rowIndex)=>{if(rowIndex!==index)row.remove()});
      const album=document.createElement('a');album.className='prime-song-release';album.href=`/${release.page}`;album.textContent=`${release.title} · ${release.year}`;
      details.append(list,album);card.append(link,details);node.append(card);
    }
  }
  function openImages(){
    if(!database)database=new Promise((resolve,reject)=>{
      const request=indexedDB.open('superstar-jack-prime-images',1),timeout=setTimeout(()=>reject(new Error('Image storage is unavailable.')),2000);
      request.onupgradeneeded=()=>{request.result.createObjectStore('images',{keyPath:'id'})};
      request.onsuccess=()=>{clearTimeout(timeout);resolve(request.result)};request.onerror=()=>{clearTimeout(timeout);reject(request.error)};
      request.onblocked=()=>{clearTimeout(timeout);reject(new Error('Image storage is unavailable.'))};
    });
    return database;
  }
  async function imageOperation(mode,operation){
    const db=await openImages();return new Promise((resolve,reject)=>{
      const tx=db.transaction('images',mode);let result;
      const timeout=setTimeout(()=>{try{tx.abort()}catch{}reject(new Error('Image storage is unavailable.'))},2000);
      const request=operation(tx.objectStore('images'));
      if(request)request.onsuccess=()=>{result=request.result};
      tx.oncomplete=()=>{clearTimeout(timeout);resolve(result)};
      tx.onerror=tx.onabort=()=>{clearTimeout(timeout);reject(tx.error||new Error('Image storage is unavailable.'))};
    });
  }
  async function imageRecord(id){try{return await imageOperation('readonly',store=>store.get(id))}catch{return null}}
  async function deleteImages(ids){
    if(!ids.length)return;
    try{await imageOperation('readwrite',store=>{ids.forEach(id=>store.delete(id))})}catch{}
  }
  function storedImages(){return imageOperation('readonly',store=>store.getAll())}
  async function storeImage(id,blob,owner){
    try{
      const bytes=await blob.arrayBuffer();await imageOperation('readwrite',store=>store.put({id,bytes,type:blob.type,owner,createdAt:Date.now()}));
      const images=await storedImages();images.sort((a,b)=>b.createdAt-a.createdAt);await deleteImages(images.slice(20).map(image=>image.id));return true;
    }catch{return false}
  }
  async function clearOwnedImages(owner){try{const images=await storedImages();await deleteImages(images.filter(image=>image.owner===owner).map(image=>image.id))}catch{}}
  function imageAttachment(node,entry,prompt,blob){
    const box=document.createElement('figure');box.className='prime-image';
    const placeholder=document.createElement('p');placeholder.className='prime-image-placeholder';placeholder.textContent='loading image…';box.append(placeholder);node.append(box);
    async function show(){
      const saved=blob?null:await imageRecord(entry.imageId),source=blob||saved?.blob||(saved?.bytes?new Blob([saved.bytes],{type:saved.type||'image/png'}):null);if(!box.isConnected)return;
      const follow=nearBottom();
      if(!(source instanceof Blob)){placeholder.textContent='This image is no longer saved on this device.';followBottom(follow);return}
      let url=imageURLs.get(entry.imageId);if(!url){url=URL.createObjectURL(source);imageURLs.set(entry.imageId,url)}
      const image=document.createElement('img');image.src=url;image.alt=`Image made by Jack Prime: ${prompt}`;image.width=1024;image.height=1024;image.loading='lazy';
      image.addEventListener('load',()=>followBottom(nearBottom()),{once:true});
      const open=document.createElement('button');open.type='button';open.className='prime-image-open';open.setAttribute('aria-label','Open generated image full-screen');open.append(image);
      const details={url,blob:source,name:`jack-prime-${entry.imageId.slice(0,8)}.png`,alt:image.alt,opener:open};
      open.addEventListener('click',()=>window.SuperstarImageViewer?.open(details));
      const actions=document.createElement('figcaption');actions.className='prime-image-actions';
      const save=document.createElement('button');save.type='button';save.className='prime-image-save';save.textContent='save image ↗';
      const saveStatus=document.createElement('span');saveStatus.className='prime-image-save-status';saveStatus.setAttribute('role','status');
      save.addEventListener('click',()=>window.SuperstarImageViewer?.save({...details,opener:save},saveStatus,save));
      const download=document.createElement('a');download.href=url;download.download=details.name;download.className='prime-image-download';download.textContent='download file ↗';
      actions.append(save,download,saveStatus);box.replaceChildren(open,actions);followBottom(follow);
    }
    show();
  }
  function message(role,text,entry={},blob){
    const follow=role==='user'||nearBottom();
    intro.hidden=true;intro.style.display='none';document.body.classList.add('prime-has-messages');
    const node=document.createElement('div');node.className=`prime-message prime-message--${role}`;
    const label=document.createElement('span');label.className='prime-message-label';label.textContent=role==='user'?'you':'jack prime';
    node.append(label);
    if(text){const body=document.createElement('div');if(role==='assistant')formattedText(text,body);else body.textContent=text;node.append(body)}
    log.append(node);
    if(role==='assistant'){songCards(node,entry.songs);if(entry.imageId)imageAttachment(node,entry,entry.imagePrompt||'an original image',blob)}
    else if(blob){
      const image=document.createElement('img'),url=URL.createObjectURL(blob);imageURLs.set(`photo:${crypto.randomUUID()}`,url);
      image.className='prime-uploaded-image';image.src=url;image.alt='Your uploaded image';image.width=160;image.height=160;
      const open=document.createElement('button');open.type='button';open.className='prime-photo-open';open.setAttribute('aria-label','Open uploaded image full-screen');open.append(image);node.append(open);
      open.addEventListener('click',()=>window.SuperstarImageViewer?.open({url,blob,name:'jack-prime-upload.jpg',alt:image.alt,opener:open}));
      image.addEventListener('load',()=>followBottom(nearBottom()),{once:true});
    }
    followBottom(follow);return node;
  }
  function activity(kind){
    const follow=nearBottom(),node=document.createElement('div');
    node.className=`prime-message prime-message--assistant prime-activity prime-activity--${kind}`;
    node.innerHTML='<span class="prime-message-label">jack prime</span>'+(kind==='image'?'<div class="prime-render"><span aria-hidden="true">prime</span><i aria-hidden="true"></i><div class="prime-render-progress" role="progressbar" aria-label="Estimated image generation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="0% complete, estimated" title="Estimated image generation progress"><strong>0%</strong></div></div>':'<span class="prime-thinking-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>')+`<span class="prime-activity-label" role="status">${kind==='image'?'making your image':'thinking'}</span>`;
    log.append(node);followBottom(follow);
    let timer,completed=false;
    const started=performance.now();
    if(kind==='image'){
      const progress=node.querySelector('.prime-render-progress'),number=progress.querySelector('strong');
      const timings=[...imageTimings].sort((a,b)=>a-b),estimate=timings.length?timings[Math.floor(timings.length/2)]:60000;
      // The provider returns only a finished image. Keep this time estimate
      // below completion until delivery, with an accessible label and tooltip.
      timer=setInterval(()=>{
        const ratio=(performance.now()-started)/estimate;
        const done=Math.min(95,Math.floor(ratio<=1?90*ratio:90+5*(1-Math.exp(1-ratio))));
        number.textContent=`${done}%`;
        progress.setAttribute('aria-valuenow',String(done));progress.setAttribute('aria-valuetext',`${done}% complete, estimated`);
      },250);
    }
    return {
      complete(){
        if(kind!=='image'||completed)return;
        completed=true;clearInterval(timer);
        const elapsed=performance.now()-started;
        // Ignore quick cache hits; retain only durations, never prompts or photos.
        if(elapsed>=5000&&elapsed<=175000){imageTimings=[...imageTimings,elapsed].slice(-6);try{localStorage.setItem(imageTimingStorage,JSON.stringify(imageTimings))}catch{}}
        const progress=node.querySelector('.prime-render-progress');
        progress.querySelector('strong').textContent='100%';
        progress.setAttribute('aria-valuenow','100');progress.setAttribute('aria-valuetext','Image ready');
      },
      remove(){clearInterval(timer);node.remove();}
    };
  }
  function resize(){
    const follow=nearBottom();input.style.height='auto';
    const limit=parseFloat(getComputedStyle(input).maxHeight)||124;
    input.style.height=`${Math.min(limit,Math.max(44,input.scrollHeight))}px`;
    const overflow=input.scrollHeight>input.clientHeight+1;
    input.classList.toggle('prime-input-scrollable',overflow);
    if(!overflow){input.scrollTop=0;input.scrollLeft=0;}
    followBottom(follow);
  }
  function clearPhoto(){photoSerial++;uploadedPhoto=null;photoInput.value='';if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;photoPreview.removeAttribute('src');photoPreview.hidden=true;photoOpen.hidden=true;coverUpload.hidden=true;photoName.textContent='';if(!controller)send.disabled=false;updateComposer();}
  function selectCover(value){
    if(controller)return;
    const next=['superstar','prodigy'].includes(value)?value:null;if(next)clearPhoto();coverTemplate=next;
    document.body.classList.toggle('prime-cover-selected',Boolean(coverTemplate));
    document.querySelectorAll('[data-prime-cover]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.primeCover===coverTemplate)));
    coverEditor.hidden=!coverTemplate;imageRetry=null;
    if(coverTemplate){
      coverReference.src=coverTemplate==='superstar'?'/assets/album.webp':'/assets/prodigy.webp';
      coverTitle.textContent=coverTemplate==='superstar'?'your superstar cover':'your prodigy genius cover';
      coverHelp.textContent=coverTemplate==='superstar'?'replace the tee text. keep the original cover.':'add a photo. keep the original cover and swap the face.';
    }
    updateComposer();
    status.textContent='';if(coverTemplate){input.value='';draftRevision++;}resize();(coverTemplate==='prodigy'?photoInput:input).focus({preventScroll:true});
  }
  function updateComposer(){
    input.placeholder=coverTemplate==='superstar'?'what should the tee say?':coverTemplate==='prodigy'?'any other details? (optional)':uploadedPhoto?'ask about or edit this image':'talk to jack prime';
    input.required=coverTemplate!=='prodigy'&&!(uploadedPhoto&&!coverTemplate);input.maxLength=coverTemplate==='superstar'?160:1600;
    photoAdd.hidden=coverTemplate==='superstar';
    input.setAttribute('aria-label',coverTemplate==='superstar'?'Text for your Superstar cover':coverTemplate==='prodigy'?'Details for your Prodigy Genius cover':'Message Jack Prime');
    send.setAttribute('aria-label',coverTemplate?'Make cover':'Send message');
  }
  function busy(value){
    send.disabled=value;stop.hidden=!value;
    photoInput.disabled=value;photoRemove.disabled=value;coverClose.disabled=value;
    status.textContent=idle;form.setAttribute('aria-busy',String(value));
  }
  function recentMessages(){
    const recent=history.slice(-11).map(({role,content})=>({role,content:content.slice(0,2400)}));
    if(recent[0]?.role==='assistant')recent.shift();
    while(recent.length>1&&recent.reduce((total,message)=>total+message.content.length,0)>12000)recent.splice(0,2);
    return recent;
  }
  async function ask(text){
    text=text.trim();if(controller)return;
    if(!text&&uploadedPhoto&&!coverTemplate)text="what's in this image?";
    if(!text&&coverTemplate!=='prodigy')return;
    if(coverTemplate==='prodigy'&&!uploadedPhoto){status.textContent='add a photo first.';photoInput.focus();return;}
    const template=coverTemplate,photo=uploadedPhoto;
    const display=template==='superstar'?`make a superstar cover with this text: ${text}`:template==='prodigy'?`put my photo on prodigy genius${text?`: ${text}`:''}`:text;
    let kind=template?'image':'text';
    const before=[...history],request=++turn,sentRevision=draftRevision;
    const pendingMessage=message('user',display,{},photo?.blob);history.push({role:'user',content:display,...(kind==='image'?{kind:'image'}:{})});input.value='';resize();
    const abort=new AbortController();controller=abort;busy(true);
    let waiting=activity(kind);
    let answered=false,timedOut=false;
    let timeout=setTimeout(()=>{timedOut=true;abort.abort()},kind==='image'?175000:35000);
    try{
      if(kind==='text'){
        let payload,headers;
        if(photo){payload=new FormData();payload.set('messages',JSON.stringify(recentMessages()));payload.set('photo',photo.blob,'attachment.jpg');}
        else{headers={'Content-Type':'application/json'};payload=JSON.stringify({messages:recentMessages()});}
        const response=await fetch('/api/jack-prime',{method:'POST',headers,body:payload,signal:abort.signal});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"Can't reach Jack Prime right now.");
        if(request!==turn)return;
        if(data.action==='image'){
          kind='image';history.at(-1).kind='image';
          clearTimeout(timeout);timeout=setTimeout(()=>{timedOut=true;abort.abort()},175000);
          waiting.remove();waiting=activity('image');
        }else{
          if(typeof data.text!=='string'||!data.text.trim())throw new Error("Can't reach Jack Prime right now.");
          waiting.remove();const entry={role:'assistant',content:data.text,songs:validSongs(data.songs)};message(entry.role,entry.content,entry);history.push(entry);
        }
      }
      if(kind==='image'){
        const owner=imageOwner;
        const context=history.slice(-6).map(item=>`${item.role}: ${item.content}`).join('\n').slice(-6000);
        const key=JSON.stringify([template,text,photo?.key,context]);
        if(imageRetry?.key!==key)imageRetry={key,requestId:crypto.randomUUID()};
        const imageId=imageRetry.requestId;
        let payload,headers;
        if(template||photo){
          payload=new FormData();if(template)payload.set('template',template);payload.set('requestId',imageId);
          if(template==='superstar')payload.set('text',text);
          else{payload.set('prompt',text);payload.set('photo',photo.blob,'face-reference.jpg');payload.set('context',context);}
        }else{headers={'Content-Type':'application/json'};payload=JSON.stringify({prompt:text,requestId:imageId,context});}
        const response=await fetch('/api/jack-prime-image',{method:'POST',headers,body:payload,signal:abort.signal});
        if(!response.ok||!response.headers.get('content-type')?.startsWith('image/')){
          const data=await response.json().catch(()=>({}));
          if(response.status===422&&data.code==='image_refused'&&typeof data.text==='string'&&data.text.trim()){
            if(request!==turn)return;
            waiting.remove();const entry={role:'assistant',content:data.text};message(entry.role,entry.content,entry);history.push(entry);imageRetry=null;answered=true;return;
          }
          throw new Error(data.error||"Couldn't make that image right now.");
        }
        const blob=await response.blob();if(request!==turn)return;
        if(!blob.size)throw new Error("Couldn't load the image. Try again.");
        waiting.complete();
        storeImage(imageId,blob,owner).then(()=>{if(owner!==imageOwner)deleteImages([imageId])});
        waiting.remove();const entry={role:'assistant',content:`[Generated image for: ${JSON.stringify(display)}]`,kind:'image',imageId,imagePrompt:display};message(entry.role,'',entry,blob);history.push(entry);imageRetry=null;
      }
      answered=true;
    }catch(error){
      if(request!==turn)return;
      pendingMessage.remove();history=before;if(draftRevision===sentRevision)input.value=text;resize();
      if(!history.length){intro.hidden=false;intro.style.removeProperty('display');document.body.classList.remove('prime-has-messages');}
      status.textContent=timedOut?'that took too long. you can try again.':error.name==='AbortError'?(kind==='image'?'stopped waiting. your image may still finish.':'stopped. your message is ready to try again.'):error.message;
    }finally{
      clearTimeout(timeout);waiting.remove();
      if(request===turn){controller=null;send.disabled=false;photoInput.disabled=false;photoRemove.disabled=false;coverClose.disabled=false;stop.hidden=true;form.setAttribute('aria-busy','false');if(answered)status.textContent=idle;}
    }
  }
  form.addEventListener('submit',event=>{event.preventDefault();ask(input.value)});
  // Keep the keyboard open when sending by mouse or touch from the composer.
  [send,stop].forEach(button=>{
    const keepFocus=event=>{if(event.button===0&&document.activeElement===input)event.preventDefault()};
    button.addEventListener('pointerdown',keepFocus);button.addEventListener('mousedown',keepFocus);
  });
  document.querySelectorAll('[data-prime-cover]').forEach(button=>button.addEventListener('click',()=>selectCover(button.dataset.primeCover)));
  coverClose.addEventListener('click',()=>selectCover(null));
  photoRemove.addEventListener('click',()=>{clearPhoto();status.textContent='';input.focus({preventScroll:true});resize()});
  photoInput.addEventListener('change',async()=>{
    const file=photoInput.files?.[0];clearPhoto();if(!file)return;
    const serial=photoSerial;send.disabled=true;status.textContent='preparing your photo…';
    let source;
    try{
      if(file.size>20000000||file.type&&!/^image\/(?:jpeg|png|webp|heic|heif)$/.test(file.type))throw new Error('Choose a JPEG, PNG, WebP, or HEIC photo under 20 MB.');
      source=URL.createObjectURL(file);const image=new Image();image.src=source;await image.decode().catch(()=>{throw new Error('That photo could not be read. Try a JPEG or PNG.');});
      if(image.naturalWidth*image.naturalHeight>60000000)throw new Error('Please choose a smaller photo.');
      const scale=Math.min(1,1024/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('That photo could not be prepared.')),'image/jpeg',.9));
      const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
      if(serial!==photoSerial)return;
      uploadedPhoto={blob,key:[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')};
      photoURL=URL.createObjectURL(blob);photoPreview.src=photoURL;photoPreview.hidden=false;photoOpen.hidden=false;coverUpload.hidden=false;photoName.textContent='photo ready';status.textContent='';updateComposer();
    }catch(error){if(serial===photoSerial)status.textContent=error.message||'That photo could not be read. Try a JPEG or PNG.';}
    finally{if(source)URL.revokeObjectURL(source);if(serial===photoSerial&&!controller)send.disabled=false;}
  });
  input.addEventListener('input',()=>{draftRevision++;resize()});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229){event.preventDefault();form.requestSubmit()}});
  document.querySelectorAll('[data-prime-prompt]').forEach(button=>button.addEventListener('click',()=>{if(coverTemplate)selectCover(null);ask(button.dataset.primePrompt)}));
  photoOpen.addEventListener('click',()=>{if(uploadedPhoto&&photoURL)window.SuperstarImageViewer?.open({url:photoURL,blob:uploadedPhoto.blob,name:'jack-prime-upload.jpg',alt:photoPreview.alt,opener:photoOpen})});
  stop.addEventListener('click',()=>controller?.abort());
  document.getElementById('prime-reset').addEventListener('click',()=>{
    window.SuperstarImageViewer?.close();
    turn++;controller?.abort();controller=null;history=[];imageRetry=null;clearPhoto();selectCover(null);
    window.SuperstarPreviews?.stopWithin(log);log.replaceChildren();for(const url of imageURLs.values())URL.revokeObjectURL(url);imageURLs.clear();
    const oldOwner=imageOwner;imageOwner=crypto.randomUUID();try{sessionStorage.setItem(ownerStorage,imageOwner)}catch{}clearOwnedImages(oldOwner);
    intro.hidden=false;intro.style.removeProperty('display');document.body.classList.remove('prime-has-messages');busy(false);updateComposer();input.value='';resize();input.focus({preventScroll:true});
  });
  if(previousOwner)clearOwnedImages(previousOwner);
  const tesla=!embedded&&/\bTesla\b/i.test(navigator.userAgent);
  let viewportFrame=0,viewportTimers=[],restingWidth=innerWidth,restingHeight=Math.min(innerHeight,window.visualViewport?.height||innerHeight);
  function updateViewport(){
    viewportFrame=0;
    const view=window.visualViewport;if(view&&view.scale!==1)return;
    // Safari can pan the outer document while its keyboard is open, even with
    // an overflow-hidden body. Keep that separate from the chat's own scroll.
    if(window.scrollX||window.scrollY)window.scrollTo(0,0);
    const atBottom=scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<24;
    const measuredHeight=Math.min(innerHeight,view?.height||innerHeight);
    const top=Math.min(Math.max(0,view?.offsetTop||0),Math.max(0,innerHeight-measuredHeight));
    const typing=document.activeElement===input,keyboard=navigator.virtualKeyboard?.boundingRect;
    const keyboardVisible=keyboard?.height>0&&keyboard.width>0;
    if(!typing||restingWidth!==innerWidth){restingHeight=measuredHeight;restingWidth=innerWidth;}
    let height=measuredHeight;
    if(keyboardVisible&&keyboard.top>top)height=Math.min(height,keyboard.top-top);
    // Some in-car keyboards overlay the page without reporting resized bounds.
    // Keep the typing controls at the top and the chat in the upper screen.
    if(tesla&&typing&&!keyboardVisible&&restingHeight-height<96)height=Math.min(height,Math.floor(restingHeight/2));
    document.documentElement.style.setProperty('--prime-top',`${top}px`);
    document.documentElement.style.setProperty('--prime-height',`${height}px`);
    document.body.classList.toggle('prime-tesla-typing',tesla&&typing);
    document.body.classList.toggle('prime-compact-viewport',height<480||(tesla&&typing));
    document.body.classList.toggle('prime-tight-viewport',height<380);
    resize();
    if(atBottom)scroll.scrollTop=scroll.scrollHeight;
  }
  function viewport(){if(!viewportFrame)viewportFrame=requestAnimationFrame(updateViewport)}
  function settleViewport(){
    viewportTimers.forEach(clearTimeout);viewport();
    viewportTimers=[80,250,500].map(delay=>setTimeout(viewport,delay));
  }
  window.visualViewport?.addEventListener('resize',viewport);
  window.visualViewport?.addEventListener('scroll',viewport);
  navigator.virtualKeyboard?.addEventListener('geometrychange',viewport);
  window.addEventListener('resize',viewport);window.addEventListener('scroll',viewport,{passive:true});
  window.addEventListener('pageshow',settleViewport);window.addEventListener('orientationchange',settleViewport);
  input.addEventListener('focus',settleViewport);input.addEventListener('blur',settleViewport);
  let touch;
  document.addEventListener('touchstart',event=>{
    if(event.touches.length!==1){touch=null;return;}
    const point=event.touches[0];touch={x:point.clientX,y:point.clientY,at:performance.now(),moved:false,selection:false};
  },{passive:true,capture:true});
  document.addEventListener('touchmove',event=>{
    if(event.target instanceof Element&&event.target.closest('.prime-image-viewer'))return;
    if(!touch||event.touches.length!==1||(window.visualViewport?.scale||1)!==1)return;
    const point=event.touches[0],dy=point.clientY-touch.y,dx=point.clientX-touch.x;
    const area=event.target instanceof Element?event.target.closest('#prime-input,.prime-conversation,.menu-dialog'):null;
    // Keep native long-press selection and caret dragging available.
    if(area===input&&(input.selectionStart!==input.selectionEnd||touch.selection||(!touch.moved&&performance.now()-touch.at>350))){touch.selection=true;return;}
    if(area&&Math.abs(dy)<Math.abs(dx))return;
    touch.moved=true;touch.x=point.clientX;touch.y=point.clientY;
    const max=area?area.scrollHeight-area.clientHeight:0;
    if(!area||max<=1||(dy>0?area.scrollTop<=0:area.scrollTop>=max-1))event.preventDefault();
  },{passive:false,capture:true});
  document.getElementById('menu-open').addEventListener('click',()=>input.blur());
  if(embedded){
    const host=(type,value)=>parent.postMessage({type,...(value===undefined?{}:{value})},location.origin);
    document.addEventListener('click',event=>{
      const link=event.target instanceof Element?event.target.closest('a[href]'):null;
      if(link&&!link.hasAttribute('download')&&!link.getAttribute('href').startsWith('#')&&/^https?:$/.test(link.protocol)&&link.origin===location.origin)link.target='_top';
    });
    input.addEventListener('focus',()=>host('prime:typing',true));input.addEventListener('blur',()=>host('prime:typing',false));
    window.addEventListener('message',event=>{
      if(event.origin!==location.origin||event.source!==parent)return;
      if(event.data?.type==='prime:focus')input.focus({preventScroll:true});
      if(event.data?.type==='prime:send'&&typeof event.data.text==='string'&&event.data.text.trim()&&event.data.text.length<=1600){
        if(!controller)selectCover(null);
        input.value=event.data.text;draftRevision++;resize();input.focus({preventScroll:true});if(!controller)form.requestSubmit();
      }
      if(event.data?.type==='prime:blur'){input.blur();window.SuperstarPreviews?.stopWithin(log);}
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))host('prime:close')});
    host('prime:ready');
  }
  updateViewport();updateComposer();send.disabled=false;
  window.addEventListener('pagehide',()=>controller?.abort());resize();
  if(!embedded){
    const fragment=new URLSearchParams(location.hash.slice(1));
    if(fragment.has('message')){
      const message=fragment.get('message')?.trim();
      fragment.delete('message');
      const remaining=fragment.toString();
      window.history.replaceState(window.history.state,'',location.pathname+location.search+(remaining?`#${remaining}`:''));
      if(message&&message.length<=1600)ask(message);
    }
  }
})();
