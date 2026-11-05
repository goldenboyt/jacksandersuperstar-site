(() => {
  const video=document.getElementById('hdr-video'),button=document.getElementById('hdr-play'),status=document.getElementById('hdr-status');
  video.muted=true;
  button.addEventListener('click',()=>{
    if(!video.paused){video.pause();return;}
    video.muted=true;
    video.play().catch(()=>{status.textContent='Safari could not start the video sample. You can still compare the two images.'});
  });
  video.addEventListener('playing',()=>{button.textContent='pause video sample';status.textContent='Video sample playing. Compare its white arrow with the standard arrow.'});
  video.addEventListener('pause',()=>{button.textContent='play video sample ↗'});
  video.addEventListener('error',()=>{status.textContent='This browser could not decode the video sample. You can still compare the two images.'});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause()});
  window.addEventListener('pagehide',()=>video.pause());
})();
