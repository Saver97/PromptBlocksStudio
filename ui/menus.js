// 顶部下拉菜单：点外面、点菜单项或按 Esc 时自动收起，同一时间只开一个。
(()=>{
  const openMenus=()=>document.querySelectorAll('details.menu[open]');
  document.addEventListener('click',e=>{for(const m of openMenus()){if(!m.contains(e.target)||e.target.closest('.menu-pop button'))m.open=false;}});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;for(const m of openMenus()){m.open=false;m.querySelector('summary').focus();}});
  document.addEventListener('toggle',e=>{const t=e.target;if(t.matches&&t.matches('details.menu')&&t.open)for(const m of openMenus())if(m!==t)m.open=false;},true);
})();
