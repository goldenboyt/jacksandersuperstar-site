(() => {
  const dialog=document.getElementById('prime-widget'),frame=document.getElementById('prime-widget-frame');
  const launcher=document.getElementById('prime-widget-open'),close=document.getElementById('prime-widget-close'),expand=document.getElementById('prime-widget-expand');
  if(!dialog||!frame||!launcher)return;
  const startForm=document.getElementById('prime-feature-form'),startInput=document.getElementById('prime-feature-input');
  let opener=launcher,scrollY=0,overflow='',typing=false,restingHeight=innerHeight,ready=false,pending='';
  const tesla=/\bTesla\b/i.test(navigator.userAgent);
  function position(){
    const view=window.visualViewport;if(view&&view.scale!==1)return;
    const top=Math.max(0,view?.offsetTop||0),margin=innerWidth<=640?12:24;
    let available=Math.min(innerHeight,view?.height||innerHeight);
    const keyboard=navigator.virtualKeyboard?.boundingRect;
    if(!typing)restingHeight=available;
    if(typing&&keyboard?.height>0&&keyboard.top>top)available=Math.min(available,keyboard.top-top);
    else if(tesla&&typing&&restingHeight-available<96)available=Math.min(available,Math.floor(restingHeight/2));
    const height=Math.max(160,Math.min(dialog.classList.contains('is-expanded')?900:640,available-margin*2));
    dialog.style.setProperty('--widget-top',`${top+Math.max(margin,available-height-margin)}px`);
    dialog.style.setProperty('--widget-height',`${height}px`);
  }
  function send(type,data={}){frame.contentWindow?.postMessage({type,...data},location.origin)}
  function begin(){if(!ready)return;if(pending){send('prime:send',{text:pending});pending='';if(startInput)startInput.value=''}else send('prime:focus')}
  function open(event,text=''){
    event?.preventDefault();opener=event?.currentTarget===startForm?startInput:event?.currentTarget||launcher;if(text)pending=text;
    if(!dialog.open){scrollY=window.scrollY;overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';dialog.showModal();launcher.setAttribute('aria-expanded','true')}
    position();
    if(!frame.getAttribute('src'))frame.src='/jackprime?embed=1';else begin();
  }
  function finish(){
    typing=false;send('prime:blur');document.documentElement.style.overflow=overflow;
    launcher.setAttribute('aria-expanded','false');window.scrollTo({top:scrollY,behavior:'instant'});opener?.focus({preventScroll:true});
  }
  launcher.hidden=false;launcher.addEventListener('click',open);
  document.querySelectorAll('[data-prime-open]').forEach(link=>link.addEventListener('click',open));
  startForm?.addEventListener('submit',event=>{const text=startInput.value.trim();if(text)open(event,text);else event.preventDefault()});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',finish);
  expand.addEventListener('click',()=>{const expanded=dialog.classList.toggle('is-expanded');expand.setAttribute('aria-pressed',String(expanded));expand.textContent=expanded?'reduce':'expand';position()});
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    if(event.data?.type==='prime:ready'){ready=true;if(dialog.open)begin()}
    if(event.data?.type==='prime:close'&&dialog.open)dialog.close();
    if(event.data?.type==='prime:typing'){typing=Boolean(event.data.value);position()}
  });
  window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);navigator.virtualKeyboard?.addEventListener('geometrychange',position);
})();
