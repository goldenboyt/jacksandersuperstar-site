(() => {
  const title=document.getElementById('hero-title');
  const originals=[...title?.querySelectorAll('.title-line > svg')||[]];
  if(originals.length!==2)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const NS='http://www.w3.org/2000/svg', pointers=new Map(), words=['#jacksander','superstar®'];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const view=()=>({w:window.visualViewport?.width||innerWidth,h:window.visualViewport?.height||innerHeight,left:window.visualViewport?.offsetLeft||0,top:window.visualViewport?.offsetTop||0});
  const element=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n};
  let active=false,burst=false,resetting=false,drag=null,pinch=null,pieceDrag=null,moved=false,overlay=null,paths=[],pieces=[];
  let x=0,y=0,w=0,h=0,baseW=0,baseH=0,scale=1,angle=0,spin=0,vx=0,vy=0,bend=0,bendVelocity=0,pressure=0,edge='',charge=0,lineData=[];
  let frame=0,previous=0,idle=0,resetTimer=0,audio=null,lastSound=0,lastScroll=scrollY;
  function audioReady(){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{})}catch{}}
  function sound(kind,intensity=1){if(!audio||audio.state!=='running'||performance.now()-lastSound<85)return;lastSound=performance.now();const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type=kind==='pop'?'triangle':'sine';o.frequency.setValueAtTime(kind==='pop'?330:150+Math.min(110,intensity*75),t);o.frequency.exponentialRampToValueAtTime(kind==='pop'?90:85,t+.10);g.gain.setValueAtTime(Math.min(.035,.009+intensity*.012),t);g.gain.exponentialRampToValueAtTime(.0001,t+.13);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.14)}
  function activity(){clearTimeout(idle);idle=setTimeout(()=>{if(drag||pinch||pieceDrag||pointers.size){activity();return}reset()},10000)}
  function stop(){cancelAnimationFrame(frame);frame=0;previous=0}
  function start(){if(!frame&&active&&(!reduced.matches||drag||pieceDrag)){previous=0;frame=requestAnimationFrame(tick)}}
  function bounds(){const v=view(),r=angle*Math.PI/180,ex=Math.max(0,(Math.abs(Math.cos(r))*w+Math.abs(Math.sin(r))*h-w)/2),ey=Math.max(0,(Math.abs(Math.sin(r))*w+Math.abs(Math.cos(r))*h-h)/2);return{left:v.left+ex,right:Math.max(v.left+ex,v.left+v.w-w-ex),top:v.top+ey,bottom:Math.max(v.top+ey,v.top+v.h-h-ey)}}
  function setSize(){w=baseW*scale;h=baseH*scale;overlay.style.width=w+'px';overlay.style.height=h+'px'}
  function pathData(line,deflection){const y=line.y+line.h*.86,mid=line.x+line.w/2,inset=line.h*.10;return `M ${line.x+inset} ${y} Q ${mid} ${y+deflection} ${line.x+line.w-inset} ${y}`}
  function paint(){
    if(!overlay)return;
    overlay.style.transform=`translate3d(${x}px,${y}px,0) rotate(${angle}deg)`;
    for(let i=0;i<paths.length;i++)paths[i].setAttribute('d',pathData(lineData[i],bend));
  }
  function makeOverlay(){
    const boxes=originals.map(n=>n.getBoundingClientRect());const left=Math.min(...boxes.map(r=>r.left)),top=Math.min(...boxes.map(r=>r.top)),right=Math.max(...boxes.map(r=>r.right)),bottom=Math.max(...boxes.map(r=>r.bottom));
    baseW=w=right-left;baseH=h=bottom-top;x=left;y=top;
    lineData=boxes.map(r=>({x:r.left-left,y:r.top-top,w:r.width,h:r.height}));
    overlay=element('svg',{class:'hero-play-object',viewBox:`0 0 ${baseW} ${baseH}`,overflow:'visible','aria-hidden':'true'});
    const defs=element('defs');overlay.append(defs);paths=[];
    lineData.forEach((line,i)=>{
      const id=`hero-physics-path-${i}`,path=element('path',{id,d:pathData(line,0)});defs.append(path);paths.push(path);
      const text=element('text',{'font-family':'Helvetica Neue, Helvetica, Arial, sans-serif','font-size':line.h*1.09,'font-weight':i===0?'700':'300',fill:'white','letter-spacing':'-.035em'});
      const textPath=element('textPath',{href:`#${id}`,textLength:Math.max(1,line.w-line.h*.2),lengthAdjust:'spacingAndGlyphs'});if(i===1){textPath.append(document.createTextNode('superstar'));const mark=element('tspan',{'font-size':'.32em','baseline-shift':'super'});mark.textContent='®';textPath.append(mark)}else textPath.textContent=words[i];text.append(textPath);overlay.append(text);
    });
    overlay.addEventListener('pointerdown',down);overlay.addEventListener('dragstart',e=>e.preventDefault());
    document.body.append(overlay);setSize();originals.forEach(n=>{n.style.opacity='0';n.style.pointerEvents='none'});active=true;paint();activity();
  }
  function reset(immediate=false){
    if(!active)return;if(resetting&&immediate!==true)return;
    if(immediate!==true&&!reduced.matches){resetting=true;clearTimeout(idle);stop();for(const node of burst?pieces.map(p=>p.node):[overlay]){node.style.pointerEvents='none';node.animate([{opacity:1},{opacity:0}],{duration:300,easing:'ease-out',fill:'forwards'})}resetTimer=setTimeout(()=>{reset(true);originals.forEach(n=>n.animate([{opacity:0},{opacity:1}],{duration:300,easing:'ease-out'}))},300);return}
    clearTimeout(resetTimer);clearTimeout(idle);stop();pieces.forEach(p=>p.node.remove());pieces=[];overlay?.remove();overlay=null;originals.forEach(n=>{n.style.removeProperty('opacity');n.style.removeProperty('pointer-events')});
    active=burst=resetting=false;drag=pinch=pieceDrag=null;pointers.clear();moved=false;vx=vy=angle=spin=bend=bendVelocity=pressure=charge=0;scale=1;edge='';
  }
  function paintPiece(p){p.node.style.transform=`translate3d(${p.x-p.originX}px,${p.y-p.originY}px,0) rotate(${p.angle}deg) scale(${p.ratio*(1+p.squash*.35)},${1-p.squash})`}
  function explode(){
    if(!active||burst)return;burst=true;sound('pop',1.5);drag=pinch=null;pointers.clear();overlay.style.visibility='hidden';
    lineData.forEach((line,i)=>{
      const node=document.createElement('span');node.className='hero-play-piece';node.setAttribute('aria-hidden','true');if(i===1){node.append(document.createTextNode('superstar'));const mark=document.createElement('sup');mark.textContent='®';node.append(mark)}else node.textContent=words[i];
      Object.assign(node.style,{left:(x+line.x*scale)+'px',top:(y+line.y*scale)+'px',fontSize:(line.h*scale*1.09)+'px',fontWeight:i===0?'700':'300'});document.body.append(node);
      const measured=node.getBoundingClientRect(),target=line.w*scale,ratio=target/Math.max(1,measured.width),px=x+line.x*scale,py=y+line.y*scale;
      node.style.left=(px+(target-measured.width)/2)+'px';node.style.width=measured.width+'px';node.style.height=line.h*scale+'px';
      const p={node,x:px,y:py,originX:px,originY:py,w:target,h:line.h*scale,vx:(i?1:-1)*.22+vx*.5,vy:-.25-Math.random()*.18,angle,spin:(i?1:-1)*.12,ratio,squash:0};pieces.push(p);paintPiece(p);
      node.addEventListener('pointerdown',event=>{if(resetting||event.button!==0||pieceDrag)return;event.preventDefault();event.stopPropagation();audioReady();activity();pieceDrag={piece:p,id:event.pointerId,dx:event.clientX-p.x,dy:event.clientY-p.y,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp};p.vx=p.vy=p.spin=0;node.classList.add('is-held');try{node.setPointerCapture(event.pointerId)}catch{}start()});
    });activity();start();
  }
  function tick(now){
    frame=0;const dt=previous?Math.min(32,now-previous):16;previous=now;
    if(burst){const v=view();let moving=false;for(const p of pieces){if(pieceDrag?.piece===p){moving=true;continue}p.vy+=.0004*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;const oldAngle=p.angle;p.angle+=p.spin*dt;
      let trial=p.angle*Math.PI/180;if(Math.abs(Math.cos(trial))*p.w+Math.abs(Math.sin(trial))*p.h>v.w||Math.abs(Math.sin(trial))*p.w+Math.abs(Math.cos(trial))*p.h>v.h){p.angle=oldAngle;p.spin*=-.65}
      const radians=p.angle*Math.PI/180,ex=Math.max(0,(Math.abs(Math.cos(radians))*p.w+Math.abs(Math.sin(radians))*p.h-p.w)/2),ey=Math.max(0,(Math.abs(Math.sin(radians))*p.w+Math.abs(Math.cos(radians))*p.h-p.h)/2);const left=v.left+ex,right=Math.max(left,v.left+v.w-p.w-ex),top=v.top+ey,bottom=Math.max(top,v.top+v.h-p.h-ey);
      if(p.x<left||p.x>right){const impact=Math.abs(p.vx);p.x=clamp(p.x,left,right);p.vx*=-.94;p.spin*=.9;p.squash=Math.min(.24,impact*.3);if(impact>.25)sound('bounce',impact)}
      if(p.y<top){p.y=top;p.vy=Math.abs(p.vy)*.94}
      if(p.y>bottom){const impact=Math.abs(p.vy);p.y=bottom;p.vy=impact<.06?0:-p.vy*.94;p.vx*=.971;p.spin*=.95;p.squash=Math.max(p.squash,Math.min(.25,impact*.35));if(impact>.25)sound('bounce',impact)}
      p.vx*=Math.pow(.971,dt/16.667);p.spin*=Math.pow(.985,dt/16.667);p.squash*=Math.pow(.8,dt/16);paintPiece(p);if(Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.spin)>.025||p.y<bottom-.5)moving=true;
    }if(moving)frame=requestAnimationFrame(tick);else previous=0;return}
    if(drag){const n=Math.max(Math.abs(drag.overX),Math.abs(drag.overY));if(n>Math.max(30,h*.51)){if(!charge)charge=now;if(now-charge>=900){explode();return}}else charge=0;
      const target=clamp(drag.overY*.8+(drag.overX?Math.sign(drag.overX)*Math.abs(drag.overX)*.35:0)+vy*24,-baseH*.42,baseH*.42);bendVelocity+=(target-bend)*.018*dt;bendVelocity*=Math.pow(.78,dt/16.667);bend+=bendVelocity*dt/16.667;paint();frame=requestAnimationFrame(tick);return}
    if(pinch||!active)return;
    vy+=.0004*dt;x+=vx*dt;y+=vy*dt;const oldAngle=angle;angle+=spin*dt;const v=view(),trial=angle*Math.PI/180;if(Math.abs(Math.cos(trial))*w+Math.abs(Math.sin(trial))*h>v.w||Math.abs(Math.sin(trial))*w+Math.abs(Math.cos(trial))*h>v.h){angle=oldAngle;spin*=-.65}
    const b=bounds();let hit=false,impact=0;
    if(x<b.left||x>b.right){edge=x<b.left?'left':'right';impact=Math.abs(vx);x=clamp(x,b.left,b.right);vx*=-.94;hit=true}
    if(y<b.top||y>b.bottom){edge=y<b.top?'top':'bottom';impact=Math.max(impact,Math.abs(vy));const floor=y>b.bottom;y=clamp(y,b.top,b.bottom);vy=floor&&impact<.045?0:-vy*.94;hit=true}
    if(hit){bendVelocity+=(edge==='top'?-1:1)*Math.min(baseH*.12,impact*25);spin+=clamp(vx*.035,-.06,.06);if(impact>.13)sound('bounce',impact)}
    bendVelocity+=-bend*.017*dt;bendVelocity*=Math.pow(.79,dt/16.667);bend+=bendVelocity*dt/16.667;
    const damping=Math.pow(.971,dt/16.667);vx*=damping;spin*=Math.pow(.991,dt/16.667);paint();
    if(y>=b.bottom-1&&vy===0&&Math.abs(vx)<.025&&Math.abs(spin)<.003&&Math.abs(bend)<.1&&Math.abs(bendVelocity)<.1){vx=spin=bend=bendVelocity=0;paint();previous=0;return}frame=requestAnimationFrame(tick);
  }
  function down(event){
    if(burst||resetting||event.button!==0)return;audioReady();activity();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1){stop();moved=false;const rect=active?{left:x,top:y}:union();drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,dx:event.clientX-rect.left,dy:event.clientY-rect.top,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp,overX:0,overY:0};vx=vy=spin=0}
    else if(pointers.size===2){event.preventDefault();if(!active)makeOverlay();moved=true;const [a,b]=[...pointers.values()];pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale,midX:(a.x+b.x)/2,midY:(a.y+b.y)/2,centerX:x+w/2,centerY:y+h/2};drag=null;stop()}
  }
  function union(){const boxes=originals.map(n=>n.getBoundingClientRect());return{left:Math.min(...boxes.map(r=>r.left)),top:Math.min(...boxes.map(r=>r.top))}}
  function move(event){
    if(pieceDrag&&pieceDrag.id===event.pointerId){event.preventDefault();const d=pieceDrag,p=d.piece,v=view(),dt=Math.max(8,event.timeStamp-d.time);p.x=clamp(event.clientX-d.dx,v.left,Math.max(v.left,v.left+v.w-p.w));p.y=clamp(event.clientY-d.dy,v.top,Math.max(v.top,v.top+v.h-p.h));p.vx=p.vx*.5+clamp((event.clientX-d.lastX)/dt,-1.8,1.8)*.5;p.vy=p.vy*.5+clamp((event.clientY-d.lastY)/dt,-1.8,1.8)*.5;d.lastX=event.clientX;d.lastY=event.clientY;d.time=event.timeStamp;paintPiece(p);activity();return}
    if(!pointers.has(event.pointerId)||burst)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinch&&pointers.size>=2){event.preventDefault();const [a,b]=[...pointers.values()];scale=clamp(pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,.55,Math.min(1.45,view().w/baseW));setSize();const boundsNow=bounds();x=clamp(pinch.centerX+(a.x+b.x)/2-pinch.midX-w/2,boundsNow.left,boundsNow.right);y=clamp(pinch.centerY+(a.y+b.y)/2-pinch.midY-h/2,boundsNow.top,boundsNow.bottom);paint();activity();return}
    if(!drag||drag.id!==event.pointerId)return;if(!moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6){moved=true;if(!active)makeOverlay();try{overlay.setPointerCapture(event.pointerId)}catch{}}
    if(!moved||!active)return;event.preventDefault();overlay.classList.add('is-held');const b=bounds(),rawX=event.clientX-drag.dx,rawY=event.clientY-drag.dy;x=clamp(rawX,b.left,b.right);y=clamp(rawY,b.top,b.bottom);drag.overX=rawX-x;drag.overY=rawY-y;const dt=Math.max(8,event.timeStamp-drag.time);vx=vx*.55+clamp((event.clientX-drag.lastX)/dt,-2,2)*.45;vy=vy*.55+clamp((event.clientY-drag.lastY)/dt,-2,2)*.45;drag.lastX=event.clientX;drag.lastY=event.clientY;drag.time=event.timeStamp;activity();start();
  }
  function up(event){
    if(pieceDrag&&pieceDrag.id===event.pointerId){const d=pieceDrag,p=d.piece;pieceDrag=null;p.node.classList.remove('is-held');if(event.timeStamp-d.time>90||event.type==='pointercancel')p.vx=p.vy=0;p.spin=clamp((p.vx-p.vy)*.12,-.2,.2);activity();start();return}
    if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);activity();
    if(pinch){pinch=null;if(pointers.size===1){const[id,p]=pointers.entries().next().value;drag={id,startX:p.x,startY:p.y,dx:p.x-x,dy:p.y-y,lastX:p.x,lastY:p.y,time:event.timeStamp,overX:0,overY:0}}else{drag=null;overlay?.classList.remove('is-held');start()}return}
    if(!drag||drag.id!==event.pointerId)return;const d=drag;drag=null;overlay?.classList.remove('is-held');if(!moved)return;if(event.timeStamp-d.time>90)vx=vy=0;
    spin=clamp(((d.dx-w/2)*vy-(d.dy-h/2)*vx)/(Math.max(w,h)**2)*26,-.27,.27);if((d.overX<0&&vx<0)||(d.overX>0&&vx>0))vx*=-.94;if((d.overY<0&&vy<0)||(d.overY>0&&vy>0))vy*=-.94;charge=0;
    if(event.type==='pointercancel'||reduced.matches){vx=vy=spin=bend=bendVelocity=0;paint();return}start();
  }
  originals.forEach(node=>{node.addEventListener('pointerdown',down);node.addEventListener('dragstart',e=>e.preventDefault())});
  document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
  title.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();reset();return}const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];if(!d)return;event.preventDefault();stop();if(!active)makeOverlay();const b=bounds();x=clamp(x+d[0],b.left,b.right);y=clamp(y+d[1],b.top,b.bottom);paint();activity()});
  addEventListener('scroll',()=>{const current=scrollY,delta=current-lastScroll;lastScroll=current;if(!active||resetting||!delta)return;const v=view(),shift=clamp(delta,-v.h*.7,v.h*.7);if(burst){for(const p of pieces){if(pieceDrag?.piece===p)continue;p.y=clamp(p.y-shift,v.top,Math.max(v.top,v.top+v.h-p.h));paintPiece(p)}}else if(!drag&&!pinch){const b=bounds();y=clamp(y-shift,b.top,b.bottom);paint()}activity();start()},{passive:true});
  function resize(){if(!active||drag||pinch||burst)return;const b=bounds();x=clamp(x,b.left,b.right);y=clamp(y,b.top,b.bottom);paint()}
  addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);addEventListener('pagehide',()=>reset(true));
})();
