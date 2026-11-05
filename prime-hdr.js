(() => {
  // One material for primary actions and active states. The native HDR media
  // contains two identical silent frames; labels, icons and photos stay SDR.
  const selector='[data-hdr],[data-prime-hdr-surface]',states=new Map();
  let pageVisible=true;
  function visit(root,callback){
    if(root.nodeType===1&&root.matches(selector))callback(root);
    root.querySelectorAll?.(selector).forEach(callback);
  }
  function mode(control){return control.dataset.hdr||(control.dataset.primeHdrSurface==='send'?'ready':'primary')}
  function eligible(state){
    const {control,owner,form}=state;
    if(owner.disabled)return false;
    switch(mode(control)){
      case 'ready':return Boolean(form?.querySelector('textarea,input:not([type=file])')?.value.trim());
      case 'selected':return owner.getAttribute('aria-pressed')==='true';
      case 'playing':return control.dataset.hdrState==='playing';
      case 'feedback':return control.dataset.hdrState==='copied';
      default:return true;
    }
  }
  function visible(state){
    return pageVisible&&state.inView&&state.control.isConnected&&!document.hidden&&!document.documentElement.classList.contains('intro-pending')&&eligible(state)&&[...document.querySelectorAll('dialog[open]')].every(dialog=>dialog.contains(state.control));
  }
  function flag(control,name,value){if(control.classList.contains(name)!==value)control.classList.toggle(name,value)}
  function stop(state){state.video?.pause();flag(state.control,'hdr-video-ready',false)}
  function sync(state,gesture=false){
    const active=visible(state);flag(state.control,'hdr-active',active);
    if(!active||state.failed){stop(state);return}
    const video=state.video;if(!video)return;
    if(state.pending){state.retry=true;return}
    if((!video.paused&&video.readyState>=2)||(state.blocked&&!gesture))return;
    if(!video.getAttribute('src'))video.src=state.asset+'.mp4';
    state.pending=true;video.muted=true;
    let result;try{result=video.play()}catch{state.pending=false;state.retry=false;state.failed=true;return}
    Promise.resolve(result).then(()=>{
      state.pending=false;state.retry=false;state.blocked=false;
      if(!visible(state))stop(state);
    },error=>{
      const retry=state.retry;state.pending=false;state.retry=false;state.blocked=error.name==='NotAllowedError';
      if(error.name==='NotSupportedError')state.failed=true;
      flag(state.control,'hdr-video-ready',false);
      if(retry&&error.name==='AbortError'&&visible(state))sync(state);
    });
  }
  const intersection='IntersectionObserver'in window?new IntersectionObserver(entries=>entries.forEach(entry=>{const state=states.get(entry.target);if(state){state.inView=entry.isIntersecting;sync(state)}}),{threshold:0}):null;
  function add(control){
    if(!control.isConnected||states.has(control))return;
    const owner=control.closest('button,a')||control,form=control.closest('form');
    const shape=control.dataset.hdrShape||(mode(control)==='ready'?'square':'wide');
    const asset='/assets/hdr-action-'+(control.dataset.hdrTheme==='red'?'red':['square','frame'].includes(shape)?shape:'wide');
    const state={control,owner,form,asset,inView:!intersection,pending:false,retry:false,failed:false,blocked:false,video:null};states.set(control,state);
    const layout=getComputedStyle(control);
    if(layout.position==='static')control.classList.add('hdr-static');
    if(layout.zIndex==='auto')control.classList.add('hdr-layer');
    control.classList.add('hdr-surface');
    // Wrap text only: album-cover images and existing structural children keep
    // their original positions, selectors and accessible labels.
    [...control.childNodes].forEach(node=>{if(node.nodeType===3&&node.textContent.trim()){const label=document.createElement('span');label.className='hdr-text';node.replaceWith(label);label.append(node)}});
    const picture=document.createElement('picture');picture.className='hdr-media hdr-picture';picture.setAttribute('aria-hidden','true');
    const source=document.createElement('source');source.type='image/avif';source.media='(dynamic-range: high)';source.srcset=asset+'.avif';
    const image=document.createElement('img');image.alt='';image.width=shape==='frame'?384:shape==='square'?192:384;image.height=shape==='frame'?384:shape==='square'?192:128;
    image.addEventListener('load',()=>flag(control,'hdr-image-ready',true));image.addEventListener('error',()=>flag(control,'hdr-image-ready',false));image.src=asset+'.svg';picture.append(source,image);control.append(picture);
    const video=document.createElement('video');
    if(video.canPlayType('video/mp4; codecs="hvc1"')){
      state.video=video;video.className='hdr-media hdr-video';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='none';video.disablePictureInPicture=true;video.disableRemotePlayback=true;
      for(const [key,value]of Object.entries({muted:'',playsinline:'','aria-hidden':'true',tabindex:'-1'}))video.setAttribute(key,value);
      video.addEventListener('playing',()=>{if(visible(state))flag(control,'hdr-video-ready',true);else stop(state)});
      video.addEventListener('pause',()=>flag(control,'hdr-video-ready',false));video.addEventListener('error',()=>{state.failed=true;stop(state)});control.append(video);
    }
    intersection?.observe(control);sync(state);
  }
  function remove(control){const state=states.get(control);if(!state||control.isConnected)return;stop(state);intersection?.unobserve(control);states.delete(control)}
  function refresh(root=document){visit(root,add)}
  function syncAll(){states.forEach(state=>sync(state))}
  const observer=new MutationObserver(records=>{
    let dialogs=false;
    const changed=new Set();
    for(const record of records){
      if(record.type==='childList'){
        record.addedNodes.forEach(node=>visit(node,add));record.removedNodes.forEach(node=>visit(node,remove));
      }else if(record.attributeName==='open'){dialogs=true}
      else if(record.attributeName==='class'){
        if(record.target===document.body)states.forEach(state=>{if(mode(state.control)==='ready')changed.add(state)});
      }
      else if(record.attributeName==='data-hdr'||record.attributeName==='data-prime-hdr-surface'){visit(record.target,add)}
      else if(states.has(record.target)){changed.add(states.get(record.target))}
    }
    if(dialogs)syncAll();else changed.forEach(state=>sync(state));
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','aria-pressed','data-hdr-state','open','data-hdr','data-prime-hdr-surface','class']});
  function gesture(event){
    const target=event.target;if(!(target instanceof Element))return;
    const root=target.closest('form')||target.closest(selector);if(root)visit(root,control=>{const state=states.get(control);if(state)sync(state,true)});
  }
  for(const type of ['input','pointerdown','touchend','keydown','focusin'])document.addEventListener(type,gesture,{passive:true});
  document.addEventListener('submit',event=>requestAnimationFrame(()=>visit(event.target,control=>{const state=states.get(control);if(state)sync(state)})));
  document.addEventListener('reset',event=>requestAnimationFrame(()=>visit(event.target,control=>{const state=states.get(control);if(state)sync(state)})));
  document.addEventListener('visibilitychange',syncAll);window.addEventListener('pagehide',()=>{pageVisible=false;syncAll()});window.addEventListener('pageshow',()=>{pageVisible=true;syncAll()});
  document.addEventListener('superstar:intro-end',syncAll);
  if(parent!==window)window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&['prime:blur','prime:focus'].includes(event.data?.type)){pageVisible=event.data.type==='prime:focus';syncAll()}});
  window.SuperstarHDR={refresh};refresh();
})();
