(() => {
  const page=document.querySelector('body.home-page');if(!page)return;
  let frame=0,restingHeight=0,lastWidth=0,lastLayoutWidth=0,keyboardFrozen=false;
  function update(){
    frame=0;
    const layoutWidth=document.documentElement.clientWidth||innerWidth;
    const view=window.visualViewport,changed=!lastLayoutWidth||Math.abs(layoutWidth-lastLayoutWidth)>1;
    const scaled=Boolean(view&&Math.abs(view.scale-1)>.01);
    if(scaled&&!changed)return;
    // Split-view chrome already positions the page. Its horizontal viewport
    // offset must not become a second margin inside the narrowed page.
    const bounds=window.SuperstarViewport?.bounds();
    const left=bounds?.left||0,width=Math.max(1,Math.min(scaled?layoutWidth:(bounds?.width||view?.width||layoutWidth),layoutWidth-left));
    // Extend imagery under narrow browser chrome, without moving the subject
    // out of a genuinely small split-view pane in a wider virtual layout.
    const bleed=bounds?.full||Math.min(layoutWidth,width*1.4),bleedLeft=bounds?.left||0;
    const layoutHeight=scaled?(document.documentElement.clientHeight||innerHeight):innerHeight;
    const top=scaled?0:Math.max(0,view?.offsetTop||0),height=scaled?layoutHeight:Math.min(layoutHeight,view?.height||layoutHeight);
    const typing=document.activeElement?.matches('input,textarea,[contenteditable=true]')||Boolean(document.querySelector('dialog[open]'));
    const keyboard=typing&&(matchMedia('(pointer: coarse)').matches||innerHeight-height>150);
    // Keyboard dismissal can report its old bounds briefly. Keep the hero stable
    // while typing, then accept normal browser-chrome and orientation changes.
    if(keyboard)keyboardFrozen=true;
    if(!restingHeight||(!keyboard&&(!keyboardFrozen||height>=restingHeight*.72||Math.abs(width-lastWidth)>120))){restingHeight=height;keyboardFrozen=false;}
    const gutter=width<=640?width*.06:Math.max(width*.055,(width-1660)/2);
    for(const [name,value] of Object.entries({width,left,right:layoutWidth-left-width,bleed,'bleed-left':bleedLeft,'bleed-right':bleed-bleedLeft-width,top,height,hero:restingHeight,gutter}))page.style.setProperty(`--home-${name}`,`${value}px`);
    page.classList.toggle('home-compact',width<=1000);page.classList.toggle('home-narrow',width<=640);page.classList.toggle('home-short',restingHeight<720);
    lastWidth=width;lastLayoutWidth=layoutWidth;
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update)}
  window.addEventListener('resize',schedule);window.addEventListener('pageshow',schedule);window.addEventListener('orientationchange',schedule);
  window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  document.addEventListener('focusout',schedule);document.addEventListener('superstar:viewport',schedule);update();
})();
