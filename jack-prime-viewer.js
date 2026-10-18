(() => {
  const dialog=document.getElementById('prime-image-viewer');
  if(!dialog)return;
  const stage=document.getElementById('prime-viewer-stage'),image=document.getElementById('prime-viewer-image');
  const minus=document.getElementById('prime-viewer-out'),plus=document.getElementById('prime-viewer-in'),reset=document.getElementById('prime-viewer-reset');
  const save=document.getElementById('prime-viewer-save'),download=document.getElementById('prime-viewer-download'),status=document.getElementById('prime-viewer-status');
  const points=new Map(),limit=5;
  const hint=matchMedia('(pointer:coarse)').matches?'pinch or double-tap to zoom':'scroll to zoom · drag to move';
  let selected=null,zoom=1,x=0,y=0,width=0,height=0,frame=null,tap=null,gesture=null,sharing=false,lastTouch=-Infinity;

  function render(){
    x=Math.max(-Math.max(0,(width*zoom-frame.width)/2),Math.min(Math.max(0,(width*zoom-frame.width)/2),x));
    y=Math.max(-Math.max(0,(height*zoom-frame.height)/2),Math.min(Math.max(0,(height*zoom-frame.height)/2),y));
    image.style.transform=`translate3d(${x}px,${y}px,0) scale(${zoom})`;
    stage.classList.toggle('is-zoomed',zoom>1);
    reset.textContent=`${Math.round(zoom*100)}%`;
    minus.disabled=zoom<=1;plus.disabled=zoom>=limit;
  }
  function measure(){
    if(!dialog.open||!image.naturalWidth)return;
    frame=stage.getBoundingClientRect();
    const fit=Math.min(frame.width/image.naturalWidth,frame.height/image.naturalHeight);
    width=image.naturalWidth*fit;height=image.naturalHeight*fit;
    image.style.width=`${width}px`;image.style.height=`${height}px`;render();
  }
  function setZoom(next,anchor={x:0,y:0},move={x:0,y:0}){
    if(!frame)return;
    next=Math.min(limit,Math.max(1,next));
    const ratio=next/zoom;
    x=anchor.x-(anchor.x-x)*ratio+move.x;y=anchor.y-(anchor.y-y)*ratio+move.y;
    zoom=next;render();
  }
  const local=point=>({x:point.x-frame.left-frame.width/2,y:point.y-frame.top-frame.height/2});
  function toggle(point){if(frame)setZoom(zoom>1?1:2.5,local(point))}
  function close(){if(dialog.open)dialog.close()}
  function open(source){
    if(!(source?.blob instanceof Blob)||!source.url)return;
    if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
    selected=source;zoom=1;x=0;y=0;frame=null;tap=null;gesture=null;points.clear();
    reset.textContent='100%';minus.disabled=true;plus.disabled=false;
    image.removeAttribute('style');image.alt=source.alt||'Jack Prime image';image.src=source.url;
    download.href=source.url;download.download=source.name;status.textContent=hint;
    if(!dialog.open)dialog.showModal();measure();
  }
  async function saveImage(source,output,button){
    if(!(source?.blob instanceof Blob)||sharing)return;
    sharing=true;if(button)button.disabled=true;
    try{
      const file=new File([source.blob],source.name,{type:source.blob.type});
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        if(output)output.textContent='Choose “Save Image” in the share sheet to save to Photos.';
        // Keep the file ready before the tap: native sharing needs user activation.
        await navigator.share({files:[file],title:'Jack Prime image'});
      }else{
        const link=document.createElement('a');link.href=source.url;link.download=source.name;
        document.body.append(link);link.click();link.remove();
        if(output)output.textContent='Image download started.';
      }
    }catch(error){
      if(error.name==='AbortError'){if(output)output.textContent=output===status?hint:'';}
      else{
        if(!dialog.open)open(source);
        status.textContent='Use download file below, or touch and hold the image to save it.';
      }
    }finally{sharing=false;if(button)button.disabled=false;}
  }
  document.getElementById('prime-viewer-close').addEventListener('click',close);
  dialog.addEventListener('close',()=>{
    const opener=selected?.opener;
    selected=null;points.clear();tap=null;gesture=null;frame=null;image.removeAttribute('src');
    if(opener?.isConnected)opener.focus({preventScroll:true});
  });
  image.addEventListener('load',measure);
  image.addEventListener('dragstart',event=>event.preventDefault());
  minus.addEventListener('click',()=>setZoom(zoom/1.5));
  plus.addEventListener('click',()=>setZoom(zoom*1.5));
  reset.addEventListener('click',()=>setZoom(1));
  save.addEventListener('click',()=>saveImage(selected,status,save));
  stage.addEventListener('dblclick',event=>{if(performance.now()-lastTouch>500)toggle({x:event.clientX,y:event.clientY})});
  stage.addEventListener('wheel',event=>{
    if(!frame)return;
    event.preventDefault();setZoom(zoom*Math.exp(-event.deltaY*.002),local({x:event.clientX,y:event.clientY}));
  },{passive:false});
  stage.addEventListener('pointerdown',event=>{
    if(!frame||event.button!==0)return;
    if(event.pointerType==='touch')lastTouch=performance.now();
    points.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(points.size===1)gesture={x:event.clientX,y:event.clientY,at:performance.now(),moved:false,pinch:false};
    else if(gesture){gesture.pinch=true;tap=null;}
    try{stage.setPointerCapture(event.pointerId)}catch{}
  });
  stage.addEventListener('pointermove',event=>{
    if(!points.has(event.pointerId)||!frame)return;
    const before=[...points.values()],previous=points.get(event.pointerId);
    points.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(gesture&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>6)gesture.moved=true;
    if(points.size===2){
      const after=[...points.values()],middle=pair=>({x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2});
      const distance=pair=>Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y);
      const from=middle(before),to=middle(after),prior=distance(before);
      if(prior>0)setZoom(zoom*distance(after)/prior,local(from),{x:to.x-from.x,y:to.y-from.y});
    }else if(points.size===1&&zoom>1){x+=event.clientX-previous.x;y+=event.clientY-previous.y;render();}
  });
  function release(event){
    if(!points.has(event.pointerId))return;
    points.delete(event.pointerId);
    if(event.type==='pointerup'&&event.pointerType==='touch'&&gesture&&!gesture.moved&&!gesture.pinch&&performance.now()-gesture.at<400){
      const now=performance.now(),point={x:event.clientX,y:event.clientY};
      if(tap&&now-tap.at<300&&Math.hypot(point.x-tap.x,point.y-tap.y)<30){toggle(point);tap=null;}
      else tap={...point,at:now};
    }
    if(!points.size)gesture=null;
  }
  stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);
  stage.addEventListener('lostpointercapture',release);
  document.addEventListener('keydown',event=>{
    if(!dialog.open||event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.key==='Tab'){
      const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}
      else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}
      return;
    }
    if(event.key==='+'||event.key==='=')setZoom(zoom*1.5);
    else if(event.key==='-')setZoom(zoom/1.5);
    else if(event.key==='0')setZoom(1);
    else if(zoom>1&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      x+=event.key==='ArrowLeft'?48:event.key==='ArrowRight'?-48:0;
      y+=event.key==='ArrowUp'?48:event.key==='ArrowDown'?-48:0;render();
    }else return;
    event.preventDefault();
  });
  if(window.ResizeObserver)new ResizeObserver(measure).observe(stage);
  else window.addEventListener('resize',measure);
  window.SuperstarImageViewer={open,close,save:saveImage};
})();
