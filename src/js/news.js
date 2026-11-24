const f = document.querySelector('[data-news]');
f?.addEventListener('submit', (e) => {
  if (f.getAttribute('action')) return; // real endpoint configured: normal submit
  e.preventDefault();
  const to = f.dataset.to;
  location.href = `mailto:${to}?subject=${encodeURIComponent('Subscribe to Typology news')}&body=${encodeURIComponent('Please add me to the list: ' + f.email.value)}`;
});
