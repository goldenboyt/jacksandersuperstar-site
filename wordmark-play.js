(() => {
  const header = document.getElementById('header');
  const logo = header?.querySelector(':scope > .wordmark');
  const image = logo?.querySelector('img');
  if (!logo || !image) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const slot = document.createElement('span');
  slot.className = 'wordmark-play-slot';
  slot.setAttribute('aria-hidden', 'true');
  const pointers = new Map();
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const viewport = () => ({ width: window.visualViewport?.width || innerWidth, height: window.visualViewport?.height || innerHeight, top: window.visualViewport?.offsetTop || 0, left: window.visualViewport?.offsetLeft || 0 });
  const IDLE = 10000;
  let floating = false, exploded = false, drag = null, pinch = null, moved = false, suppressClick = false;
  let x = 0, y = 0, width = 0, height = 0, baseWidth = 0, baseHeight = 0, scale = 1;
  let vx = 0, vy = 0, angle = 0, angular = 0, squash = 0, edge = '', charge = 0;
  let frame = 0, previous = 0, idleTimer = 0, clickTimer = 0, pieces = [], logoColor = '#fff';

  logo.draggable = false;
  image.draggable = false;
  logo.addEventListener('dragstart', event => event.preventDefault());
  function limits() {
    const v = viewport(), rad = angle * Math.PI / 180;
    const ex = Math.max(0, (Math.abs(Math.cos(rad))*width + Math.abs(Math.sin(rad))*height-width)/2);
    const ey = Math.max(0, (Math.abs(Math.sin(rad))*width + Math.abs(Math.cos(rad))*height-height)/2);
    return { left:v.left+ex, right:Math.max(v.left+ex,v.left+v.width-width-ex), top:v.top+ey, bottom:Math.max(v.top+ey,v.top+v.height-height-ey) };
  }
  function paint(overX = 0, overY = 0) {
    const amount = clamp(Math.max(Math.abs(overX), Math.abs(overY), squash) / Math.max(45, width*.3), 0, 1);
    const horizontal = Math.abs(overX) >= Math.abs(overY) ? (overX !== 0 || edge === 'left' || edge === 'right') : false;
    const sx = horizontal ? 1-.28*amount : 1+.08*amount;
    const sy = horizontal ? 1+.12*amount : 1-.32*amount;
    const origin = horizontal ? ((overX < 0 || (!overX && edge==='left')) ? 'left center':'right center') : ((overY < 0 || (!overY && edge==='top')) ? 'center top':'center bottom');
    logo.style.transform = `translate3d(${x}px,${y}px,0)`;
    image.style.transformOrigin = origin;
    image.style.transform = `rotate(${angle}deg) scale(${sx},${sy})`;
  }
  function size() { width = baseWidth*scale; height = baseHeight*scale; logo.style.width = width+'px'; logo.style.height = height+'px'; }
  function stop() { cancelAnimationFrame(frame); frame = 0; previous = 0; }
  function activity() { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (drag || pinch || pointers.size) { activity(); return; } reset(); }, IDLE); }
  function float() {
    if (floating) return;
    const r = logo.getBoundingClientRect();
    baseWidth = width = r.width; baseHeight = height = r.height; x = r.left; y = r.top;
    const filter = getComputedStyle(image).filter;
    logoColor = /invert\(1\)|invert\(100%\)/.test(filter) ? '#fff' : '#111';
    slot.style.width = width+'px'; slot.style.height = height+'px';
    const focused = document.activeElement === logo;
    logo.before(slot); document.body.append(logo);
    logo.classList.add('wordmark-play-object'); image.style.filter = (filter === 'none' ? '' : filter + ' ') + 'drop-shadow(0 1px 2px #0006)'; size(); floating = true;
    if (focused) logo.focus({preventScroll:true});
    paint(); activity();
  }
  function reset() {
    clearTimeout(idleTimer); clearTimeout(clickTimer); stop();
    pieces.forEach(p => p.node.remove()); pieces = [];
    pointers.clear(); drag = pinch = null; exploded = false; moved = false; suppressClick = false;
    vx = vy = angle = angular = squash = charge = 0; scale = 1; edge = '';
    logo.classList.remove('wordmark-play-object','is-held'); logo.removeAttribute('style'); image.removeAttribute('style');
    if (floating && slot.isConnected) slot.replaceWith(logo);
    floating = false;
  }
  function start() { if (!frame && floating && (!reduced.matches || drag)) { previous = 0; frame = requestAnimationFrame(tick); } }
  function explode() {
    if (exploded || !floating) return;
    exploded = true; drag = pinch = null; pointers.clear(); logo.classList.remove('is-held');
    logo.style.visibility = 'hidden';
    // Build real, independently moving glyphs, not rectangular slices of the image.
    const line = document.createElement('span'); line.className = 'wordmark-letters'; line.setAttribute('aria-hidden','true');
    const letters = [...'#jacksander'].map(char => [char,700]).concat([...'superstar'].map(char => [char,300]), [['®',400]]);
    for (const [char, weight] of letters) { const node=document.createElement('span'); node.textContent=char; node.style.fontWeight=weight; if(char==='®') node.className='wordmark-letter-mark'; line.append(node); }
    document.body.append(line);
    const fontSize = Math.max(8, height * 1.13); line.style.fontSize = fontSize+'px';
    const lineBox=line.getBoundingClientRect(), ratio=width/lineBox.width;
    const centerX=x+width/2, centerY=y+height/2;
    for (const node of [...line.children]) {
      const r=node.getBoundingClientRect(), px=x+(r.left-lineBox.left)*ratio, py=y+(height-r.height)/2;
      const w=r.width*ratio, h=r.height; node.remove(); node.className += ' wordmark-letter';
      Object.assign(node.style,{left:px+'px',top:py+'px',width:w+'px',height:h+'px',color:logoColor,fontSize:(node.classList.contains('wordmark-letter-mark')?fontSize*.35:fontSize)+'px', transformOrigin:'center'});
      document.body.append(node);
      const distance=(px+w/2-centerX)/Math.max(1,width/2);
      pieces.push({node,x:px,y:py,w,h,vx:distance*(.22+Math.random()*.22)+(Math.random()-.5)*.18,vy:-.28-Math.random()*.38,angle:angle,spin:(Math.random()-.5)*.45,ratio});
    }
    line.remove(); activity(); start();
  }
  function tick(now) {
    frame=0; const dt=previous ? Math.min(32,now-previous) : 16; previous=now;
    if (exploded) {
      const v=viewport(); let moving=false;
      for (const p of pieces) {
        p.vy += .0011*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.angle += p.spin*dt;
        if(p.x<v.left || p.x+p.w>v.left+v.width){p.x=clamp(p.x,v.left,Math.max(v.left,v.left+v.width-p.w));p.vx*=-.5;p.spin*=.8}
        if(p.y<v.top){p.y=v.top;p.vy=Math.abs(p.vy)*.5}
        if(p.y+p.h>v.top+v.height){p.y=v.top+v.height-p.h;if(Math.abs(p.vy)<.09)p.vy=0;else p.vy*=-.43;p.vx*=.9;p.spin*=.8}
        p.vx*=Math.pow(.995,dt/16); p.spin*=Math.pow(.99,dt/16);
        p.node.style.transform=`translate3d(${p.x-parseFloat(p.node.style.left)}px,${p.y-parseFloat(p.node.style.top)}px,0) rotate(${p.angle}deg) scaleX(${p.ratio})`;
        if(Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.spin)>.02 || p.y+p.h<v.top+v.height-.5) moving=true;
      }
      if(moving) frame=requestAnimationFrame(tick); else previous=0;
      return;
    }
    if(drag){
      const pressure=Math.max(Math.abs(drag.overX),Math.abs(drag.overY));
      if(pressure>Math.max(42,width*.18)){if(!charge)charge=now;if(now-charge>800){explode();return}}else charge=0;
      paint(drag.overX,drag.overY); frame=requestAnimationFrame(tick); return;
    }
    if(pinch || !floating) return;
    vy += .0009*dt; x += vx*dt; y += vy*dt; angle += angular*dt;
    const b=limits(); let hit=false;
    if(x<b.left || x>b.right){edge=x<b.left?'left':'right';x=clamp(x,b.left,b.right);vx*=-.68;angular*=.8;hit=true}
    if(y<b.top || y>b.bottom){edge=y<b.top?'top':'bottom';const floor=y>b.bottom;y=clamp(y,b.top,b.bottom);vy=floor&&Math.abs(vy)<.08?0:-vy*.55;vx*=floor?.86:1;angular*=.75;hit=true}
    if(hit) squash=Math.min(30,Math.hypot(vx,vy)*25);
    const damp=Math.pow(.987,dt/16);vx*=damp;angular*=Math.pow(.975,dt/16);squash*=Math.pow(.83,dt/16);
    if(y>=b.bottom-1 && vy===0 && Math.abs(vx)<.025 && Math.abs(angular)<.004){vx=angular=0;squash=0;paint();previous=0;return}
    paint();frame=requestAnimationFrame(tick);
  }
  function down(event) {
    if (exploded || event.button!==0) return;
    activity(); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1){stop();moved=false;const r=logo.getBoundingClientRect();drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,dx:event.clientX-r.left,dy:event.clientY-r.top,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp,overX:0,overY:0};vx=vy=angular=0}
    else if(pointers.size===2){event.preventDefault();float();moved=true;const [a,b]=[...pointers.values()];pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale,centerX:x+width/2,centerY:y+height/2,midX:(a.x+b.x)/2,midY:(a.y+b.y)/2};drag=null;stop();for(const id of pointers.keys())try{logo.setPointerCapture(id)}catch{}}
  }
  function move(event) {
    if(!pointers.has(event.pointerId)||exploded)return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinch&&pointers.size>=2){event.preventDefault();const [a,b]=[...pointers.values()];scale=clamp(pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,.55,Math.min(1.45,viewport().width/baseWidth));size();const bounds=limits();x=clamp(pinch.centerX+(a.x+b.x)/2-pinch.midX-width/2,bounds.left,bounds.right);y=clamp(pinch.centerY+(a.y+b.y)/2-pinch.midY-height/2,bounds.top,bounds.bottom);paint();activity();return}
    if(!drag||drag.id!==event.pointerId)return;
    if(!moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6){moved=true;float();try{logo.setPointerCapture(event.pointerId)}catch{}}
    if(!moved||!floating)return;
    event.preventDefault();logo.classList.add('is-held');const b=limits(),rawX=event.clientX-drag.dx,rawY=event.clientY-drag.dy;x=clamp(rawX,b.left,b.right);y=clamp(rawY,b.top,b.bottom);drag.overX=rawX-x;drag.overY=rawY-y;
    const dt=Math.max(8,event.timeStamp-drag.time);vx=vx*.55+clamp((event.clientX-drag.lastX)/dt,-1.8,1.8)*.45;vy=vy*.55+clamp((event.clientY-drag.lastY)/dt,-1.8,1.8)*.45;drag.lastX=event.clientX;drag.lastY=event.clientY;drag.time=event.timeStamp;paint(drag.overX,drag.overY);activity();start();
  }
  function up(event) {
    if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);activity();
    if(pinch){pinch=null;if(pointers.size===1){const [id,p]=pointers.entries().next().value;drag={id,startX:p.x,startY:p.y,dx:p.x-x,dy:p.y-y,lastX:p.x,lastY:p.y,time:event.timeStamp,overX:0,overY:0}}else{drag=null;logo.classList.remove('is-held');start()}suppressClick=true;clearTimeout(clickTimer);clickTimer=setTimeout(()=>suppressClick=false,350);return}
    if(!drag||drag.id!==event.pointerId)return;const d=drag;drag=null;logo.classList.remove('is-held');
    if(!moved){if(floating){suppressClick=true;clearTimeout(clickTimer);clickTimer=setTimeout(()=>suppressClick=false,350)}return}
    suppressClick=true;clearTimeout(clickTimer);clickTimer=setTimeout(()=>suppressClick=false,350);
    if(event.timeStamp-d.time>90)vx=vy=0;
    angular=clamp(((d.dx-width/2)*vy-(d.dy-height/2)*vx)/(Math.max(width,height)**2)*15,-.16,.16);
    if(d.overX<0&&vx<0||d.overX>0&&vx>0)vx*=-.68;
    if(d.overY<0&&vy<0||d.overY>0&&vy>0)vy*=-.55;
    squash=Math.min(30,Math.max(Math.abs(d.overX),Math.abs(d.overY)));edge=d.overX<0?'left':d.overX>0?'right':d.overY<0?'top':'bottom';charge=0;
    if(event.type==='pointercancel'||reduced.matches){vx=vy=angular=squash=0;paint();return}start();
  }
  logo.addEventListener('pointerdown',down);document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
  logo.addEventListener('click',event=>{if(suppressClick||floating){event.preventDefault();event.stopImmediatePropagation();suppressClick=false}});
  logo.addEventListener('keydown',event=>{if(event.key==='Escape'&&floating){event.preventDefault();reset();return}const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];if(!d)return;event.preventDefault();stop();float();const b=limits();x=clamp(x+d[0],b.left,b.right);y=clamp(y+d[1],b.top,b.bottom);paint();activity()});
  function resize(){if(!floating||drag||pinch||exploded)return;const b=limits();x=clamp(x,b.left,b.right);y=clamp(y,b.top,b.bottom);paint()}
  addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);addEventListener('pagehide',reset);
})();
