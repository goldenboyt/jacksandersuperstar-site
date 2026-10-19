(() => {
  const form=document.getElementById('prime-feature-form'),input=document.getElementById('prime-feature-input');
  if(!form||!input)return;
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const message=input.value.trim();if(!message||message.length>1600)return;
    // A fragment carries the draft to the full chat without putting it in
    // server request logs. Jack Prime consumes it once, then cleans the URL.
    const fragment=new URLSearchParams({message});
    location.assign(`/jackprime#${fragment}`);
  });
  const submit=form.querySelector('button[type="submit"]');if(submit)submit.disabled=false;
})();
