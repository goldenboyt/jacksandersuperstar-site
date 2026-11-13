(() => {
  const title=document.getElementById('hero-title');
  const originals=[...title?.querySelectorAll('.title-line > svg')||[]];
  if(originals.length!==2)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const NS='http://www.w3.org/2000/svg', pointers=new Map(), words=['#jacksander','superstar®'];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const leanAngle=degrees=>((degrees+90)%180+180)%180-90;
  const view=()=>({w:window.visualViewport?.width||innerWidth,h:window.visualViewport?.height||innerHeight,left:window.visualViewport?.offsetLeft||0,top:window.visualViewport?.offsetTop||0});
  const element=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n};
  let active=false,burst=false,resetting=false,drag=null,pinch=null,pieceDrag=null,moved=false,overlay=null,glyphs=[],pieces=[];
  let x=0,y=0,w=0,h=0,baseW=0,baseH=0,scale=1,desiredScale=1,angle=0,spin=0,vx=0,vy=0,bend=0,bendVelocity=0,pressure=0,edge='',charge=0,lineData=[];
  let frame=0,previous=0,idle=0,resetTimer=0,audio=null,lastSound=0,lastScroll=scrollY;
  function audioReady(){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{})}catch{}}
  function sound(kind,intensity=1){if(!audio||audio.state!=='running'||performance.now()-lastSound<85)return;lastSound=performance.now();const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type=kind==='pop'?'triangle':'sine';o.frequency.setValueAtTime(kind==='pop'?330:150+Math.min(110,intensity*75),t);o.frequency.exponentialRampToValueAtTime(kind==='pop'?90:85,t+.10);g.gain.setValueAtTime(Math.min(.035,.009+intensity*.012),t);g.gain.exponentialRampToValueAtTime(.0001,t+.13);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.14)}
  function activity(){clearTimeout(idle);idle=setTimeout(()=>{if(drag||pinch||pieceDrag||pointers.size){activity();return}reset()},10000)}
  function stop(){cancelAnimationFrame(frame);frame=0;previous=0}
  function start(){if(!frame&&active&&(!reduced.matches||drag||pieceDrag)){previous=0;frame=requestAnimationFrame(tick)}}
  function bounds(){const v=view(),r=angle*Math.PI/180,ex=(Math.abs(Math.cos(r))*w+Math.abs(Math.sin(r))*h-w)/2,ey=(Math.abs(Math.sin(r))*w+Math.abs(Math.cos(r))*h-h)/2,padX=Math.min(v.w*.06,Math.max(0,(v.w-w-2*ex)/2),(drag?16:6)+Math.abs(bend)*scale*.35),padY=Math.min(v.h*.23,Math.max(0,(v.h-h-2*ey)/2),(drag?24:6)+Math.abs(bend)*scale*.95+(drag?(lineData[0]?.h||0)*scale*.2:0));return{left:v.left+ex+padX,right:Math.max(v.left+ex+padX,v.left+v.w-w-ex-padX),top:v.top+ey+padY,bottom:Math.max(v.top+ey+padY,v.top+v.h-h-ey-padY)}}
  function setSize(){w=baseW*scale;h=baseH*scale;overlay.style.width=w+'px';overlay.style.height=h+'px'}
  function fitRotatedSize(){
    const v=view(),r=angle*Math.PI/180,rw=Math.abs(Math.cos(r))*baseW+Math.abs(Math.sin(r))*baseH,rh=Math.abs(Math.sin(r))*baseW+Math.abs(Math.cos(r))*baseH;
    const maxScale=Math.min(1.45,v.w/Math.max(1,rw),v.h/Math.max(1,rh)),next=Math.min(desiredScale,maxScale);
    if(Math.abs(next-scale)>.0001){const cx=x+w/2,cy=y+h/2;scale=next;setSize();x=cx-w/2;y=cy-h/2}
  }
  function impactResponse(nx,ny){
    const r=angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r),corners=[];
    for(const a of [-1,1])for(const b of [-1,1])corners.push({x:a*w/2*c-b*h/2*s,y:a*w/2*s+b*h/2*c});
    let contact=corners[0];for(const q of corners)if(q.x*nx+q.y*ny<contact.x*nx+contact.y*ny)contact=q;
    let omega=spin*Math.PI/180;const cross=contact.x*ny-contact.y*nx,normalSpeed=(vx-omega*contact.y)*nx+(vy+omega*contact.x)*ny;
    if(normalSpeed>=0)return 0;
    const impulse=-(1+.48)*normalSpeed/(1+cross*cross*12/Math.max(1,w*w+h*h));
    vx+=impulse*nx;vy+=impulse*ny;omega+=cross*impulse*12/Math.max(1,w*w+h*h);spin=clamp(omega*180/Math.PI,-.25,.25);
    if(ny<0){vx*=.91;spin*=.94;if(Math.abs(vy)<.09&&Math.abs(spin)<.006)vy=0}
    return -normalSpeed;
  }
  function paint(){
    if(!overlay)return;
    const safe=bounds();x=clamp(x,safe.left,safe.right);y=clamp(y,safe.top,safe.bottom);
    overlay.style.transform=`translate3d(${x}px,${y}px,0) rotate(${angle}deg)`;
    for(const g of glyphs){
      const curve=2*bend*g.t*(1-g.t),slope=2*bend*(1-2*g.t)/g.line.w;
      const px=g.line.x+g.inset+g.t*g.usable,py=g.line.y+g.line.h*.86+curve-g.rise;
      g.node.setAttribute('transform',`translate(${px} ${py}) rotate(${Math.atan(slope)*180/Math.PI}) scale(${g.ratio} 1)`);
    }
  }
  function makeOverlay(){
    const boxes=originals.map(n=>n.getBoundingClientRect());const left=Math.min(...boxes.map(r=>r.left)),top=Math.min(...boxes.map(r=>r.top)),right=Math.max(...boxes.map(r=>r.right)),bottom=Math.max(...boxes.map(r=>r.bottom));
    baseW=w=right-left;baseH=h=bottom-top;x=left;y=top;
    lineData=boxes.map(r=>({x:r.left-left,y:r.top-top,w:r.width,h:r.height}));
    overlay=element('svg',{class:'hero-play-object',viewBox:`0 0 ${baseW} ${baseH}`,overflow:'visible','aria-hidden':'true'});
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');glyphs=[];
    lineData.forEach((line,i)=>{
      const size=line.h*1.09,weight=i===0?700:300,inset=line.h*.16,usable=line.w-inset*2,chars=[...words[i]];
      const advances=chars.map(char=>{ctx.font=`${weight} ${char==='®'?size*.32:size}px Helvetica Neue, Helvetica, Arial, sans-serif`;return ctx.measureText(char).width});
      const spacing=-size*.035,total=Math.max(1,advances.reduce((a,b)=>a+b,0)+spacing*(chars.length-1)),ratio=usable/total;let cursor=0;
      chars.forEach((char,index)=>{const mark=char==='®',node=element('text',{'font-family':'Helvetica Neue, Helvetica, Arial, sans-serif','font-size':mark?size*.32:size,'font-weight':weight,fill:'white','text-anchor':'middle'});node.textContent=char;overlay.append(node);
        glyphs.push({node,line,inset,usable,ratio,t:clamp((cursor+advances[index]/2)/total,0,1),rise:mark?size*.46:0});cursor+=advances[index]+spacing;
      });
    });
    overlay.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch')down(event)});overlay.addEventListener('dragstart',e=>e.preventDefault());
    document.body.append(overlay);setSize();originals.forEach(n=>{n.style.opacity='0';n.style.pointerEvents='none'});active=true;paint();activity();
  }
  function reset(immediate=false){
    if(!active)return;if(resetting&&immediate!==true)return;
    if(immediate!==true&&!reduced.matches){resetting=true;clearTimeout(idle);stop();for(const node of burst?pieces.map(p=>p.node):[overlay]){node.style.pointerEvents='none';node.animate([{opacity:1},{opacity:0}],{duration:300,easing:'ease-out',fill:'forwards'})}resetTimer=setTimeout(()=>{reset(true);originals.forEach(n=>n.animate([{opacity:0},{opacity:1}],{duration:300,easing:'ease-out'}))},300);return}
    clearTimeout(resetTimer);clearTimeout(idle);stop();pieces.forEach(p=>p.node.remove());pieces=[];overlay?.remove();overlay=null;originals.forEach(n=>{n.style.removeProperty('opacity');n.style.removeProperty('pointer-events')});
    active=burst=resetting=false;drag=pinch=pieceDrag=null;pointers.clear();heroTouches.clear();moved=false;vx=vy=angle=spin=bend=bendVelocity=pressure=charge=0;scale=desiredScale=1;edge='';
  }
  function paintPiece(p){p.node.style.transform=`translate3d(${p.x-p.originX}px,${p.y-p.originY}px,0) rotate(${p.angle}deg) scale(${p.ratio*(1+p.squash*.35)},${1-p.squash})`}
  function settleReduced(){
    stop();if(!burst){angle=spin=vx=vy=bend=bendVelocity=0;const b=bounds();x=clamp(x,b.left,b.right);y=b.bottom;paint();return}
    const v=view(),placed=[];for(const p of pieces){p.angle=p.spin=p.vx=p.vy=p.squash=0;p.x=clamp(p.x,v.left,Math.max(v.left,v.left+v.w-p.w));p.y=v.top+v.h-p.h;
      for(const q of placed)if(Math.min(p.x+p.w,q.x+q.w)-Math.max(p.x,q.x)>5)p.y=Math.min(p.y,q.y-p.h);
      p.y=Math.max(v.top,p.y);placed.push(p);paintPiece(p);
    }
  }
  function explode(){
    if(!active||burst)return;burst=true;sound('pop',1.5);drag=pinch=null;pointers.clear();overlay.style.visibility='hidden';
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    ctx.font=`700 ${lineData[0].h*scale*1.09}px Helvetica Neue, Helvetica, Arial, sans-serif`;
    const hashPart=clamp(ctx.measureText('#').width/ctx.measureText('#jacksander').width,.07,.2);
    const parts=[{text:'#',line:lineData[0],offset:0,fraction:hashPart,weight:700},{text:'jacksander',line:lineData[0],offset:hashPart,fraction:1-hashPart,weight:700},{text:'superstar®',line:lineData[1],offset:0,fraction:1,weight:300}];
    parts.forEach((part,i)=>{
      const {line}=part,node=document.createElement('span');node.className='hero-play-piece';node.setAttribute('aria-hidden','true');
      if(i===2){node.append(document.createTextNode('superstar'));const mark=document.createElement('sup');mark.textContent='®';node.append(mark)}else node.textContent=part.text;
      const px=x+(line.x+line.w*part.offset)*scale,py=y+line.y*scale,target=line.w*part.fraction*scale;
      Object.assign(node.style,{left:px+'px',top:py+'px',fontSize:(line.h*scale*1.09)+'px',fontWeight:String(part.weight)});document.body.append(node);
      const measured=node.getBoundingClientRect(),ratio=target/Math.max(1,measured.width);
      node.style.left=(px+(target-measured.width)/2)+'px';node.style.width=measured.width+'px';node.style.height=(measured.height+2)+'px';
      const p={node,x:px,y:py,originX:px,originY:py,w:target,h:measured.height+2,vx:(i-1)*.18+vx*.4,vy:-.08-Math.random()*.08,angle,spin:(i-1)*.025,ratio,squash:0};pieces.push(p);paintPiece(p);
      node.addEventListener('pointerdown',event=>{if(resetting||event.button!==0||pieceDrag)return;event.preventDefault();event.stopPropagation();audioReady();activity();pieceDrag={piece:p,id:event.pointerId,dx:event.clientX-p.x,dy:event.clientY-p.y,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp};p.vx=p.vy=p.spin=0;node.classList.add('is-held');try{node.setPointerCapture(event.pointerId)}catch{}start()});
    });activity();if(reduced.matches)settleReduced();else start();
  }
  function tick(now){
    frame=0;const dt=previous?Math.min(32,now-previous):16;previous=now;
    if(burst){const v=view();let moving=false;for(const p of pieces){p.supported=false;if(pieceDrag?.piece===p){moving=true;continue}p.vy+=.0012*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;const oldAngle=p.angle;p.angle+=p.spin*dt;
      let trial=p.angle*Math.PI/180;if(Math.abs(Math.cos(trial))*p.w+Math.abs(Math.sin(trial))*p.h>v.w||Math.abs(Math.sin(trial))*p.w+Math.abs(Math.cos(trial))*p.h>v.h){p.angle=oldAngle;p.spin*=-.65}
      const radians=p.angle*Math.PI/180,ex=(Math.abs(Math.cos(radians))*p.w+Math.abs(Math.sin(radians))*p.h-p.w)/2,ey=(Math.abs(Math.sin(radians))*p.w+Math.abs(Math.cos(radians))*p.h-p.h)/2;const left=v.left+ex,right=Math.max(left,v.left+v.w-p.w-ex),top=v.top+ey,bottom=Math.max(top,v.top+v.h-p.h-ey);
      if(p.x<left||p.x>right){const impact=Math.abs(p.vx);p.x=clamp(p.x,left,right);p.vx*=-.58;p.spin*=.8;p.squash=Math.min(.24,impact*.3);if(impact>.25)sound('bounce',impact)}
      if(p.y<top){p.y=top;p.vy=Math.abs(p.vy)*.94}
      if(p.y>bottom){const impact=Math.abs(p.vy);p.y=bottom;p.vy=impact<.13?0:-p.vy*.48;p.vx*=.86;p.spin*=.72;p.squash=Math.max(p.squash,Math.min(.25,impact*.35));if(impact>.25)sound('bounce',impact)}
      if(p.y>=bottom-1&&Math.abs(p.vy)<.25){const flat=Math.round(p.angle/180)*180;p.angle+=(flat-p.angle)*Math.min(1,dt*.008);p.spin*=Math.pow(.82,dt/16.667)}
      p.vx*=Math.pow(.975,dt/16.667);p.spin*=Math.pow(.98,dt/16.667);p.squash*=Math.pow(.8,dt/16);paintPiece(p);if(Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.spin)>.025||p.y<bottom-.5||Math.abs(p.angle-Math.round(p.angle/180)*180)>.3)moving=true;
    }
      // Let the words rest on each other instead of piling into the same floor position.
      const rect=p=>{const r=p.angle*Math.PI/180,rw=Math.abs(Math.cos(r))*p.w+Math.abs(Math.sin(r))*p.h,rh=Math.abs(Math.sin(r))*p.w+Math.abs(Math.cos(r))*p.h;return {left:p.x+p.w/2-rw/2,right:p.x+p.w/2+rw/2,top:p.y+p.h/2-rh/2,bottom:p.y+p.h/2+rh/2}};
      const ordered=[...pieces].sort((a,b)=>(b.y+b.h/2)-(a.y+a.h/2));
      for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
        const lower=ordered[i],upper=ordered[j];if(pieceDrag?.piece===upper)continue;
        const a=rect(lower),b=rect(upper),overlap=Math.min(a.right,b.right)-Math.max(a.left,b.left);
        if(overlap>Math.min(8,upper.w*.1)&&b.bottom>a.top&&b.top<a.bottom&&upper.vy>=0){
          const shift=Math.min(b.bottom-a.top,Math.max(0,b.top-v.top));upper.y-=shift;
          if(upper.vy>.2)upper.vy*=-.28;else upper.vy=0;
          upper.spin*=.75;upper.supported=true;if(Math.abs(upper.vy)<.1){const flat=Math.round(upper.angle/180)*180;upper.angle+=(flat-upper.angle)*Math.min(1,dt*.008)}paintPiece(upper);
        }
      }
      moving=pieces.some(p=>{if(pieceDrag?.piece===p)return true;const r=rect(p),flat=Math.abs(p.angle-Math.round(p.angle/180)*180);return Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.spin)>.025||(!p.supported&&r.bottom<v.top+v.h-.5)||flat>.3});
      if(moving)frame=requestAnimationFrame(tick);else previous=0;return}
    if(drag){const n=Math.max(Math.abs(drag.overX),Math.abs(drag.overY));if(n>Math.max(30,h*.51)){if(!charge)charge=now;if(now-charge>=900){explode();return}}else charge=0;
      const target=clamp(drag.overY*.8+(drag.overX?Math.sign(drag.overX)*Math.abs(drag.overX)*.35:0)+vy*24,-baseH*.42,baseH*.42);bendVelocity+=(target-bend)*.018*dt;bendVelocity*=Math.pow(.78,dt/16.667);bend+=bendVelocity*dt/16.667;paint();frame=requestAnimationFrame(tick);return}
    if(pinch||!active)return;
    vy+=.0010*dt;x+=vx*dt;y+=vy*dt;angle+=spin*dt;fitRotatedSize();
    const b=bounds();let hit=false,impact=0;
    if(x<b.left){x=b.left;edge='left';impact=Math.max(impact,impactResponse(1,0));hit=true}
    else if(x>b.right){x=b.right;edge='right';impact=Math.max(impact,impactResponse(-1,0));hit=true}
    if(y<b.top){y=b.top;edge='top';impact=Math.max(impact,impactResponse(0,1));hit=true}
    else if(y>b.bottom){y=b.bottom;edge='bottom';impact=Math.max(impact,impactResponse(0,-1));hit=true}
    if(hit&&impact>.04){bendVelocity+=(edge==='top'?-1:1)*Math.min(baseH*.08,impact*18);if(impact>.18)sound('bounce',impact)}
    if(y>=b.bottom-2&&Math.abs(vy)<.35){let lean=leanAngle(angle);const direction=Math.abs(lean)<.15?0:-Math.sign(lean);spin+=direction*Math.sin(Math.min(90,Math.abs(lean))*Math.PI/180)*.00016*dt;spin*=Math.pow(.96,dt/16.667)}
    bendVelocity+=-bend*.017*dt;bendVelocity*=Math.pow(.79,dt/16.667);bend+=bendVelocity*dt/16.667;
    const damping=Math.pow(.985,dt/16.667);vx*=damping;spin*=Math.pow(.992,dt/16.667);paint();
    if(y>=b.bottom-1&&vy===0&&Math.abs(vx)<.025&&Math.abs(spin)<.003&&Math.abs(leanAngle(angle))<.4&&Math.abs(bend)<.1&&Math.abs(bendVelocity)<.1){vx=spin=bend=bendVelocity=0;paint();previous=0;return}frame=requestAnimationFrame(tick);
  }
  function down(event){
    if(burst||resetting||event.button!==0)return;audioReady();activity();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1){stop();moved=false;const rect=active?{left:x,top:y}:union();drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,dx:event.clientX-rect.left,dy:event.clientY-rect.top,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp,overX:0,overY:0};vx=vy=spin=0}
    else if(pointers.size===2){event.preventDefault();if(!active)makeOverlay();moved=true;const [a,b]=[...pointers.values()];pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale,midX:(a.x+b.x)/2,midY:(a.y+b.y)/2,centerX:x+w/2,centerY:y+h/2,contactAngle:Math.atan2(b.y-a.y,b.x-a.x),time:event.timeStamp};drag=null;stop()}
  }
  function union(){const boxes=originals.map(n=>n.getBoundingClientRect());return{left:Math.min(...boxes.map(r=>r.left)),top:Math.min(...boxes.map(r=>r.top))}}
  function move(event){
    if(pieceDrag&&pieceDrag.id===event.pointerId){event.preventDefault();const d=pieceDrag,p=d.piece,v=view(),dt=Math.max(8,event.timeStamp-d.time);p.x=clamp(event.clientX-d.dx,v.left,Math.max(v.left,v.left+v.w-p.w));p.y=clamp(event.clientY-d.dy,v.top,Math.max(v.top,v.top+v.h-p.h));p.vx=p.vx*.5+clamp((event.clientX-d.lastX)/dt,-1.8,1.8)*.5;p.vy=p.vy*.5+clamp((event.clientY-d.lastY)/dt,-1.8,1.8)*.5;d.lastX=event.clientX;d.lastY=event.clientY;d.time=event.timeStamp;paintPiece(p);activity();return}
    if(!pointers.has(event.pointerId)||burst)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinch&&pointers.size>=2){event.preventDefault();const [a,b]=[...pointers.values()],contactAngle=Math.atan2(b.y-a.y,b.x-a.x);let delta=contactAngle-pinch.contactAngle;delta=Math.atan2(Math.sin(delta),Math.cos(delta));pinch.contactAngle=contactAngle;angle+=delta*180/Math.PI;const dt=Math.max(8,event.timeStamp-pinch.time);spin=spin*.65+clamp(delta*180/Math.PI/dt,-.18,.18)*.35;pinch.time=event.timeStamp;
      const v=view(),r=angle*Math.PI/180,rw=Math.abs(Math.cos(r))*baseW+Math.abs(Math.sin(r))*baseH,rh=Math.abs(Math.sin(r))*baseW+Math.abs(Math.cos(r))*baseH,maxScale=Math.min(1.45,v.w/rw,v.h/rh);desiredScale=clamp(pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,.35,1.45);scale=Math.min(desiredScale,maxScale);setSize();const boundsNow=bounds();x=clamp(pinch.centerX+(a.x+b.x)/2-pinch.midX-w/2,boundsNow.left,boundsNow.right);y=clamp(pinch.centerY+(a.y+b.y)/2-pinch.midY-h/2,boundsNow.top,boundsNow.bottom);paint();activity();return}
    if(!drag||drag.id!==event.pointerId)return;if(!moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6){moved=true;if(!active)makeOverlay();try{overlay.setPointerCapture(event.pointerId)}catch{}}
    if(!moved||!active)return;event.preventDefault();overlay.classList.add('is-held');const b=bounds(),rawX=event.clientX-drag.dx,rawY=event.clientY-drag.dy;x=clamp(rawX,b.left,b.right);y=clamp(rawY,b.top,b.bottom);drag.overX=rawX-x;drag.overY=rawY-y;const dt=Math.max(8,event.timeStamp-drag.time);vx=vx*.55+clamp((event.clientX-drag.lastX)/dt,-2,2)*.45;vy=vy*.55+clamp((event.clientY-drag.lastY)/dt,-2,2)*.45;drag.lastX=event.clientX;drag.lastY=event.clientY;drag.time=event.timeStamp;drag.afterPinch=false;activity();start();
  }
  function up(event){
    if(pieceDrag&&pieceDrag.id===event.pointerId){const d=pieceDrag,p=d.piece;pieceDrag=null;p.node.classList.remove('is-held');if(event.timeStamp-d.time>90||event.type==='pointercancel')p.vx=p.vy=0;p.spin=clamp((p.vx-p.vy)*.12,-.2,.2);activity();if(reduced.matches)settleReduced();else start();return}
    if(!pointers.has(event.pointerId))return;pointers.delete(event.pointerId);activity();
    if(pinch){pinch=null;if(pointers.size===1){const[id,p]=pointers.entries().next().value;drag={id,startX:p.x,startY:p.y,dx:p.x-x,dy:p.y-y,lastX:p.x,lastY:p.y,time:event.timeStamp,overX:0,overY:0,afterPinch:true}}else{drag=null;overlay?.classList.remove('is-held');if(reduced.matches)settleReduced();else start()}return}
    if(!drag||drag.id!==event.pointerId)return;const d=drag;drag=null;overlay?.classList.remove('is-held');if(!moved){if(active)start();return}if(event.timeStamp-d.time>90){vx=vy=0;if(d.afterPinch)spin=0}
    if(!d.afterPinch)spin=clamp(((d.dx-w/2)*vy-(d.dy-h/2)*vx)/(Math.max(w,h)**2)*26,-.27,.27);if((d.overX<0&&vx<0)||(d.overX>0&&vx>0))vx*=-.48;if((d.overY<0&&vy<0)||(d.overY>0&&vy>0))vy*=-.48;charge=0;
    if(reduced.matches){settleReduced();return}if(event.type==='pointercancel'){vx=vy=spin=bend=bendVelocity=0;paint();return}start();
  }
  originals.forEach(node=>{node.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch')down(event)});node.addEventListener('dragstart',e=>e.preventDefault())});
  // A second finger can land in the space between the two lines while the first holds the mark.
  document.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'||pointers.size!==1||pointers.has(event.pointerId)||pieceDrag||event.target.closest?.('a,button,input,textarea,dialog'))return;const boxes=active?[overlay.getBoundingClientRect()]:originals.map(n=>n.getBoundingClientRect()),left=Math.min(...boxes.map(r=>r.left))-12,right=Math.max(...boxes.map(r=>r.right))+12,top=Math.min(...boxes.map(r=>r.top))-12,bottom=Math.max(...boxes.map(r=>r.bottom))+12;if(event.clientX>=left&&event.clientX<=right&&event.clientY>=top&&event.clientY<=bottom)down(event)});
  document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
  // Safari can take over a second pointer for page zoom. Track the hero's touch
  // sequence directly and prevent the native gesture only after the mark is touched.
  const heroTouches=new Set();
  const asPointer=(touch,event,type)=>({pointerId:touch.identifier+10000,pointerType:'hero-touch',button:0,clientX:touch.clientX,clientY:touch.clientY,timeStamp:event.timeStamp,type,target:touch.target,preventDefault:()=>event.preventDefault()});
  function nearMark(touch){const boxes=active&&overlay?[overlay.getBoundingClientRect()]:originals.map(n=>n.getBoundingClientRect()),left=Math.min(...boxes.map(r=>r.left))-18,right=Math.max(...boxes.map(r=>r.right))+18,top=Math.min(...boxes.map(r=>r.top))-18,bottom=Math.max(...boxes.map(r=>r.bottom))+18;return touch.clientX>=left&&touch.clientX<=right&&touch.clientY>=top&&touch.clientY<=bottom}
  document.addEventListener('touchstart',event=>{let claimed=false;for(const t of event.changedTouches){const target=t.target,hero=target.closest?.('#hero-title .title-line > svg, .hero-play-object'),blocked=target.closest?.('a,button,input,textarea,dialog,.hero-play-piece');if(!blocked&&(hero||(heroTouches.size&&nearMark(t)))){heroTouches.add(t.identifier);down(asPointer(t,event,'pointerdown'));claimed=true}}if(claimed)event.preventDefault()},{passive:false});
  document.addEventListener('touchmove',event=>{let claimed=false;for(const t of event.changedTouches)if(heroTouches.has(t.identifier)){move(asPointer(t,event,'pointermove'));claimed=true}if(claimed)event.preventDefault()},{passive:false});
  function endTouches(event){for(const t of event.changedTouches)if(heroTouches.delete(t.identifier))up(asPointer(t,event,event.type==='touchcancel'?'pointercancel':'pointerup'))}
  document.addEventListener('touchend',endTouches,{passive:false});document.addEventListener('touchcancel',endTouches,{passive:false});
  title.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){event.preventDefault();reset();return}const d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];if(!d)return;event.preventDefault();stop();if(!active)makeOverlay();const b=bounds();x=clamp(x+d[0],b.left,b.right);y=clamp(y+d[1],b.top,b.bottom);paint();activity()});
  addEventListener('scroll',()=>{const current=scrollY,delta=current-lastScroll;lastScroll=current;if(!active||resetting||!delta)return;const v=view(),shift=clamp(delta,-v.h*.7,v.h*.7);if(burst){for(const p of pieces){if(pieceDrag?.piece===p)continue;p.y=clamp(p.y-shift,v.top,Math.max(v.top,v.top+v.h-p.h));paintPiece(p)}}else if(!drag&&!pinch){const b=bounds();y=clamp(y-shift,b.top,b.bottom);paint()}activity();if(reduced.matches&&!drag&&!pinch&&!pieceDrag)settleReduced();else start()},{passive:true});
  function resize(){if(!active||drag||pinch||burst)return;const b=bounds();x=clamp(x,b.left,b.right);y=clamp(y,b.top,b.bottom);paint()}
  addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);addEventListener('pagehide',()=>reset(true));
})();
