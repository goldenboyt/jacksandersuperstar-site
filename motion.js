(() => {
  const hero=document.querySelector('.hero');
  const title=document.getElementById('hero-title');
  const header=document.getElementById('header');
  const live=document.getElementById('live');
  const videoStage=document.getElementById('music-video-stage');
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const navLinks=[...document.querySelectorAll('.desktop-nav a')];
  const sections=navLinks.map(a=>document.querySelector(a.getAttribute('href')));
  const PHOTO_WIDTH=1152,PHOTO_HEIGHT=1536,HEAD_TOP=573,HEAD_BOTTOM=687;
  let ticking=false,resizeTick=0,heroHeight=0,lastActive=null;
  const offsets=new Map();
  function setOffset(element,name,value){
    const key=`${element.id}:${name}`;
    if(offsets.get(key)===value)return;
    offsets.set(key,value);element.style.setProperty(name,value);
  }

  // Anchor the lower title line to the subject's face using cover geometry.
  function placeTitle(){
    // Preserve fractional CSS sizes used by browser zoom and display scaling.
    const {width,height}=hero.getBoundingClientRect();
    const styles=getComputedStyle(hero);
    const positionY=parseFloat(styles.getPropertyValue('--photo-y'))/100;
    const positionX=parseFloat(styles.getPropertyValue('--photo-x'))/100;
    const scale=Math.max(width/PHOTO_WIDTH,height/PHOTO_HEIGHT);
    const renderedHeight=PHOTO_HEIGHT*scale;
    let offsetY=(height-renderedHeight)*positionY;
    const headAnchor=(HEAD_TOP+(HEAD_BOTTOM-HEAD_TOP)*.64)*scale;
    const renderedWidth=PHOTO_WIDTH*scale;
    title.style.fontSize='';title.style.maxWidth='';
    // Measure real glyphs instead of guessing from viewport units.
    const maxLine=Math.max(...[...title.querySelectorAll('.title-line')].map(el=>el.scrollWidth));
    const titleWidth=title.clientWidth;
    if(maxLine>titleWidth){title.style.fontSize=`${parseFloat(getComputedStyle(title).fontSize)*titleWidth/maxLine}px`}
    let titleHeight=title.offsetHeight;
    if(width>640){
      // Keep the face overlap and bottom links clear in wide, short windows.
      const availableHeight=height-130-150;
      if(titleHeight>availableHeight){
        title.style.maxWidth=`${title.clientWidth*availableHeight/titleHeight}px`;
        titleHeight=title.offsetHeight;
      }
      // Move both copies of the photo together when the title hits its top limit.
      offsetY=Math.min(0,Math.max(height-renderedHeight,offsetY,130+titleHeight-headAnchor));
    }
    const headDip=headAnchor+offsetY;
    // Frame the body on desktop, keeping the head clear of the header.
    if(width>640){
      const headTop=Math.max(120,Math.min(180,height*.15));
      offsetY=Math.max(height-renderedHeight,Math.min(offsetY,headTop-HEAD_TOP*scale));
    }
    hero.style.setProperty('--photo-width',`${renderedWidth}px`);
    hero.style.setProperty('--photo-height',`${renderedHeight}px`);
    hero.style.setProperty('--photo-left',`${(width-renderedWidth)*positionX}px`);
    hero.style.setProperty('--photo-top',`${offsetY}px`);
    heroHeight=height;
    const top=Math.max(width<=640?150:130,Math.min(headDip-titleHeight,height*.7-titleHeight));
    hero.style.setProperty('--title-top',`${top.toFixed(1)}px`);
  }
  function frame(){
    ticking=false;
    const scroll=window.scrollY;
    const height=heroHeight,viewportHeight=window.innerHeight;
    const y=Math.max(0,Math.min(scroll,height));
    // Read section geometry before changing styles to avoid forced layout work.
    const liveRect=live.getBoundingClientRect();
    const videoRect=videoStage.getBoundingClientRect();
    const sectionRects=sections.map(section=>section?.getBoundingClientRect());
    const progress=rect=>Math.max(-1,Math.min(1,(viewportHeight/2-rect.top-rect.height/2)/((viewportHeight+rect.height)/2)));
    const liveProgress=progress(liveRect);
    const liveTravel=Math.min(90,liveRect.height*.14);
    const videoTravel=Math.min(window.innerWidth<=640?20:36,videoRect.height*.045);
    const line=viewportHeight*.34;
    let active='';
    sectionRects.forEach((rect,index)=>{if(rect?.top<=line&&rect.bottom>line)active=sections[index].id});
    header.classList.toggle('scrolled',scroll>height-90);
    setOffset(hero,'--hero-parallax',preference.matches?'0px':`${(y*.24).toFixed(2)}px`);
    setOffset(hero,'--title-drift',preference.matches?'0px':`${(-y*.035).toFixed(2)}px`);
    setOffset(live,'--live-parallax',preference.matches?'0px':`${(liveProgress*liveTravel).toFixed(2)}px`);
    setOffset(videoStage,'--video-parallax',preference.matches?'0px':`${(progress(videoRect)*videoTravel).toFixed(2)}px`);
    if(active!==lastActive){
      lastActive=active;
      navLinks.forEach(a=>{if(a.hash===`#${active}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});
    }
  }
  function requestFrame(){if(!ticking){ticking=true;requestAnimationFrame(frame)}}
  window.addEventListener('scroll',requestFrame,{passive:true});
  window.addEventListener('resize',()=>{cancelAnimationFrame(resizeTick);resizeTick=requestAnimationFrame(()=>{placeTitle();frame()})});
  preference.addEventListener('change',()=>{placeTitle();frame()});
  placeTitle();frame();
  if(document.fonts)document.fonts.ready.then(placeTitle);

  // Keep the original text for assistive technology; animate visual copies.
  function splitHeading(heading){
    let index=0;
    const original=heading.textContent.trim();
    const textNodes=[...heading.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE);
    heading.setAttribute('aria-label',original);
    textNodes.forEach(node=>{
      const fragment=document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(word=>{
        if(!word)return;
        if(/^\s+$/.test(word)){fragment.append(document.createTextNode(word));return}
        const mask=document.createElement('span');mask.className='letter-word';mask.setAttribute('aria-hidden','true');
        for(const character of word){const span=document.createElement('span');span.className='letter';span.style.setProperty('--letter-index',index++);span.textContent=character;mask.append(span)}
        mask.addEventListener('transitionend',event=>{
          if(event.target===mask.lastElementChild&&event.propertyName==='transform')mask.classList.add('revealed');
        });
        fragment.append(mask);
      });
      node.replaceWith(fragment);
    });
  }
  if(!preference.matches&&'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.15,rootMargin:'0px 0px -10% 0px'});
    document.querySelectorAll('.section-heading').forEach(section=>{splitHeading(section.querySelector('h2'));section.classList.add('motion-ready');observer.observe(section)});
    const cover=document.querySelector('.cover-button');const coverImage=cover.querySelector('img');const coverViewport=document.createElement('span');coverViewport.className='cover-viewport';coverImage.before(coverViewport);coverViewport.append(coverImage);
    const groups=['.cover-button','.release-copy','.release-card','.catalog-header','.product','.soboda-copy','.soboda-image','.live-top','.live-heading','.live-bottom'];
    document.querySelectorAll(groups.join(',')).forEach(element=>{element.classList.add('motion-reveal');if(element.classList.contains('release-card'))element.style.setProperty('--reveal-delay',`${[...element.parentElement.children].indexOf(element)*45}ms`);observer.observe(element)});
  }
})();
