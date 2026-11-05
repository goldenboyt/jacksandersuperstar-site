(() => {
  const launcher=document.getElementById('prime-widget-open');
  if(!launcher)return;
  let frame=0,lastLayoutWidth=0;
  function position(){
    frame=0;
    const view=window.visualViewport,layoutWidth=document.documentElement.clientWidth||innerWidth;
    const changed=!lastLayoutWidth||Math.abs(layoutWidth-lastLayoutWidth)>1,scaled=Boolean(view&&Math.abs(view.scale-1)>.01);
    if(scaled&&!changed)return;
    const top=scaled?0:Math.max(0,view?.offsetTop||0),layoutHeight=scaled?(document.documentElement.clientHeight||innerHeight):innerHeight;
    const bounds=window.SuperstarViewport?.bounds();
    const width=Math.min(layoutWidth,scaled?layoutWidth:(bounds?.width||view?.width||layoutWidth)),height=scaled?layoutHeight:Math.min(layoutHeight,view?.height||layoutHeight);
    launcher.style.setProperty('--launcher-right',`${(bounds?.right??layoutWidth-width)+(width<=640?16:24)}px`);
    launcher.style.setProperty('--launcher-bottom',`${Math.max(0,layoutHeight-top-height)+(width<=640?20:24)}px`);
    lastLayoutWidth=layoutWidth;
    syncVisibility();
  }
  function syncVisibility(){
    const hidden=document.documentElement.classList.contains('intro-pending')||Boolean(document.querySelector('dialog[open]'));
    if(launcher.hidden!==hidden)launcher.hidden=hidden;
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(position)}
  document.querySelectorAll('dialog').forEach(dialog=>new MutationObserver(schedule).observe(dialog,{attributes:true,attributeFilter:['open']}));
  document.addEventListener('superstar:intro-end',syncVisibility);
  document.addEventListener('superstar:viewport',schedule);
  window.addEventListener('resize',schedule);window.addEventListener('pageshow',position);window.addEventListener('load',position);window.addEventListener('hashchange',syncVisibility);
  window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  position();
})();
