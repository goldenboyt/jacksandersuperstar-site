(() => {
  const zoom=document.getElementById('shop-zoom');
  document.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{
    const image=document.getElementById('zoom-image');image.src=button.dataset.zoom;image.alt=button.dataset.title+' — #jacksandersuperstar®';document.getElementById('zoom-title').textContent=button.dataset.title;zoom.showModal();
  }));
  zoom.addEventListener('click',event=>{if(event.target!==zoom)return;const rect=zoom.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)zoom.close()});
})();
