(() => {
  const gallery=document.querySelector('.tee-slideshow');
  if(!gallery)return;
  const slides=[...gallery.querySelectorAll('.tee-slide')];
  const count=document.getElementById('tee-count');
  const toggle=document.getElementById('tee-pause');
  const status=document.getElementById('tee-status');
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  let index=0,timer=null,visible=false,hovered=false,focused=false,paused=preference.matches,interactionPlayback=false,changeId=0;
  const load=async i=>{
    const img=slides[i].querySelector('img');
    if(img.dataset.src){img.src=img.dataset.src;delete img.dataset.src}
    try{await img.decode()}catch{return false}
    return img.naturalWidth>0;
  };
  function controls(){toggle.textContent=paused?'play':'pause';toggle.setAttribute('aria-label',paused?'Play slideshow':'Pause slideshow')}
  function sync(){
    clearTimeout(timer);timer=null;
    if(visible&&!paused&&(!hovered||interactionPlayback)&&(!focused||interactionPlayback)&&!document.hidden&&!document.querySelector('dialog[open]'))timer=setTimeout(()=>show(index+1),4500);
  }
  async function show(next,manual=false){
    const request=++changeId;
    const candidate=(next+slides.length)%slides.length;
    if(!await load(candidate)||request!==changeId){sync();return}
    slides[index].classList.remove('is-active');slides[index].setAttribute('aria-hidden','true');
    index=candidate;slides[index].classList.add('is-active');slides[index].setAttribute('aria-hidden','false');
    count.textContent=`${String(index+1).padStart(2,'0')} / ${slides.length}`;
    if(manual)status.textContent=`Photo ${index+1} of ${slides.length}`;
    load((index+1)%slides.length);sync();
  }
  document.getElementById('tee-prev').addEventListener('click',()=>show(index-1,true));
  document.getElementById('tee-next').addEventListener('click',()=>show(index+1,true));
  toggle.addEventListener('click',()=>{paused=!paused;interactionPlayback=!paused;controls();sync()});
  gallery.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(index+(event.key==='ArrowRight'?1:-1),true)}});
  gallery.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovered=true;interactionPlayback=false;sync()}});
  gallery.addEventListener('pointerleave',()=>{hovered=false;sync()});
  gallery.addEventListener('focusin',event=>{focused=true;if(!gallery.contains(event.relatedTarget))interactionPlayback=false;sync()});
  gallery.addEventListener('focusout',event=>{if(!gallery.contains(event.relatedTarget)){focused=false;sync()}});
  let startX=0,startY=0;
  gallery.addEventListener('touchstart',event=>{startX=event.changedTouches[0].clientX;startY=event.changedTouches[0].clientY},{passive:true});
  gallery.addEventListener('touchend',event=>{const dx=event.changedTouches[0].clientX-startX,dy=event.changedTouches[0].clientY-startY;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)show(index+(dx<0?1:-1),true)},{passive:true});
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)load((index+1)%slides.length);sync()},{threshold:.2}).observe(gallery);
  document.addEventListener('visibilitychange',sync);
  document.querySelectorAll('dialog').forEach(dialog=>new MutationObserver(sync).observe(dialog,{attributes:true,attributeFilter:['open']}));
  preference.addEventListener('change',()=>{paused=preference.matches;interactionPlayback=false;controls();sync()});
  controls();
})();
