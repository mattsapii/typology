const f = document.querySelector('[data-contact]');
const s = document.querySelector('[data-status]');
f?.addEventListener('submit', (e) => {
  e.preventDefault();
  const d = new FormData(f);
  const body = `${d.get('message')}\n\n— ${d.get('name')} (${d.get('email')})`;
  location.href = `mailto:${f.dataset.to}?subject=${encodeURIComponent(d.get('topic') + ' — ' + d.get('name'))}&body=${encodeURIComponent(body)}`;
  s.textContent = 'Your email app should open with the message ready to send. If nothing opens, write to ' + f.dataset.to + '.';
});
