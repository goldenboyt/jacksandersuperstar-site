(() => {
  const launcher=document.getElementById('prime-widget-open'),hero=document.querySelector('.hero');
  if(!launcher)return;
  let frame=0;
  function position(){
    frame=0;
    const view=window.visualViewport;if(view&&Math.abs(view.scale-1)>.01)return;
    const top=Math.max(0,view?.offsetTop||0),left=Math.max(0,view?.offsetLeft||0);
    const width=Math.min(innerWidth-left,view?.width||innerWidth),height=Math.min(innerHeight,view?.height||innerHeight);
    launcher.style.setProperty('--launcher-right',`${innerWidth-left-width+(width<=640?16:24)}px`);
    launcher.style.setProperty('--launcher-bottom',`${Math.max(0,innerHeight-top-height)+(width<=640?20:24)}px`);
    syncVisibility();
  }
  function syncVisibility(){
    const hidden=Boolean(hero&&hero.getBoundingClientRect().bottom>(window.visualViewport?.offsetTop||0)+100)||Boolean(document.querySelector('dialog[open]'));
    if(launcher.hidden!==hidden)launcher.hidden=hidden;
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(position)}
  if(hero&&'IntersectionObserver' in window)new IntersectionObserver(syncVisibility,{rootMargin:'-100px 0px 0px 0px'}).observe(hero);
  document.querySelectorAll('dialog').forEach(dialog=>new MutationObserver(schedule).observe(dialog,{attributes:true,attributeFilter:['open']}));
  window.addEventListener('scroll',syncVisibility,{passive:true});
  window.addEventListener('resize',schedule);window.addEventListener('pageshow',position);window.addEventListener('load',position);window.addEventListener('hashchange',syncVisibility);
  window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  position();
})();
