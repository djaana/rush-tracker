const logEl = document.getElementById('log');
const countEl = document.getElementById('count');
let total = 0;

document.getElementById('btn-close').addEventListener('click', () => window.log.close());

document.getElementById('clear-btn').addEventListener('click', () => {
  logEl.innerHTML = '';
  total = 0;
  countEl.textContent = '0 log';
});

const fmt = (ts) => new Date(ts).toLocaleTimeString('fr-FR');

function append({ source, level, text, ts }) {
  source = `[${source.toUpperCase()}]`;

  const el = document.createElement('div');
  el.className = `entry ${level}`;
  el.innerHTML = `<span class="infos">${fmt(ts)} ${source}</span>${text}`;

  logEl.appendChild(el);
  el.scrollIntoView();

  total++;
  
  countEl.textContent = `${total} log${total > 1 ? 's' : ''}`;
}

window.log.onInit((lines) => lines.forEach(append));
window.log.onLine((line) => append(line));
