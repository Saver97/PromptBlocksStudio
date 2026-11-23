// "教程"按钮：打开教程窗口，左侧目录切换章节，代码块可一键复制。内容来自 tutorial-content.js。
(()=>{
  const dialog=document.getElementById('tutorial'),nav=document.getElementById('tutorialNav'),body=document.getElementById('tutorialBody');
  const sections=window.TUTORIAL_SECTIONS||[];
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function show(i){
    [...nav.children].forEach((b,j)=>{b.classList.toggle('active',j===i);b.setAttribute('aria-current',j===i?'page':'false');});
    body.innerHTML='<h3>'+esc(sections[i].full||sections[i].title)+'</h3>'+sections[i].html;
    body.scrollTop=0;
  }
  sections.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.textContent=s.title;b.onclick=()=>show(i);nav.append(b);});
  document.getElementById('tutorialBtn').onclick=()=>{if(!body.innerHTML)show(0);dialog.showModal();};
  document.getElementById('tutorialClose').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  body.addEventListener('click',async e=>{
    const btn=e.target.closest('.tut-copy');if(!btn)return;
    const text=btn.nextElementSibling.textContent;
    try{if(window.pywebview&&window.pywebview.api&&window.pywebview.api.copy)await window.pywebview.api.copy(text);else await navigator.clipboard.writeText(text);btn.textContent='已复制';}
    catch(err){btn.textContent='复制失败';}
    setTimeout(()=>{btn.textContent='复制';},1500);
  });
})();
