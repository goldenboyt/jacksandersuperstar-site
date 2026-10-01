(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const touch=matchMedia('(hover: none), (pointer: coarse)');
  let scroll=null;
  function setup(){
    scroll?.destroy();scroll=null;
    if(reduced.matches||touch.matches||!window.Lenis)return;
    scroll=new Lenis({duration:1.05,easing:t=>t===1?1:1-Math.pow(2,-10*t),smoothWheel:true,syncTouch:false,autoRaf:true,prevent:element=>element.closest('dialog')!==null});
    lock();
  }
  function lock(){if(document.documentElement.classList.contains('intro-pending')||document.querySelector('dialog[open]'))scroll?.stop();else scroll?.start()}
  document.addEventListener('superstar:intro-end',lock);
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href^="#"]');if(!scroll||!link)return;
    const target=document.getElementById(link.hash.slice(1));if(!target)return;
    event.preventDefault();scroll.scrollTo(target,{offset:-85,duration:1.1,onComplete:()=>{
      if(link.classList.contains('skip')){
        if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
        target.focus({preventScroll:true});
      }
    }});history.replaceState(null,'',link.hash);
  });
  document.querySelectorAll('dialog').forEach(dialog=>new MutationObserver(lock).observe(dialog,{attributes:true,attributeFilter:['open']}));
  reduced.addEventListener('change',setup);touch.addEventListener('change',setup);setup();
  const menu=document.getElementById('menu');
  const menuOpen=document.getElementById('menu-open');
  let menuTimer=null;
  menu.querySelectorAll('nav a').forEach((link,index)=>link.style.setProperty('--menu-index',index));
  const menuArt=document.createElement('img');
  menuArt.className='menu-art';menuArt.src='assets/album.webp';menuArt.alt='';menuArt.loading='lazy';menuArt.setAttribute('aria-hidden','true');menu.append(menuArt);
  function closeMenu(){
    if(!menu.open||menu.classList.contains('menu-leaving'))return;
    menuOpen.setAttribute('aria-expanded','false');
    if(reduced.matches){menu.close();return}
    menu.classList.add('menu-leaving');
    menuTimer=setTimeout(()=>{menu.close();menu.classList.remove('menu-leaving')},280);
  }
  menuOpen.addEventListener('click',()=>{
    clearTimeout(menuTimer);menu.classList.remove('menu-leaving');
    menu.showModal();menuOpen.setAttribute('aria-expanded','true');
  });
  menu.addEventListener('cancel',event=>{event.preventDefault();closeMenu()});
  menu.addEventListener('close',()=>{clearTimeout(menuTimer);menu.classList.remove('menu-leaving');menuOpen.setAttribute('aria-expanded','false')});
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>{
    const dialog=document.getElementById(button.dataset.close);if(dialog===menu)closeMenu();else dialog.close();
  }));
  menu.querySelectorAll('nav a').forEach(link=>link.addEventListener('click',event=>{
    const address=new URL(link.href,location.href);
    const samePage=address.origin===location.origin&&(address.pathname===location.pathname||(['/','/index.html'].includes(address.pathname)&&['/','/index.html'].includes(location.pathname)));
    if(!samePage||!address.hash){closeMenu();return}
    const target=document.getElementById(address.hash.slice(1));if(!target)return;
    event.preventDefault();event.stopPropagation();
    menu.addEventListener('close',()=>{
      if(scroll)scroll.scrollTo(target,{offset:-85,duration:1.1});else target.scrollIntoView({behavior:reduced.matches?'instant':'smooth'});
      if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
      history.replaceState(history.state,'',address.hash);
    },{once:true});
    closeMenu();
  }));
  // Warm only existing local destinations, as the reference does between pages.
  const prefetched=new Set();
  document.addEventListener('pointerover',event=>{
    const link=event.target.closest('a[href]');if(!link||navigator.connection?.saveData)return;
    const address=new URL(link.href,location.href);
    if(address.origin!==location.origin||address.pathname===location.pathname||!address.pathname.endsWith('.html')||prefetched.has(address.pathname))return;
    prefetched.add(address.pathname);const hint=document.createElement('link');hint.rel='prefetch';hint.href=address.pathname;document.head.append(hint);
  },{passive:true});
  const header=document.getElementById('header');
  let headerTick=false;
  function updateHeader(){
    headerTick=false;
    const hidden=window.scrollY>64;
    header.classList.toggle('header-away',hidden);header.inert=hidden||document.documentElement.classList.contains('intro-pending');
  }
  window.addEventListener('scroll',()=>{if(!headerTick){headerTick=true;requestAnimationFrame(updateHeader)}},{passive:true});
  window.addEventListener('pageshow',updateHeader);updateHeader();
  document.addEventListener('superstar:intro-end',updateHeader);
  if(!reduced.matches&&'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('arrived');observer.unobserve(entry.target)}}),{threshold:.06,rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('.shop-product,.shop-intro,.shop-order,.video-heading,.music-video-links,footer .footer-top').forEach((element,i)=>{element.classList.add('section-arrive');element.style.setProperty('--arrive-delay',`${i%3*70}ms`);observer.observe(element)});
  }
})();
