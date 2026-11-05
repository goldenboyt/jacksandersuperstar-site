(() => {
  const dialog=document.getElementById('prime-widget'),frame=document.getElementById('prime-widget-frame');
  const launcher=document.getElementById('prime-widget-open'),close=document.getElementById('prime-widget-close'),expand=document.getElementById('prime-widget-expand');
  const hero=document.querySelector('.hero'),heroLauncher=document.getElementById('prime-hero-open');
  if(!dialog||!frame||!launcher)return;
  let opener=launcher,scrollY=0,overflow='',typing=false,restingHeight=innerHeight,ready=false;
  const tesla=/\bTesla\b/i.test(navigator.userAgent);
  function position(){
    const view=window.visualViewport;if(view&&view.scale!==1)return;
    const top=Math.max(0,view?.offsetTop||0),left=Math.max(0,view?.offsetLeft||0),width=Math.min(innerWidth-left,view?.width||innerWidth),margin=width<=640?12:24;
    let available=Math.min(innerHeight,view?.height||innerHeight);
    const keyboard=navigator.virtualKeyboard?.boundingRect;
    if(!typing)restingHeight=available;
    if(typing&&keyboard?.height>0&&keyboard.top>top)available=Math.min(available,keyboard.top-top);
    else if(tesla&&typing&&restingHeight-available<96)available=Math.min(available,Math.floor(restingHeight/2));
    const height=Math.max(160,Math.min(dialog.classList.contains('is-expanded')?900:640,available-margin*2));
    const panelWidth=dialog.classList.contains('is-expanded')?Math.min(900,width-margin*2):width<=640?width-margin*2:Math.min(440,width-margin*2);
    dialog.style.setProperty('--widget-width',`${panelWidth}px`);
    dialog.style.setProperty('--widget-right',`${innerWidth-left-width+margin}px`);
    dialog.style.setProperty('--widget-top',`${top+Math.max(margin,available-height-margin)}px`);
    dialog.style.setProperty('--widget-height',`${height}px`);
    launcher.style.setProperty('--launcher-right',`${innerWidth-left-width+(width<=640?16:24)}px`);
    launcher.style.setProperty('--launcher-bottom',`${Math.max(0,innerHeight-top-available)+(width<=640?20:24)}px`);
    syncLauncher();
  }
  function syncLauncher(){
    const top=window.visualViewport?.offsetTop||0;
    launcher.hidden=dialog.open||Boolean(hero&&hero.getBoundingClientRect().bottom>top+100);
  }
  function send(type,data={}){frame.contentWindow?.postMessage({type,...data},location.origin)}
  function begin(){if(ready)send('prime:focus')}
  function open(event){
    event?.preventDefault();opener=event?.currentTarget||launcher;
    if(!dialog.open){scrollY=window.scrollY;overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';dialog.showModal();launcher.setAttribute('aria-expanded','true');heroLauncher?.setAttribute('aria-expanded','true')}
    position();
    if(!frame.getAttribute('src'))frame.src='/jackprime?embed=1';else begin();
  }
  function finish(){
    typing=false;send('prime:blur');document.documentElement.style.overflow=overflow;
    launcher.setAttribute('aria-expanded','false');heroLauncher?.setAttribute('aria-expanded','false');window.scrollTo({top:scrollY,behavior:'instant'});syncLauncher();opener?.focus({preventScroll:true});
  }
  launcher.addEventListener('click',open);
  if(heroLauncher){heroLauncher.hidden=false;heroLauncher.addEventListener('click',open)}
  if(hero&&'IntersectionObserver' in window)new IntersectionObserver(syncLauncher,{rootMargin:'-100px 0px 0px 0px'}).observe(hero);
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',finish);
  expand.addEventListener('click',()=>{const expanded=dialog.classList.toggle('is-expanded');expand.setAttribute('aria-pressed',String(expanded));expand.textContent=expanded?'reduce':'expand';position()});
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    if(event.data?.type==='prime:ready'){ready=true;if(dialog.open)begin()}
    if(event.data?.type==='prime:close'&&dialog.open)dialog.close();
    if(event.data?.type==='prime:typing'){typing=Boolean(event.data.value);position()}
  });
  window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);navigator.virtualKeyboard?.addEventListener('geometrychange',position);
  position();
})();
