// Native details menus retain keyboard semantics; close after action / outside / Escape.
const menu=document.querySelector('.more-actions');
if(menu){
  menu.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{menu.open=false;}));
  document.addEventListener('pointerdown',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus();}});
}
