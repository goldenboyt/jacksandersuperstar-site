(() => {
  // Native, neutral HDR edge lighting; icons and labels stay ordinary page content.
  for(const control of document.querySelectorAll('[data-prime-hdr-surface]')){
    const form=control.closest('form'),input=form?.querySelector('textarea,input:not([type=file])'),dialog=control.closest('dialog');
    const picture=document.createElement('picture');picture.className='prime-hdr-light';picture.setAttribute('aria-hidden','true');
    const source=document.createElement('source');source.type='image/avif';source.media='(dynamic-range: high)';source.srcset='/assets/prime-action-light.avif';
    const image=document.createElement('img');image.alt='';image.width=192;image.height=192;
    image.addEventListener('load',()=>control.classList.add('prime-hdr-image-loaded'));
    image.addEventListener('error',()=>control.classList.remove('prime-hdr-image-loaded'));
    image.src='/assets/prime-action-light.svg';picture.append(source,image);control.append(picture);
    const video=document.createElement('video'),supported=Boolean(video.canPlayType('video/mp4; codecs="hvc1"'));
    if(supported){
      video.className='prime-hdr-light-video';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;
      video.preload='none';video.disablePictureInPicture=true;video.disableRemotePlayback=true;
      video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.setAttribute('tabindex','-1');control.append(video);
    }
    let inView=false,pending=false,retryPending=false,failed=false,blocked=false;
    function visible(){
      const openDialogs=[...document.querySelectorAll('dialog[open]')];
      return inView&&!document.hidden&&!control.disabled&&(!dialog||dialog.open)&&openDialogs.every(open=>open.contains(control))&&!document.documentElement.classList.contains('intro-pending')&&(!input||Boolean(input.value.trim()));
    }
    function stop(){if(supported)video.pause();control.classList.remove('prime-hdr-video-ready')}
    function sync(gesture=false){
      const active=visible();control.classList.toggle('prime-hdr-active',active);
      if(!active||failed){stop();return}
      if(!supported)return;
      if(pending){retryPending=true;return}
      if((!video.paused&&video.readyState>=2)||(blocked&&!gesture))return;
      if(!video.getAttribute('src'))video.src='/assets/prime-action-light.mp4';
      pending=true;video.muted=true;
      let result;try{result=video.play()}catch{pending=false;retryPending=false;failed=true;return}
      Promise.resolve(result).then(()=>{pending=false;retryPending=false;blocked=false;if(!visible())stop()},error=>{
        const retry=retryPending;pending=false;retryPending=false;blocked=error.name==='NotAllowedError';if(error.name==='NotSupportedError')failed=true;
        control.classList.remove('prime-hdr-video-ready');
        if(retry&&error.name==='AbortError'&&visible())sync();
      });
    }
    if(supported){
      video.addEventListener('playing',()=>{if(visible())control.classList.add('prime-hdr-video-ready');else stop()});
      video.addEventListener('pause',()=>control.classList.remove('prime-hdr-video-ready'));
      video.addEventListener('error',()=>{failed=true;stop()});
    }
    if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync()},{threshold:0}).observe(control);
    else{inView=true;sync()}
    const observer=new MutationObserver(()=>sync());observer.observe(control,{attributes:true,attributeFilter:['disabled']});
    document.querySelectorAll('dialog').forEach(open=>observer.observe(open,{attributes:true,attributeFilter:['open']}));
    for(const type of ['input','pointerdown','touchend','keydown','focusin'])(form||control).addEventListener(type,()=>sync(true),{passive:true});
    form?.addEventListener('reset',()=>requestAnimationFrame(()=>sync()));
    form?.addEventListener('submit',()=>requestAnimationFrame(()=>sync()));
    document.addEventListener('visibilitychange',()=>sync());window.addEventListener('pagehide',stop);window.addEventListener('pageshow',()=>sync());
    document.addEventListener('superstar:intro-end',()=>sync());
    if(parent!==window)window.addEventListener('message',event=>{
      if(event.origin!==location.origin||event.source!==parent)return;
      if(event.data?.type==='prime:blur'){inView=false;sync()}
      if(event.data?.type==='prime:focus'){inView=true;sync(true)}
    });
  }
})();
