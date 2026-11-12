(() => {
  const sticker=document.getElementById('superstar-sticker');if(!sticker)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let x=0,y=0,vx=0,vy=0,rotation=0,frame=0,lastTime=0,pointer=null,free=false,impact=0,impactAxis='x',impactOrigin='center',impactAngle='90deg';
  const limits=()=>{const view=visualViewport,rect=sticker.getBoundingClientRect();return {left:0,top:view?.offsetTop||0,right:Math.max(0,(view?.width||innerWidth)-rect.width),bottom:Math.max(0,(view?.offsetTop||0)+(view?.height||innerHeight)-rect.height)}};
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  function paint(sx=1,sy=1,fold=0,angle='90deg',origin='center'){
    sticker.style.setProperty('--sticker-x',`${x}px`);sticker.style.setProperty('--sticker-y',`${y}px`);
    sticker.style.setProperty('--sticker-scale-x',sx);sticker.style.setProperty('--sticker-scale-y',sy);
    sticker.style.setProperty('--sticker-fold',fold);sticker.style.setProperty('--sticker-fold-angle',angle);sticker.style.setProperty('--sticker-origin',origin);sticker.style.setProperty('--sticker-rotation',`${rotation}deg`);
  }
  function stop(){cancelAnimationFrame(frame);frame=0;vx=vy=0;lastTime=0}
  function start(){if(free)return;const r=sticker.getBoundingClientRect();x=r.left;y=r.top;free=true;sticker.classList.add('is-free');paint()}
  function settle(time){
    frame=0;const dt=lastTime?Math.min(2,(time-lastTime)/16.67):1;lastTime=time;const b=limits();
    x+=vx*dt;y+=vy*dt;
    if(x<b.left||x>b.right){impactOrigin=x<b.left?'left':'right';impactAngle=x<b.left?'90deg':'270deg';impactAxis='x';impact=Math.max(impact,.8);x=clamp(x,b.left,b.right);vx*=-.62}
    if(y<b.top||y>b.bottom){impactOrigin=y<b.top?'top':'bottom';impactAngle=y<b.top?'180deg':'0deg';impactAxis='y';impact=Math.max(impact,.8);y=clamp(y,b.top,b.bottom);vy*=-.62}
    const sx=impactAxis==='x'?1-.2*impact:1+.06*impact,sy=impactAxis==='y'?1-.2*impact:1+.06*impact;
    rotation+=vx*.12*dt;vx*=Math.pow(.955,dt);vy*=Math.pow(.955,dt);paint(sx,sy,impact*.5,impactAngle,impactOrigin);impact*=Math.pow(.8,dt);
    if(Math.hypot(vx,vy)>.12)frame=requestAnimationFrame(settle);else{stop();paint()}
  }
  sticker.addEventListener('pointerdown',event=>{if(!event.isPrimary||event.button!==0)return;stop();start();const r=sticker.getBoundingClientRect();pointer={id:event.pointerId,dx:event.clientX-r.left,dy:event.clientY-r.top,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp};sticker.setPointerCapture(event.pointerId);sticker.classList.add('is-grabbed')});
  sticker.addEventListener('pointermove',event=>{if(!pointer||pointer.id!==event.pointerId)return;const b=limits(),rawX=event.clientX-pointer.dx,rawY=event.clientY-pointer.dy;x=clamp(rawX,b.left,b.right);y=clamp(rawY,b.top,b.bottom);const overX=rawX-x,overY=rawY-y,pressure=Math.min(1,Math.max(Math.abs(overX),Math.abs(overY))/60);let sx=1,sy=1,origin='center',angle='90deg';if(Math.abs(overX)>Math.abs(overY)){sx=1-.23*pressure;sy=1+.07*pressure;origin=overX<0?'left':'right';angle=overX<0?'90deg':'270deg'}else if(overY){sy=1-.23*pressure;sx=1+.07*pressure;origin=overY<0?'top':'bottom';angle=overY<0?'180deg':'0deg'}const dt=Math.max(8,event.timeStamp-pointer.time);vx=clamp((event.clientX-pointer.lastX)/dt*16.67,-22,22);vy=clamp((event.clientY-pointer.lastY)/dt*16.67,-22,22);pointer.lastX=event.clientX;pointer.lastY=event.clientY;pointer.time=event.timeStamp;paint(sx,sy,pressure*.5,angle,origin)});
  function release(event){if(!pointer||pointer.id!==event.pointerId)return;if(event.timeStamp-pointer.time>90)vx=vy=0;impact=Math.min(1,Number(sticker.style.getPropertyValue('--sticker-fold'))*2);impactOrigin=sticker.style.getPropertyValue('--sticker-origin')||'center';impactAngle=sticker.style.getPropertyValue('--sticker-fold-angle')||'90deg';impactAxis=['left','right'].includes(impactOrigin)?'x':'y';pointer=null;sticker.classList.remove('is-grabbed');if(event.type==='pointercancel'||reduced.matches){stop();paint();return}lastTime=0;frame=requestAnimationFrame(settle)}
  sticker.addEventListener('pointerup',release);sticker.addEventListener('pointercancel',release);sticker.addEventListener('lostpointercapture',release);
  sticker.addEventListener('keydown',event=>{if(event.key==='Escape'&&free){stop();pointer=null;free=false;sticker.classList.remove('is-free','is-grabbed');sticker.removeAttribute('style');event.preventDefault();return}const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];if(!delta)return;event.preventDefault();stop();start();const b=limits();x=clamp(x+delta[0],b.left,b.right);y=clamp(y+delta[1],b.top,b.bottom);paint()});
  function resize(){if(!free)return;stop();const b=limits();x=clamp(x,b.left,b.right);y=clamp(y,b.top,b.bottom);paint()}
  addEventListener('resize',resize);visualViewport?.addEventListener('resize',resize);addEventListener('pagehide',stop);
})();
