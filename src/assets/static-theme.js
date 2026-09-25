// Small local replacements for theme interactions that previously required WordPress AJAX.
document.querySelectorAll('.menu-btn').forEach(button => {
  button.setAttribute('aria-label','Toggle navigation');button.setAttribute('aria-expanded','false');
  button.addEventListener('click',()=>{const menu=document.querySelector('.header-menu');const open=menu.classList.toggle('static-open');button.classList.toggle('active',open);button.setAttribute('aria-expanded',String(open));});
});
document.querySelectorAll('a[data-action], .speakers__more, .news__more').forEach(link=>{
  // Every captured card is already rendered; no PHP pagination endpoint exists.
  if((link.getAttribute('data-action')||'').includes('.php') || link.getAttribute('href')==='#')link.hidden=true;
});
const header=document.querySelector('.site__header');
function updateHeader(){header?.classList.toggle('fixed',window.scrollY>60);}
window.addEventListener('scroll',updateHeader,{passive:true});updateHeader();
document.querySelectorAll('.news__load-more, .where__more').forEach(link=>{if(link.getAttribute('href')==='#')link.hidden=true;});
