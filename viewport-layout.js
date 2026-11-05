(() => {
  const page=document.querySelector('body.home-page');if(!page)return;
  let frame=0,restingHeight=0,lastWidth=0,keyboardFrozen=false;
  function update(){
    frame=0;
    const view=window.visualViewport;if(view&&Math.abs(view.scale-1)>.01)return;
    const layoutWidth=document.documentElement.clientWidth||innerWidth;
    const left=Math.max(0,Math.min(view?.offsetLeft||0,layoutWidth));
    const width=Math.max(1,Math.min(view?.width||layoutWidth,layoutWidth-left));
    const top=Math.max(0,view?.offsetTop||0),height=Math.min(innerHeight,view?.height||innerHeight);
    const typing=document.activeElement?.matches('input,textarea,[contenteditable=true]')||Boolean(document.querySelector('dialog[open]'));
    const keyboard=typing&&(matchMedia('(pointer: coarse)').matches||innerHeight-height>150);
    // Keyboard dismissal can report its old bounds briefly. Keep the hero stable
    // while typing, then accept normal browser-chrome and orientation changes.
    if(keyboard)keyboardFrozen=true;
    if(!restingHeight||(!keyboard&&(!keyboardFrozen||height>=restingHeight*.72||Math.abs(width-lastWidth)>120))){restingHeight=height;keyboardFrozen=false;}
    const gutter=width<=640?width*.06:Math.max(width*.055,(width-1660)/2);
    for(const [name,value] of Object.entries({width,left,right:layoutWidth-left-width,top,height,hero:restingHeight,gutter}))page.style.setProperty(`--home-${name}`,`${value}px`);
    page.classList.toggle('home-compact',width<=1000);page.classList.toggle('home-narrow',width<=640);page.classList.toggle('home-short',restingHeight<720);
    lastWidth=width;
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update)}
  window.addEventListener('resize',schedule);window.addEventListener('pageshow',schedule);window.addEventListener('orientationchange',schedule);
  window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  document.addEventListener('focusout',schedule);update();
})();
