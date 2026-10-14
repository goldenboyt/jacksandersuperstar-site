(() => {
  const form=document.getElementById('prime-form'),input=document.getElementById('prime-input');
  const send=document.getElementById('prime-send'),stop=document.getElementById('prime-stop');
  const status=document.getElementById('prime-status'),log=document.getElementById('prime-messages');
  const intro=document.getElementById('prime-intro'),scroll=document.getElementById('prime-conversation');
  const storage='superstar:jack-prime:conversation';
  let history=[],controller=null,turn=0;
  const idle='jack prime is a character. make it a conversation.';
  const paths=new Set(['/merch','/jacksandersuperstar','/prodigygenius','/cybertruck','/designer','/brainstorm','/catscash','/#music','/#live']);
  function save(){try{sessionStorage.setItem(storage,JSON.stringify(history.slice(-12)))}catch{}}
  function textWithLinks(text,element){
    const regex=/\/(?:#[a-z]+|[a-z]+)(?![a-z/])/g;let position=0;
    for(const match of text.matchAll(regex)){
      if(!paths.has(match[0]))continue;
      element.append(document.createTextNode(text.slice(position,match.index)));
      const a=document.createElement('a');a.href=match[0];a.textContent=match[0];element.append(a);position=match.index+match[0].length;
    }
    element.append(document.createTextNode(text.slice(position)));
  }
  function message(role,text){
    intro.hidden=true;intro.style.display='none';
    const node=document.createElement('div');node.className=`prime-message prime-message--${role}`;
    const label=document.createElement('span');label.className='prime-message-label';label.textContent=role==='user'?'you':'jack prime';
    const body=document.createElement('div');textWithLinks(text,body);node.append(label,body);log.append(node);
    scroll.scrollTop=scroll.scrollHeight;
    return node;
  }
  function resize(){input.style.height='auto';input.style.height=`${Math.min(124,input.scrollHeight)}px`}
  function busy(value){send.disabled=value;stop.hidden=!value;status.textContent=value?'jack prime is thinking…':idle;form.setAttribute('aria-busy',String(value))}
  async function ask(text){
    text=text.trim();if(!text||controller)return;
    const before=[...history],request=++turn;
    const pendingMessage=message('user',text);history.push({role:'user',content:text});input.value='';resize();
    controller=new AbortController();busy(true);
    let answered=false;
    try{
      let recent=history.slice(-11);if(recent[0].role==='assistant')recent.shift();
      const response=await fetch('/api/jack-prime',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:recent}),signal:controller.signal});
      const data=await response.json();
      if(!response.ok||typeof data.text!=='string'||!data.text.trim())throw new Error(data.error||"Can't reach Jack Prime right now.");
      if(request!==turn)return;
      message('assistant',data.text);history.push({role:'assistant',content:data.text});save();answered=true;
    }catch(error){
      if(request!==turn)return;
      pendingMessage.remove();history=before;input.value=text;resize();
      if(!history.length){intro.hidden=false;intro.style.removeProperty('display');}
      status.textContent=error.name==='AbortError'?'stopped. your message is ready to try again.':error.message;
    }finally{
      if(request===turn){controller=null;send.disabled=false;stop.hidden=true;form.setAttribute('aria-busy','false');if(answered)status.textContent=idle;}
    }
  }
  form.addEventListener('submit',event=>{event.preventDefault();ask(input.value)});
  input.addEventListener('input',resize);
  input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit()}});
  document.querySelectorAll('[data-prime-prompt]').forEach(button=>button.addEventListener('click',()=>ask(button.dataset.primePrompt)));
  stop.addEventListener('click',()=>controller?.abort());
  document.getElementById('prime-reset').addEventListener('click',()=>{
    turn++;controller?.abort();controller=null;history=[];save();log.replaceChildren();intro.hidden=false;intro.style.removeProperty('display');busy(false);input.value='';resize();input.focus();
  });
  try{const saved=JSON.parse(sessionStorage.getItem(storage)||'[]');if(Array.isArray(saved)&&saved.length<=12&&saved.every(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.length<=2400)){history=saved;history.forEach(m=>message(m.role,m.content));}}catch{}
  function viewport(){const view=window.visualViewport;if(!view||view.scale===1)document.documentElement.style.setProperty('--prime-height',`${view?.height||innerHeight}px`)}
  window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);viewport();
  window.addEventListener('pagehide',()=>controller?.abort());resize();
})();
