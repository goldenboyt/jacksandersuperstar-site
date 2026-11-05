(() => {
  // Native HDR media, without relying on Safari's dynamic-range media query.
  // The icon is static. The silent HEVC clip contains two identical frames.
  for(const control of document.querySelectorAll('[data-prime-hdr-control]')){
    const button=control.closest('button')||control;
    const picture=document.createElement('picture');picture.className='prime-hdr-icon';picture.setAttribute('aria-hidden','true');
    // Keep the SDR preview crisp; this query never gates native HDR video.
    const source=document.createElement('source');source.type='image/avif';source.media='(dynamic-range: high)';source.srcset='/assets/prime-send-hdr.avif';
    const image=document.createElement('img');image.alt='';image.width=96;image.height=96;
    image.addEventListener('load',()=>control.classList.add('prime-hdr-icon-ready'));
    image.addEventListener('error',()=>control.classList.remove('prime-hdr-icon-ready'));
    image.src='/assets/prime-send.svg';picture.append(source,image);control.append(picture);

    const video=document.createElement('video');
    if(!video.canPlayType('video/mp4; codecs="hvc1"'))continue;
    video.className='prime-hdr-video';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;
    video.preload='none';video.disablePictureInPicture=true;video.disableRemotePlayback=true;
    video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.setAttribute('tabindex','-1');
    control.append(video);
    let inView=false,pending=false,pendingSync=false,failed=false,blocked=false;
    const visible=()=>inView&&!document.hidden&&!button.disabled&&!document.querySelector('dialog[open]')&&!document.documentElement.classList.contains('intro-pending');
    function stop(){video.pause();control.classList.remove('prime-hdr-video-ready')}
    function sync(gesture=false){
      if(!visible()||failed){stop();return;}
      if(pending){pendingSync=true;return;}
      if((!video.paused&&video.readyState>=2)||(blocked&&!gesture))return;
      if(!video.getAttribute('src'))video.src='/assets/prime-send-hdr.mp4';
      pending=true;video.muted=true;
      let result;
      try{result=video.play()}catch{pending=false;pendingSync=false;failed=true;return;}
      Promise.resolve(result).then(()=>{pending=false;pendingSync=false;blocked=false;if(!visible())stop()},error=>{
        const retry=pendingSync;pending=false;pendingSync=false;blocked=error.name==='NotAllowedError';if(error.name==='NotSupportedError')failed=true;
        control.classList.remove('prime-hdr-video-ready');
        if(retry&&error.name==='AbortError'&&visible())sync();
      });
    }
    video.addEventListener('playing',()=>{if(visible())control.classList.add('prime-hdr-video-ready');else stop()});
    video.addEventListener('pause',()=>control.classList.remove('prime-hdr-video-ready'));
    video.addEventListener('error',()=>{failed=true;stop()});
    if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync()},{threshold:0}).observe(button);
    else{inView=true;sync();}
    const observer=new MutationObserver(()=>sync());
    observer.observe(button,{attributes:true,attributeFilter:['disabled']});
    document.querySelectorAll('dialog').forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['open']}));
    // Retry blocked autoplay during an actual interaction, without delaying chat.
    for(const type of ['pointerdown','touchend','keydown','focusin'])(button.closest('form')||button).addEventListener(type,()=>sync(true),{passive:true});
    document.addEventListener('visibilitychange',()=>sync());window.addEventListener('pagehide',stop);window.addEventListener('pageshow',()=>sync());
    document.addEventListener('superstar:intro-end',()=>sync());
    if(parent!==window)window.addEventListener('message',event=>{
      if(event.origin!==location.origin||event.source!==parent)return;
      if(event.data?.type==='prime:blur'){inView=false;stop()}
      if(event.data?.type==='prime:focus'){inView=true;sync(true)}
    });
  }
})();
