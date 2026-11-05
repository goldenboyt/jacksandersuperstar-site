(() => {
  // Native HDR appears only for hover, keyboard focus or one short tap pulse.
  // The two silent video frames are identical: no sweep, flashing loop or motion.
  const actions='button,a.button,a.text-button,a.tee-shop,a.release-page-link,a.prime-widget-launcher';
  const excluded='.cover-button,.release-cover-button,.prime-image-open,.prime-photo-open,.shop-art,[data-zoom]';
  const states=new Map(),touches=new Map(),hover=matchMedia('(hover: hover) and (pointer: fine)');
  const TAP=240;
  let pageVisible=true,keyboard=false;
  function flag(node,name,value){if(node.classList.contains(name)!==value)node.classList.toggle(name,value)}
  function visit(root,callback){if(root.nodeType===1&&root.matches(actions))callback(root);root.querySelectorAll?.(actions).forEach(callback)}
  function supported(owner){
    if(owner.matches(excluded))return false;
    return !owner.querySelector('img,video,model-viewer')||owner.matches('.prime-cover-starter,.single-preview-title,.release-open-title');
  }
  function target(node){return node instanceof Element?node.closest(actions):null}
  function allowed(state){return pageVisible&&state.inView&&state.owner.isConnected&&!document.hidden&&!state.owner.disabled&&state.owner.getAttribute('aria-disabled')!=='true'&&!document.documentElement.classList.contains('intro-pending')&&[...document.querySelectorAll('dialog[open]')].every(dialog=>dialog.contains(state.owner))}
  function wanted(state){return state.tapUntil>performance.now()||(hover.matches&&state.hovered&&state.owner.matches(':hover'))||(state.focused&&state.owner.matches(':focus-visible'))}
  function assetFor(owner){
    return '/assets/hdr-action-crimson-v2';
  }
  function stop(state){state.video?.pause();flag(state.owner,'hdr-video-ready',false)}
  function dropMedia(state){
    state.serial++;stop(state);state.picture?.remove();state.video?.remove();state.picture=null;state.video=null;state.pending=false;state.retry=false;state.blocked=false;state.failed=false;
    flag(state.owner,'hdr-image-ready',false);
  }
  function prepare(state){
    const owner=state.owner,asset=assetFor(owner);
    if(state.asset===asset&&state.picture?.parentNode===owner&&(!state.video||state.video.parentNode===owner))return;
    dropMedia(state);state.asset=asset;const serial=state.serial;
    const style=getComputedStyle(owner);if(style.position==='static')owner.classList.add('hdr-static');if(style.zIndex==='auto')owner.classList.add('hdr-layer');owner.classList.add('hdr-surface');
    [...owner.childNodes].forEach(node=>{if(node.nodeType===3&&node.textContent.trim()){const label=document.createElement('span');label.className='hdr-content';node.replaceWith(label);label.append(node)}});
    if(!/flex|grid/.test(style.display))[...owner.children].forEach(child=>{if(!child.classList.contains('hdr-media')&&getComputedStyle(child).position==='static')child.classList.add('hdr-content')});
    // Fill actual label glyphs with HDR white; retain the live DOM and SVG icons.
    [...owner.children].forEach(child=>{if(child.namespaceURI==='http://www.w3.org/1999/xhtml'&&!child.classList.contains('hdr-media')&&child.textContent.trim())child.classList.add('hdr-label')});
    const picture=document.createElement('picture');picture.className='hdr-media hdr-picture';picture.setAttribute('aria-hidden','true');state.picture=picture;
    const source=document.createElement('source');source.type='image/avif';source.media='(dynamic-range: high)';source.srcset=asset+'.avif';
    const image=document.createElement('img');image.alt='';image.width=384;image.height=128;
    image.addEventListener('load',()=>{if(serial===state.serial)flag(owner,'hdr-image-ready',true)});image.addEventListener('error',()=>{if(serial===state.serial)flag(owner,'hdr-image-ready',false)});image.src=asset+'.svg';picture.append(source,image);owner.append(picture);
    const video=document.createElement('video');
    if(video.canPlayType('video/mp4; codecs="hvc1"')){
      state.video=video;video.className='hdr-media hdr-video';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='metadata';video.disablePictureInPicture=true;video.disableRemotePlayback=true;
      for(const [key,value]of Object.entries({muted:'',playsinline:'','aria-hidden':'true',tabindex:'-1'}))video.setAttribute(key,value);
      video.addEventListener('playing',()=>{if(serial!==state.serial)return;if(allowed(state)&&wanted(state))flag(owner,'hdr-video-ready',true);else stop(state)});
      video.addEventListener('pause',()=>{if(serial===state.serial)flag(owner,'hdr-video-ready',false)});
      video.addEventListener('error',()=>{if(serial===state.serial){state.failed=true;stop(state)}});
      video.src=asset+'.mp4';owner.append(video);
    }
  }
  function sync(state,gesture=false){
    const active=allowed(state)&&wanted(state);flag(state.owner,'hdr-active',active);flag(state.owner,'hdr-keyboard',active&&state.focused&&keyboard);
    if(!active){stop(state);return}
    prepare(state);const video=state.video;if(!video||state.failed)return;
    if(state.pending){state.retry=true;return}
    if((!video.paused&&video.readyState>=2)||(state.blocked&&!gesture))return;
    state.pending=true;video.muted=true;const serial=state.serial;
    let result;try{result=video.play()}catch{state.pending=false;state.failed=true;return}
    Promise.resolve(result).then(()=>{if(serial!==state.serial)return;state.pending=false;state.retry=false;state.blocked=false;if(!allowed(state)||!wanted(state))stop(state)},error=>{
      if(serial!==state.serial)return;const retry=state.retry;state.pending=false;state.retry=false;state.blocked=error.name==='NotAllowedError';if(error.name==='NotSupportedError')state.failed=true;flag(state.owner,'hdr-video-ready',false);
      if(retry&&error.name==='AbortError'&&allowed(state)&&wanted(state))sync(state);
    });
  }
  const intersection='IntersectionObserver'in window?new IntersectionObserver(entries=>entries.forEach(entry=>{const state=states.get(entry.target);if(!state)return;state.inView=entry.isIntersecting;if(allowed(state))prepare(state);sync(state)}),{threshold:0}):null;
  function add(owner){
    if(!owner||!owner.isConnected)return null;
    if(states.has(owner))return states.get(owner);
    if(!supported(owner))return null;
    const state={owner,inView:!intersection,hovered:false,focused:false,tapUntil:0,timer:0,lastPress:-Infinity,asset:null,picture:null,video:null,serial:0,pending:false,retry:false,blocked:false,failed:false};states.set(owner,state);intersection?.observe(owner);return state;
  }
  function remove(owner){const state=states.get(owner);if(!state||owner.isConnected)return;clearTimeout(state.timer);dropMedia(state);intersection?.unobserve(owner);states.delete(owner)}
  function refresh(root=document){visit(root,add)}
  function syncAll(){states.forEach(state=>{if(allowed(state))prepare(state);sync(state)})}
  function endPulse(state){clearTimeout(state.timer);state.tapUntil=0;sync(state)}
  function pulse(state){
    state.tapUntil=performance.now()+TAP;clearTimeout(state.timer);state.timer=setTimeout(()=>endPulse(state),TAP);sync(state,true);
  }
  document.addEventListener('pointerover',event=>{
    if(event.pointerType!=='mouse'||!hover.matches)return;const owner=target(event.target);if(!owner||owner===target(event.relatedTarget))return;const state=add(owner);if(!state)return;state.inView=true;state.hovered=true;sync(state);
  },{passive:true});
  document.addEventListener('pointerout',event=>{const owner=target(event.target),state=states.get(owner);if(state&&owner!==target(event.relatedTarget)){state.hovered=false;sync(state)}},{passive:true});
  document.addEventListener('pointerdown',event=>{
    keyboard=false;if(!event.isPrimary){touches.forEach(touch=>endPulse(touch.state));touches.clear();return}
    const state=add(target(event.target));if(!state||state.owner.disabled)return;state.inView=true;state.focused=false;state.lastPress=performance.now();
    if(event.pointerType!=='mouse'||!hover.matches){state.hovered=false;touches.set(event.pointerId,{state,x:event.clientX,y:event.clientY});pulse(state)}else sync(state,true);
  },{passive:true});
  document.addEventListener('pointermove',event=>{const touch=touches.get(event.pointerId);if(touch&&Math.hypot(event.clientX-touch.x,event.clientY-touch.y)>10){endPulse(touch.state);touches.delete(event.pointerId)}},{passive:true});
  for(const type of ['pointerup','pointercancel'])document.addEventListener(type,event=>{const touch=touches.get(event.pointerId);if(!touch)return;if(type==='pointercancel')endPulse(touch.state);touches.delete(event.pointerId)},{passive:true});
  document.addEventListener('keydown',event=>{if(['Tab','Enter',' '].includes(event.key))keyboard=true;const state=states.get(target(event.target));if(state){state.focused=keyboard&&state.owner.matches(':focus-visible');sync(state,true)}});
  document.addEventListener('focusin',event=>{const state=add(target(event.target));if(state){state.inView=true;state.focused=keyboard&&state.owner.matches(':focus-visible');sync(state,true)}});
  document.addEventListener('focusout',event=>{const state=states.get(target(event.target));if(state){state.focused=false;sync(state)}});
  document.addEventListener('click',event=>{const state=add(target(event.target));if(state&&!hover.matches&&performance.now()-state.lastPress>500){state.inView=true;pulse(state)}},{passive:true});
  const observer=new MutationObserver(records=>{
    let global=false;const changed=new Set();
    for(const record of records){
      if(record.type==='childList'){record.addedNodes.forEach(node=>visit(node,add));record.removedNodes.forEach(node=>visit(node,remove));const state=states.get(record.target);if(state)changed.add(state)}
      else if(record.attributeName==='open'||record.attributeName==='data-theme')global=true;
      else if(states.has(record.target))changed.add(states.get(record.target));
    }
    if(global)syncAll();else changed.forEach(state=>{if(allowed(state))prepare(state);sync(state)});
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','aria-disabled','aria-pressed','open']});observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)states.forEach(state=>{state.hovered=false;state.focused=false;endPulse(state)});syncAll()});
  window.addEventListener('pagehide',()=>{pageVisible=false;states.forEach(state=>{state.hovered=false;state.focused=false;endPulse(state)})});window.addEventListener('pageshow',()=>{pageVisible=true;syncAll()});
  document.addEventListener('superstar:intro-end',syncAll);hover.addEventListener('change',()=>{states.forEach(state=>state.hovered=false);syncAll()});
  window.SuperstarHDR={refresh};refresh();
})();
