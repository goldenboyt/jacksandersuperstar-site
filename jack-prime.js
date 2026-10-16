(() => {
  const form=document.getElementById('prime-form'),input=document.getElementById('prime-input');
  const send=document.getElementById('prime-send'),stop=document.getElementById('prime-stop');
  const status=document.getElementById('prime-status'),log=document.getElementById('prime-messages');
  const intro=document.getElementById('prime-intro'),scroll=document.getElementById('prime-conversation');
  const modeButtons=[...document.querySelectorAll('[data-prime-mode]')];
  const coverEditor=document.getElementById('prime-cover-editor'),coverReference=document.getElementById('prime-cover-reference');
  const coverTitle=document.getElementById('prime-cover-title'),coverHelp=document.getElementById('prime-cover-help'),coverClose=document.getElementById('prime-cover-close');
  const coverUpload=document.getElementById('prime-cover-upload'),photoInput=document.getElementById('prime-cover-photo'),photoPreview=document.getElementById('prime-cover-photo-preview'),photoName=document.getElementById('prime-cover-photo-name');
  const storage='superstar:jack-prime:conversation',imageStorage=`${storage}:image-request`,ownerStorage=`${storage}:image-owner`;
  const catalog=new Map((window.SuperstarCatalog?.releases||[]).map(release=>[release.page,release]));
  const imageURLs=new Map();
  let history=[],controller=null,turn=0,mode='text',imageRetry=null,database,coverTemplate=null,uploadedPhoto=null,photoURL=null,photoSerial=0;
  let imageOwner=crypto.randomUUID(),previousOwner;
  try{previousOwner=sessionStorage.getItem(ownerStorage);sessionStorage.removeItem(storage);sessionStorage.removeItem(imageStorage);sessionStorage.setItem(ownerStorage,imageOwner)}catch{}
  const idle='';
  const paths=new Set(['/merch','/jacksandersuperstar','/prodigygenius','/cybertruck','/designer','/brainstorm','/catscash','/#music','/#live']);
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
  function textWithLinks(text,element){
    const regex=/\/(?:#[a-z]+|[a-z]+)(?![a-z/])/g;let position=0;
    for(const match of text.matchAll(regex)){
      if(!paths.has(match[0]))continue;
      element.append(document.createTextNode(text.slice(position,match.index)));
      const a=document.createElement('a');a.href=match[0];a.textContent=match[0];element.append(a);position=match.index+match[0].length;
    }
    element.append(document.createTextNode(text.slice(position)));
  }
  function formattedText(text,element){
    const bold=/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g;let position=0;
    for(const match of text.matchAll(bold)){
      textWithLinks(text.slice(position,match.index),element);
      const strong=document.createElement('strong');textWithLinks(match[1]??match[2],strong);element.append(strong);
      position=match.index+match[0].length;
    }
    textWithLinks(text.slice(position),element);
  }
  function songCards(node,songs){
    if(!window.SuperstarPreviews)return;
    for(const song of validSongs(songs)){
      const release=catalog.get(song.releasePage.replace(/^\//,'')),index=song.trackIndex;
      const card=document.createElement('div');card.className='prime-song';
      const link=document.createElement('a');link.className='prime-song-cover';link.href=`/${release.page}`;link.setAttribute('aria-label',`Open ${release.title}`);
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
      const download=document.createElement('a');download.href=url;download.download=`jack-prime-${entry.imageId.slice(0,8)}.png`;download.className='prime-image-download';download.textContent='download image ↗';
      box.replaceChildren(image,download);followBottom(follow);
    }
    show();
  }
  function message(role,text,entry={},blob){
    const follow=role==='user'||nearBottom();
    intro.hidden=true;intro.style.display='none';document.body.classList.add('prime-has-messages');
    const node=document.createElement('div');node.className=`prime-message prime-message--${role}`;
    const label=document.createElement('span');label.className='prime-message-label';label.textContent=role==='user'?'you':'jack prime';
    const body=document.createElement('div');(role==='assistant'?formattedText:textWithLinks)(text,body);node.append(label,body);log.append(node);
    if(role==='assistant'){songCards(node,entry.songs);if(entry.imageId)imageAttachment(node,entry,entry.imagePrompt||'an original image',blob)}
    followBottom(follow);return node;
  }
  function resize(){input.style.height='auto';input.style.height=`${Math.min(124,input.scrollHeight)}px`}
  function clearPhoto(){photoSerial++;uploadedPhoto=null;photoInput.value='';if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;photoPreview.removeAttribute('src');photoPreview.hidden=true;photoName.textContent='';if(!controller)send.disabled=false;}
  function selectCover(value){
    if(controller)return;
    clearPhoto();coverTemplate=['superstar','prodigy'].includes(value)?value:null;
    document.body.classList.toggle('prime-cover-selected',Boolean(coverTemplate));
    document.querySelectorAll('[data-prime-cover]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.primeCover===coverTemplate)));
    coverEditor.hidden=!coverTemplate;coverUpload.hidden=coverTemplate!=='prodigy';imageRetry=null;
    if(coverTemplate){
      coverReference.src=coverTemplate==='superstar'?'/assets/album.webp':'/assets/prodigy.webp';
      coverTitle.textContent=coverTemplate==='superstar'?'your superstar cover':'your prodigy genius cover';
      coverHelp.textContent=coverTemplate==='superstar'?'replace the tee text. keep the original cover.':'add a photo. keep the original cover and swap the face.';
      setMode('image');
    }else setMode('text');
    status.textContent='';input.value='';resize();(coverTemplate==='prodigy'?photoInput:input).focus({preventScroll:true});
  }
  function setMode(value){
    mode=value==='image'?'image':'text';modeButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.primeMode===mode)));
    input.placeholder=coverTemplate==='superstar'?'what should the tee say?':coverTemplate==='prodigy'?'any other details? (optional)':mode==='image'?'describe your image':'talk to jack prime';
    input.required=coverTemplate!=='prodigy';input.maxLength=coverTemplate==='superstar'?160:1600;
    input.setAttribute('aria-label',mode==='image'?'Describe an image for Jack Prime to make':'Message Jack Prime');
    send.setAttribute('aria-label',mode==='image'?'Make image':'Send message');
  }
  function imageIntent(text){
    text=text.replace(/^(?:hey|yo)[,.!]?\s+/i,'');
    if(/^(?:can|could|will|would)\s+you\s+(?:make|create|generate|design|draw)\s+(?:me\s+)?(?:(?:an?|some)\s+)?(?:images?|pictures?|photos?|posters?|wallpapers?|artwork|cover\s*art|album\s*covers?|illustrations?)\s*[.!?]*$/i.test(text))return false;
    return /^(?:(?:hey|yo)[,.!]?\s+)?(?:(?:can|could|will|would)\s+you\s+)?(?:please\s+)?(?:(?:make|create|generate|design)\s+(?:me\s+)?(?:an?\s+|some\s+)?(?:[^.!?\n]{0,70}\s+)?(?:image|picture|photo|poster|wallpaper|artwork|cover\s*art|album\s*cover|illustration)\b|(?:draw|illustrate|paint)\s+(?:me\s+)?(?:an?\s+)?\S)/i.test(text);
  }
  function busy(value,kind=mode){
    send.disabled=value;modeButtons.forEach(button=>{button.disabled=value});stop.hidden=!value;
    photoInput.disabled=value;coverClose.disabled=value;
    status.textContent=value?(kind==='image'?'making your image…':'jack prime is thinking…'):idle;form.setAttribute('aria-busy',String(value));
  }
  async function ask(text){
    text=text.trim();if((!text&&coverTemplate!=='prodigy')||controller)return;
    if(coverTemplate==='prodigy'&&!uploadedPhoto){status.textContent='add a photo first.';photoInput.focus();return;}
    const template=coverTemplate,photo=uploadedPhoto;
    const display=template==='superstar'?`make a superstar cover with this text: ${text}`:template==='prodigy'?`put my photo on prodigy genius${text?`: ${text}`:''}`:text;
    const kind=mode==='image'||imageIntent(text)?'image':'text',before=[...history],request=++turn;
    const pendingMessage=message('user',display);history.push({role:'user',content:display,...(kind==='image'?{kind:'image'}:{})});input.value='';resize();
    controller=new AbortController();busy(true,kind);
    let answered=false;
    try{
      if(kind==='image'){
        const owner=imageOwner;
        const key=JSON.stringify([template,text,photo?.key]);
        if(imageRetry?.key!==key)imageRetry={key,requestId:crypto.randomUUID()};
        const imageId=imageRetry.requestId;
        let payload,headers;
        if(template){
          payload=new FormData();payload.set('template',template);payload.set('requestId',imageId);
          if(template==='superstar')payload.set('text',text);
          else{payload.set('prompt',text);payload.set('photo',photo.blob,'face-reference.jpg');}
        }else{headers={'Content-Type':'application/json'};payload=JSON.stringify({prompt:text,requestId:imageId});}
        const response=await fetch('/api/jack-prime-image',{method:'POST',headers,body:payload,signal:controller.signal});
        if(!response.ok||!response.headers.get('content-type')?.startsWith('image/')){
          const data=await response.json().catch(()=>({}));throw new Error(data.error||"Couldn't make that image right now.");
        }
        const blob=await response.blob();if(request!==turn)return;
        if(!blob.size)throw new Error("Couldn't load the image. Try again.");
        storeImage(imageId,blob,owner).then(()=>{if(owner!==imageOwner)deleteImages([imageId])});
        const entry={role:'assistant',content:'made that.',kind:'image',imageId,imagePrompt:display};message(entry.role,entry.content,entry,blob);history.push(entry);imageRetry=null;
      }else{
        let recent=history.slice(-11).map(({role,content})=>({role,content}));if(recent[0]?.role==='assistant')recent.shift();
        const response=await fetch('/api/jack-prime',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:recent}),signal:controller.signal});
        const data=await response.json();
        if(!response.ok||typeof data.text!=='string'||!data.text.trim())throw new Error(data.error||"Can't reach Jack Prime right now.");
        if(request!==turn)return;
        const entry={role:'assistant',content:data.text,songs:validSongs(data.songs)};message(entry.role,entry.content,entry);history.push(entry);
      }
      answered=true;
    }catch(error){
      if(request!==turn)return;
      pendingMessage.remove();history=before;input.value=text;if(kind==='image')setMode('image');resize();
      if(!history.length){intro.hidden=false;intro.style.removeProperty('display');document.body.classList.remove('prime-has-messages');}
      status.textContent=error.name==='AbortError'?(kind==='image'?'stopped waiting. your image may still finish.':'stopped. your message is ready to try again.'):error.message;
    }finally{
      if(request===turn){controller=null;send.disabled=false;modeButtons.forEach(button=>{button.disabled=false});photoInput.disabled=false;coverClose.disabled=false;stop.hidden=true;form.setAttribute('aria-busy','false');if(answered)status.textContent=idle;}
    }
  }
  form.addEventListener('submit',event=>{event.preventDefault();ask(input.value)});
  modeButtons.forEach(button=>button.addEventListener('click',()=>{if(coverTemplate)selectCover(null);setMode(button.dataset.primeMode);status.textContent=idle;input.focus({preventScroll:true})}));
  document.querySelectorAll('[data-prime-cover]').forEach(button=>button.addEventListener('click',()=>selectCover(button.dataset.primeCover)));
  coverClose.addEventListener('click',()=>selectCover(null));
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
      photoURL=URL.createObjectURL(blob);photoPreview.src=photoURL;photoPreview.hidden=false;photoName.textContent='photo ready';status.textContent='';
    }catch(error){if(serial===photoSerial)status.textContent=error.message||'That photo could not be read. Try a JPEG or PNG.';}
    finally{if(source)URL.revokeObjectURL(source);if(serial===photoSerial&&!controller)send.disabled=false;}
  });
  input.addEventListener('input',resize);
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit()}});
  document.querySelectorAll('[data-prime-prompt]').forEach(button=>button.addEventListener('click',()=>{if(coverTemplate)selectCover(null);setMode('text');ask(button.dataset.primePrompt)}));
  stop.addEventListener('click',()=>controller?.abort());
  document.getElementById('prime-reset').addEventListener('click',()=>{
    turn++;controller?.abort();controller=null;history=[];imageRetry=null;selectCover(null);
    window.SuperstarPreviews?.stopWithin(log);log.replaceChildren();for(const url of imageURLs.values())URL.revokeObjectURL(url);imageURLs.clear();
    const oldOwner=imageOwner;imageOwner=crypto.randomUUID();try{sessionStorage.setItem(ownerStorage,imageOwner)}catch{}clearOwnedImages(oldOwner);
    intro.hidden=false;intro.style.removeProperty('display');document.body.classList.remove('prime-has-messages');busy(false);setMode('text');input.value='';resize();input.focus({preventScroll:true});
  });
  if(previousOwner)clearOwnedImages(previousOwner);
  let viewportFrame=0;
  function updateViewport(){
    viewportFrame=0;
    const view=window.visualViewport;if(view&&view.scale!==1)return;
    const atBottom=scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<24;
    const height=view?.height||innerHeight;
    document.documentElement.style.setProperty('--prime-top',`${Math.max(0,view?.offsetTop||0)}px`);
    document.documentElement.style.setProperty('--prime-height',`${height}px`);
    document.body.classList.toggle('prime-compact-viewport',height<480);
    document.body.classList.toggle('prime-tight-viewport',height<320);
    if(atBottom)scroll.scrollTop=scroll.scrollHeight;
  }
  function viewport(){if(!viewportFrame)viewportFrame=requestAnimationFrame(updateViewport)}
  window.visualViewport?.addEventListener('resize',viewport);
  window.visualViewport?.addEventListener('scroll',viewport);
  window.addEventListener('resize',viewport);window.addEventListener('scroll',viewport,{passive:true});
  window.addEventListener('pageshow',viewport);
  input.addEventListener('focus',viewport);input.addEventListener('blur',viewport);
  document.getElementById('menu-open').addEventListener('click',()=>input.blur());
  updateViewport();setMode('text');
  window.addEventListener('pagehide',()=>controller?.abort());resize();
})();
