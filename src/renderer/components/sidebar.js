export default class Sidebar {
  #btn;
 
  constructor(onViewCurrent) {
    this.#btn = document.getElementById('btn-current');
 
    this.#btn.addEventListener('click', () => onViewCurrent());
 
    document.querySelectorAll('.sidebar button[title]').forEach((btn) => {
      btn.dataset.tooltip = btn.title;
      btn.removeAttribute('title');
    });
  }
 
  setActive(active) {
    this.#btn.classList.toggle('active', active);
  }
}
