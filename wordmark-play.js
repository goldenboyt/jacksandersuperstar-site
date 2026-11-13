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
  let x=0,y=0,w=0,h=0,baseW=0,baseH=0,bleedX=0,bleedY=0,scale=1,desiredScale=1,angle=0,spin=0,vx=0,vy=0,bend=0,bendVelocity=0,pressure=0,edge='',charge=0,lineData=[];
  let frame=0,previous=0,idle=0,resetTimer=0,audio=null,lastSound=0,lastScroll=scrollY;
  const soundBuffers={},soundLoads={},soundRetryAfter={};let squeezeSource=null,squeezeGain=null,squeezeFallback=false,audioPrimed=false,resuming=null;
  function loadSound(name){
    if(soundBuffers[name])return Promise.resolve(soundBuffers[name]);
    if(soundLoads[name])return soundLoads[name];
    if(performance.now()<(soundRetryAfter[name]||0))return Promise.resolve(null);
    soundLoads[name]=fetch(`/assets/wordmark-sounds/${name}.mp3`).then(r=>{if(!r.ok)throw new Error('sound unavailable');return r.arrayBuffer()}).then(bytes=>audio.decodeAudioData(bytes)).then(buffer=>(soundBuffers[name]=buffer)).catch(()=>{soundRetryAfter[name]=performance.now()+4000;return null}).finally(()=>{delete soundLoads[name]});
    return soundLoads[name];
  }
  function resumeAudio(){if(!audio)return Promise.resolve(false);if(audio.state==='running')return Promise.resolve(true);if(!resuming){try{resuming=audio.resume().then(()=>audio.state==='running').catch(()=>false).finally(()=>{resuming=null})}catch{return Promise.resolve(false)}}return resuming}
  function audioReady(){
    try{if(navigator.audioSession)navigator.audioSession.type='transient'}catch{}
    try{
      if(audio?.state==='closed'){squeezeSource=squeezeGain=null;squeezeFallback=false;audio=null;audioPrimed=false;resuming=null}
      audio ||= new (window.AudioContext||window.webkitAudioContext)();
      // Resume and start a silent buffer in the trusted touch callback for iOS.
      const needsPrime=!audioPrimed||audio.state!=='running';resumeAudio();if(needsPrime)try{const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=audio.createBuffer(1,1,audio.sampleRate);gain.gain.value=0;source.connect(gain).connect(audio.destination);source.onended=()=>{source.disconnect();gain.disconnect()};source.start();audioPrimed=true}catch{}
      loadSound('squeeze');loadSound('pop');
    }catch{}
  }
  function playSample(buffer,volume){if(!audio||!buffer)return;if(audio.state!=='running'){const requested=performance.now();resumeAudio().then(ok=>{if(ok&&performance.now()-requested<2500)playSample(buffer,volume)});return}const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain).connect(audio.destination);source.onended=()=>{source.disconnect();gain.disconnect()};source.start()}
  function stopSqueeze(){if(!squeezeSource)return;const source=squeezeSource,gain=squeezeGain;squeezeSource=squeezeGain=null;squeezeFallback=false;try{gain.gain.setTargetAtTime(.0001,audio.currentTime,.015);source.stop(audio.currentTime+.06)}catch{}}
  function squeezeSound(amount,moving){
    if(!audio||audio.state!=='running'||amount<4||(burst&&!pieceDrag)){stopSqueeze();return}
    const buffer=soundBuffers.squeeze;if(!buffer&&!soundRetryAfter.squeeze){loadSound('squeeze');return}
    if(!buffer&&performance.now()>=(soundRetryAfter.squeeze||0))loadSound('squeeze');
    const level=Math.min(1,amount/Math.max(30,h*.51)),now=audio.currentTime;
    if(buffer&&squeezeSource&&squeezeFallback)stopSqueeze();
    if(!squeezeSource){const source=buffer?audio.createBufferSource():audio.createOscillator(),gain=audio.createGain();if(buffer){source.buffer=buffer;source.loop=true}else source.type='triangle';gain.gain.value=.0001;source.connect(gain).connect(audio.destination);source.onended=()=>{source.disconnect();gain.disconnect();if(squeezeSource===source){squeezeSource=null;squeezeGain=null;squeezeFallback=false}};source.start();squeezeSource=source;squeezeGain=gain;squeezeFallback=!buffer}
    if(squeezeFallback)squeezeSource.frequency.setTargetAtTime(210+level*180,now,.045);else squeezeSource.playbackRate.setTargetAtTime(.99+level*.42,now,.045);
    squeezeGain.gain.setTargetAtTime(squeezeFallback ? .025+level*.02 : (moving ? .27 : .16)+level*.14,now,.03);
  }
  function sound(kind,intensity=1){
    if(!audio)return;
    if(kind==='pop'){stopSqueeze();if(soundBuffers.pop)playSample(soundBuffers.pop,.65);else{const started=performance.now();loadSound('pop').then(buffer=>{if(performance.now()-started<3000&&active){if(buffer)playSample(buffer,.65);else synthPop()}})}return}
    if(audio.state!=='running'){const requested=performance.now();resumeAudio().then(ok=>{if(ok&&active&&performance.now()-requested<450)sound(kind,intensity)});return}if(performance.now()-lastSound<85)return;lastSound=performance.now();const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain(),duration=.086;
    o.type='sine';o.frequency.setValueAtTime(322,t);o.frequency.exponentialRampToValueAtTime(101,t+duration);g.gain.setValueAtTime(.065*Math.min(1,.55+intensity*.12),t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(audio.destination);o.onended=()=>{o.disconnect();g.disconnect()};o.start(t);o.stop(t+duration+.005);
  }
  function synthPop(){if(!audio)return;if(audio.state!=='running'){resumeAudio().then(ok=>{if(ok&&active)synthPop()});return}const now=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(330,now);o.frequency.exponentialRampToValueAtTime(65,now+.12);g.gain.setValueAtTime(.14,now);g.gain.exponentialRampToValueAtTime(.0001,now+.16);o.connect(g).connect(audio.destination);o.onended=()=>{o.disconnect();g.disconnect()};o.start(now);o.stop(now+.17)}
  function activity(){clearTimeout(idle);idle=setTimeout(()=>{if(drag||pinch||pieceDrag||pointers.size){activity();return}reset()},10000)}
  function stop(){cancelAnimationFrame(frame);frame=0;previous=0}
  function start(){if(!frame&&active&&(!reduced.matches||drag||pieceDrag)){previous=0;frame=requestAnimationFrame(tick)}}
  function bounds(){const v=view(),r=angle*Math.PI/180,ex=(Math.abs(Math.cos(r))*w+Math.abs(Math.sin(r))*h-w)/2,ey=(Math.abs(Math.sin(r))*w+Math.abs(Math.cos(r))*h-h)/2,padX=Math.min(v.w*.06,Math.max(0,(v.w-w-2*ex)/2),(drag?16:6)+Math.abs(bend)*scale*.35),padY=Math.min(v.h*.23,Math.max(0,(v.h-h-2*ey)/2),(drag?24:6)+Math.abs(bend)*scale*.95+(drag?(lineData[0]?.h||0)*scale*.2:0));return{left:v.left+ex+padX,right:Math.max(v.left+ex+padX,v.left+v.w-w-ex-padX),top:v.top+ey+padY,bottom:Math.max(v.top+ey+padY,v.top+v.h-h-ey-padY)}}
  function setSize(){w=baseW*scale;h=baseH*scale;overlay.style.width=(w+2*bleedX*scale)+'px';overlay.style.height=(h+2*bleedY*scale)+'px'}
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
    overlay.style.transform=`translate3d(${x-bleedX*scale}px,${y-bleedY*scale}px,0) rotate(${angle}deg)`;
    for(const g of glyphs){
      const curve=2*bend*g.t*(1-g.t),slope=2*bend*(1-2*g.t)/g.line.w;
      const px=g.line.x+g.inset+g.t*g.usable,py=g.line.y+g.line.h*.86+curve-g.rise;
      g.node.setAttribute('transform',`translate(${px} ${py}) rotate(${Math.atan(slope)*180/Math.PI}) scale(${g.ratio} 1)`);
    }
  }
  function makeOverlay(){
    const boxes=originals.map(n=>n.getBoundingClientRect());const left=Math.min(...boxes.map(r=>r.left)),top=Math.min(...boxes.map(r=>r.top)),right=Math.max(...boxes.map(r=>r.right)),bottom=Math.max(...boxes.map(r=>r.bottom));
    baseW=w=right-left;baseH=h=bottom-top;bleedX=baseW*.2;bleedY=baseH*.85;x=left;y=top;
    lineData=boxes.map(r=>({x:r.left-left,y:r.top-top,w:r.width,h:r.height}));
    overlay=element('svg',{class:'hero-play-object',viewBox:`${-bleedX} ${-bleedY} ${baseW+bleedX*2} ${baseH+bleedY*2}`,overflow:'visible','aria-hidden':'true'});
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
    if(!active)return;stopSqueeze();if(resetting&&immediate!==true)return;
    if(immediate!==true&&!reduced.matches){resetting=true;clearTimeout(idle);stop();for(const node of burst?pieces.map(p=>p.node):[overlay]){node.style.pointerEvents='none';node.animate([{opacity:1},{opacity:0}],{duration:300,easing:'ease-out',fill:'forwards'})}resetTimer=setTimeout(()=>{reset(true);originals.forEach(n=>n.animate([{opacity:0},{opacity:1}],{duration:300,easing:'ease-out'}))},300);return}
    clearTimeout(resetTimer);clearTimeout(idle);stop();document.querySelectorAll('.hero-pop-spark').forEach(n=>n.remove());pieces.forEach(p=>p.node.remove());pieces=[];overlay?.remove();overlay=null;originals.forEach(n=>{n.style.removeProperty('opacity');n.style.removeProperty('pointer-events')});
    active=burst=resetting=false;drag=pinch=pieceDrag=null;pointers.clear();heroTouches.clear();moved=false;vx=vy=angle=spin=bend=bendVelocity=pressure=charge=0;scale=desiredScale=1;edge='';
  }
  function pieceBounds(p){
    const v=view(),r=p.angle*Math.PI/180,ex=(Math.abs(Math.cos(r))*p.w+Math.abs(Math.sin(r))*p.h-p.w)/2,ey=(Math.abs(Math.sin(r))*p.w+Math.abs(Math.cos(r))*p.h-p.h)/2,curve=Math.abs(p.bend||0),padX=Math.min(v.w*.05,Math.max(0,(v.w-p.w-2*ex)/2),curve*.35),padY=Math.min(v.h*.12,Math.max(0,(v.h-p.h-2*ey)/2),curve*.9);
    return{left:v.left+ex+padX,right:Math.max(v.left+ex+padX,v.left+v.w-p.w-ex-padX),top:v.top+ey+padY,bottom:Math.max(v.top+ey+padY,v.top+v.h-p.h-ey-padY)};
  }
  function preparePieceBend(p){
    if(p.letters||[...p.node.textContent].length<2)return;
    const chars=[...p.node.textContent],ctx=document.createElement('canvas').getContext('2d'),size=parseFloat(p.node.style.fontSize),weight=p.node.style.fontWeight||'400';ctx.font=`${weight} ${size}px Helvetica Neue, Helvetica, Arial, sans-serif`;
    const widths=chars.map(c=>ctx.measureText(c).width),spacing=-size*.035,total=Math.max(1,widths.reduce((a,b)=>a+b,0)+spacing*(chars.length-1));let cursor=0;const fragment=document.createDocumentFragment();p.letters=[];
    chars.forEach((char,i)=>{const node=document.createElement('span');node.className='hero-piece-letter';node.textContent=char;p.letters.push({node,t:clamp((cursor+widths[i]/2)/total,0,1)});fragment.append(node);cursor+=widths[i]+spacing});p.node.replaceChildren(fragment);p.bend=0;p.bendVelocity=0;
  }
  function bendPiece(p,target,dt){p.bend??=0;p.bendVelocity??=0;p.bendVelocity+=(target-p.bend)*.018*dt;p.bendVelocity*=Math.pow(.78,dt/16.667);p.bend+=p.bendVelocity*dt/16.667}
  function paintPiece(p){
    p.node.style.transform=`translate3d(${p.x-p.originX}px,${p.y-p.originY}px,0) rotate(${p.angle}deg) scale(${p.ratio*(1+p.squash*.35)},${1-p.squash})`;
    if(p.letters)for(const letter of p.letters){const curve=2*(p.bend||0)*letter.t*(1-letter.t),slope=2*(p.bend||0)*(1-2*letter.t)/Math.max(1,p.w);letter.node.style.transform=`translateY(${curve}px) rotate(${Math.atan(slope)*180/Math.PI}deg)`}
  }
  function settleReduced(){
    stop();if(!burst){angle=spin=vx=vy=bend=bendVelocity=0;const b=bounds();x=clamp(x,b.left,b.right);y=b.bottom;paint();return}
    const v=view(),placed=[];for(const p of pieces){p.angle=p.spin=p.vx=p.vy=p.squash=p.bend=p.bendVelocity=0;p.x=clamp(p.x,v.left,Math.max(v.left,v.left+v.w-p.w));p.y=v.top+v.h-p.h;
      for(const q of placed)if(Math.min(p.x+p.w,q.x+q.w)-Math.max(p.x,q.x)>5)p.y=Math.min(p.y,q.y-p.h);
      p.y=Math.max(v.top,p.y);placed.push(p);paintPiece(p);
    }
  }
  function popBurst(cx,cy){
    if(reduced.matches)return;
    const v=view();cx=clamp(cx,v.left,v.left+v.w);cy=clamp(cy,v.top,v.top+v.h);
    for(let i=0;i<8;i++){
      const spark=document.createElement('span'),theta=i*Math.PI/4+.13,dist=22+(i%3)*5;
      spark.className='hero-pop-spark';spark.style.left=cx+'px';spark.style.top=cy+'px';if(i===1||i===5)spark.classList.add('is-red');document.body.append(spark);
      const anim=spark.animate([{opacity:.8,transform:`translate(-50%,-50%) rotate(${theta}rad) translateX(5px) scaleX(.55)`},{opacity:0,transform:`translate(-50%,-50%) rotate(${theta}rad) translateX(${dist}px) scaleX(1)`}],{duration:330+(i%3)*25,easing:'cubic-bezier(.1,.7,.2,1)'});
      anim.onfinish=()=>spark.remove();anim.oncancel=()=>spark.remove();
    }
  }
  function attachPiece(p){
    p.node.addEventListener('pointerdown',event=>{if(resetting||event.button!==0||pieceDrag)return;event.preventDefault();event.stopPropagation();audioReady();activity();preparePieceBend(p);pieceDrag={piece:p,id:event.pointerId,dx:event.clientX-p.x,dy:event.clientY-p.y,lastX:event.clientX,lastY:event.clientY,time:event.timeStamp,overX:0,overY:0,charge:0};p.vx=p.vy=p.spin=0;p.node.classList.add('is-held');try{p.node.setPointerCapture(event.pointerId)}catch{}start()});
  }
  function splitWord(p){
    const chars=[...p.node.textContent];if(chars.length<2)return;
    const d=pieceDrag,v=view(),cx=p.x+p.w/2,cy=p.y+p.h/2,pointX=d?.lastX??cx,pointY=d?.lastY??cy;
    sound('pop',1.5);popBurst(pointX,pointY);stopSqueeze();p.node.classList.remove('is-held');p.node.remove();pieces=pieces.filter(q=>q!==p);pieceDrag=null;
    const ctx=document.createElement('canvas').getContext('2d'),fontSize=parseFloat(p.node.style.fontSize),weight=p.node.style.fontWeight||'400';ctx.font=`${weight} ${fontSize}px Helvetica Neue, Helvetica, Arial, sans-serif`;
    const advances=chars.map(char=>ctx.measureText(char).width),spacing=-fontSize*.035,total=Math.max(1,advances.reduce((a,b)=>a+b,0)+spacing*(chars.length-1)),r=p.angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r);let cursor=0;
    chars.forEach((char,index)=>{
      const t=clamp((cursor+advances[index]/2)/total,0,1),target=p.w*advances[index]/total,localX=p.w*t-p.w/2,localY=2*(p.bend||0)*t*(1-t),worldX=c*localX-s*localY,worldY=s*localX+c*localY,px=cx+worldX-target/2,py=cy+worldY-p.h/2;
      const node=document.createElement('span');node.className='hero-play-piece';node.setAttribute('aria-hidden','true');node.textContent=char;
      Object.assign(node.style,{left:px+'px',top:py+'px',fontSize:fontSize+'px',fontWeight:weight});document.body.append(node);const measured=node.getBoundingClientRect(),ratio=target/Math.max(1,measured.width);node.style.left=(px+(target-measured.width)/2)+'px';node.style.width=measured.width+'px';node.style.height=(measured.height+2)+'px';
      const direction=(index-(chars.length-1)/2)/Math.max(1,chars.length/2),piece={node,x:px,y:py,originX:px,originY:py,w:target,h:measured.height+2,vx:clamp(direction*.8+(Math.random()-.5)*.28,-1.1,1.1),vy:-.35-Math.random()*.4,angle:p.angle+Math.atan(2*(p.bend||0)*(1-2*t)/Math.max(1,p.w))*180/Math.PI,spin:direction*.09+(Math.random()-.5)*.025,ratio,squash:0};pieces.push(piece);paintPiece(piece);attachPiece(piece);cursor+=advances[index]+spacing;
    });
    activity();if(reduced.matches)settleReduced();else start();
  }
  function explode(){
    if(!active||burst)return;const contactX=drag?.lastX??x+w/2,contactY=drag?.lastY??y+h/2;burst=true;sound('pop',1.5);popBurst(contactX,contactY);drag=pinch=null;pointers.clear();overlay.style.visibility='hidden';
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    ctx.font=`700 ${lineData[0].h*scale*1.09}px Helvetica Neue, Helvetica, Arial, sans-serif`;
    const hashPart=clamp(ctx.measureText('#').width/ctx.measureText('#jacksander').width,.07,.2);
    ctx.font=`300 ${lineData[1].h*scale*1.09}px Helvetica Neue, Helvetica, Arial, sans-serif`;const superWidth=ctx.measureText('superstar').width;ctx.font=`400 ${lineData[1].h*scale*1.09*.32}px Helvetica Neue, Helvetica, Arial, sans-serif`;const markWidth=ctx.measureText('®').width,markPart=clamp(markWidth/(superWidth+markWidth),.025,.08);
    const parts=[{text:'#',line:lineData[0],offset:0,fraction:hashPart,weight:700},{text:'jacksander',line:lineData[0],offset:hashPart,fraction:1-hashPart,weight:700},{text:'superstar',line:lineData[1],offset:0,fraction:1-markPart,weight:300},{text:'®',line:lineData[1],offset:1-markPart,fraction:markPart,weight:400,small:true}];
    parts.forEach((part,i)=>{
      const {line}=part,node=document.createElement('span');node.className='hero-play-piece';node.setAttribute('aria-hidden','true');
      node.textContent=part.text;
      const px=x+(line.x+line.w*part.offset)*scale,py=y+line.y*scale,target=line.w*part.fraction*scale;
      Object.assign(node.style,{left:px+'px',top:py+'px',fontSize:(line.h*scale*1.09*(part.small ? .32 : 1))+'px',fontWeight:String(part.weight)});document.body.append(node);
      const measured=node.getBoundingClientRect(),ratio=target/Math.max(1,measured.width);
      node.style.left=(px+(target-measured.width)/2)+'px';node.style.width=measured.width+'px';node.style.height=(measured.height+2)+'px';
      const offsetX=(px+target/2)-(x+w/2),offsetY=(py+(measured.height+2)/2)-(y+h/2),p={node,x:px,y:py,originX:px,originY:py,w:target,h:measured.height+2,vx:clamp(offsetX*.0025+vx*.25,-1.1,1.1),vy:clamp(offsetY*.0025-.32,-.85,.45),angle,spin:(i-1.5)*.045,ratio,squash:0};pieces.push(p);paintPiece(p);attachPiece(p);
    });activity();if(reduced.matches)settleReduced();else start();
  }
  function tick(now){
    frame=0;const dt=previous?Math.min(32,now-previous):16;previous=now;
    if(burst){const v=view();let moving=false;for(const p of pieces){p.supported=false;if(pieceDrag?.piece===p){const d=pieceDrag,n=Math.max(Math.abs(d.overX||0),Math.abs(d.overY||0));squeezeSound(n,now-d.time<120);if(p.letters){const target=clamp((d.overY||0)*.8+(d.overX||0)*.35+p.vy*16,-p.h*.65,p.h*.65);bendPiece(p,target,dt);const safe=pieceBounds(p);p.x=clamp(p.x,safe.left,safe.right);p.y=clamp(p.y,safe.top,safe.bottom);paintPiece(p)}if([...p.node.textContent].length>1&&n>Math.max(25,p.h*.48)){if(!d.charge)d.charge=now;if(now-d.charge>=900){splitWord(p);return}}else d.charge=0;moving=true;continue}p.vy+=.0012*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;const oldAngle=p.angle;p.angle+=p.spin*dt;
      let trial=p.angle*Math.PI/180;if(Math.abs(Math.cos(trial))*p.w+Math.abs(Math.sin(trial))*p.h>v.w||Math.abs(Math.sin(trial))*p.w+Math.abs(Math.cos(trial))*p.h>v.h){p.angle=oldAngle;p.spin*=-.65}
      if(p.letters)bendPiece(p,0,dt);const {left,right,top,bottom}=pieceBounds(p);
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
      moving=pieces.some(p=>{if(pieceDrag?.piece===p)return true;const r=rect(p),flat=Math.abs(p.angle-Math.round(p.angle/180)*180);return Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.spin)>.025||(!p.supported&&r.bottom<v.top+v.h-.5)||flat>.3||Math.abs(p.bend||0)>.1||Math.abs(p.bendVelocity||0)>.1});
      if(moving)frame=requestAnimationFrame(tick);else previous=0;return}
    if(drag){const n=Math.max(Math.abs(drag.overX),Math.abs(drag.overY));squeezeSound(n,now-drag.time<120);if(n>Math.max(30,h*.51)){if(!charge)charge=now;if(now-charge>=900){explode();return}}else charge=0;
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
    else if(pointers.size===2){stopSqueeze();event.preventDefault();if(!active)makeOverlay();moved=true;const [a,b]=[...pointers.values()];pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale,midX:(a.x+b.x)/2,midY:(a.y+b.y)/2,centerX:x+w/2,centerY:y+h/2,contactAngle:Math.atan2(b.y-a.y,b.x-a.x),time:event.timeStamp};drag=null;stop()}
  }
  function union(){const boxes=originals.map(n=>n.getBoundingClientRect());return{left:Math.min(...boxes.map(r=>r.left)),top:Math.min(...boxes.map(r=>r.top))}}
  function move(event){
    if(pieceDrag&&pieceDrag.id===event.pointerId){event.preventDefault();const d=pieceDrag,p=d.piece,limits=pieceBounds(p),dt=Math.max(8,event.timeStamp-d.time);if(audio&&audio.state!=='running')resumeAudio();const rawX=event.clientX-d.dx,rawY=event.clientY-d.dy;p.x=clamp(rawX,limits.left,limits.right);p.y=clamp(rawY,limits.top,limits.bottom);d.overX=rawX-p.x;d.overY=rawY-p.y;p.vx=p.vx*.5+clamp((event.clientX-d.lastX)/dt,-1.8,1.8)*.5;p.vy=p.vy*.5+clamp((event.clientY-d.lastY)/dt,-1.8,1.8)*.5;d.lastX=event.clientX;d.lastY=event.clientY;d.time=event.timeStamp;paintPiece(p);activity();return}
    if(!pointers.has(event.pointerId)||burst)return;if(audio&&audio.state!=='running')resumeAudio();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinch&&pointers.size>=2){event.preventDefault();const [a,b]=[...pointers.values()],contactAngle=Math.atan2(b.y-a.y,b.x-a.x);let delta=contactAngle-pinch.contactAngle;delta=Math.atan2(Math.sin(delta),Math.cos(delta));pinch.contactAngle=contactAngle;angle+=delta*180/Math.PI;const dt=Math.max(8,event.timeStamp-pinch.time);spin=spin*.65+clamp(delta*180/Math.PI/dt,-.18,.18)*.35;pinch.time=event.timeStamp;
      const v=view(),r=angle*Math.PI/180,rw=Math.abs(Math.cos(r))*baseW+Math.abs(Math.sin(r))*baseH,rh=Math.abs(Math.sin(r))*baseW+Math.abs(Math.cos(r))*baseH,maxScale=Math.min(1.45,v.w/rw,v.h/rh);desiredScale=clamp(pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,.35,1.45);scale=Math.min(desiredScale,maxScale);setSize();const boundsNow=bounds();x=clamp(pinch.centerX+(a.x+b.x)/2-pinch.midX-w/2,boundsNow.left,boundsNow.right);y=clamp(pinch.centerY+(a.y+b.y)/2-pinch.midY-h/2,boundsNow.top,boundsNow.bottom);paint();activity();return}
    if(!drag||drag.id!==event.pointerId)return;if(!moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6){moved=true;if(!active)makeOverlay();try{overlay.setPointerCapture(event.pointerId)}catch{}}
    if(!moved||!active)return;event.preventDefault();overlay.classList.add('is-held');const b=bounds(),rawX=event.clientX-drag.dx,rawY=event.clientY-drag.dy;x=clamp(rawX,b.left,b.right);y=clamp(rawY,b.top,b.bottom);drag.overX=rawX-x;drag.overY=rawY-y;const dt=Math.max(8,event.timeStamp-drag.time);vx=vx*.55+clamp((event.clientX-drag.lastX)/dt,-2,2)*.45;vy=vy*.55+clamp((event.clientY-drag.lastY)/dt,-2,2)*.45;drag.lastX=event.clientX;drag.lastY=event.clientY;drag.time=event.timeStamp;drag.afterPinch=false;activity();start();
  }
  function up(event){
    if(pointers.has(event.pointerId))stopSqueeze();
    if(pieceDrag&&pieceDrag.id===event.pointerId){stopSqueeze();const d=pieceDrag,p=d.piece;pieceDrag=null;p.node.classList.remove('is-held');if(event.timeStamp-d.time>90||event.type==='pointercancel')p.vx=p.vy=0;p.spin=clamp((p.vx-p.vy)*.12,-.2,.2);activity();if(reduced.matches)settleReduced();else start();return}
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
