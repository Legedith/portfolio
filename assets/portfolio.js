/* Progressive enhancements only: every project and link works without JS. */
(() => {
  'use strict';
  const root = document.documentElement;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const effectsButton = document.getElementById('effects');
  const effectsLabel = document.getElementById('effects-state');
  const pupils = document.querySelector('.pupils');
  let savedEffects = null;
  try { savedEffects = localStorage.getItem('legedith-film-effects'); } catch { /* Storage is optional. */ }
  let effectsOn = !motionPreference.matches && savedEffects !== 'off';
  const applyEffects = () => {
    root.dataset.effects = effectsOn ? 'on' : 'off';
    effectsButton.setAttribute('aria-pressed', String(effectsOn));
    effectsButton.disabled = motionPreference.matches;
    effectsButton.title = motionPreference.matches ? 'Effects are off because your system requests reduced motion.' : 'Toggle decorative film effects';
    effectsLabel.textContent = effectsOn ? 'on' : 'off';
    if (!effectsOn && pupils) pupils.style.transform = '';
  };
  effectsButton.hidden = false;
  applyEffects();
  effectsButton.addEventListener('click', () => {
    effectsOn = !effectsOn;
    applyEffects();
    try { localStorage.setItem('legedith-film-effects', effectsOn ? 'on' : 'off'); } catch { /* Private browsing remains usable. */ }
  });
  motionPreference.addEventListener('change', event => {
    if (event.matches) effectsOn = false;
    applyEffects();
  });
  const stage = document.getElementById('robot-stage');
  stage.addEventListener('pointermove', event => {
    if (!effectsOn || motionPreference.matches || event.pointerType === 'touch') return;
    const box = stage.getBoundingClientRect();
    const x = Math.max(-5, Math.min(5, ((event.clientX - box.left) / box.width - .5) * 10));
    const y = Math.max(-4, Math.min(4, ((event.clientY - box.top) / box.height - .5) * 8));
    pupils.style.transform = `translate(${x}px, ${y}px)`;
  });
  stage.addEventListener('pointerleave', () => { pupils.style.transform = ''; });
  const questions = [
    'What changes when a machine can see what it just did?',
    'How do you tell adaptation from a lucky second attempt?',
    'What changes when the same model gets a different body?',
    'Can a playful tool make a difficult idea easier to learn?',
    'What should a machine do when it knows it might be wrong?'
  ];
  let questionIndex = 0;
  const nextQuestion = document.getElementById('next-question');
  nextQuestion.hidden = false;
  nextQuestion.addEventListener('click', () => {
    questionIndex = (questionIndex + 1) % questions.length;
    document.getElementById('question').textContent = questions[questionIndex];
  });
  const filters = document.querySelector('.filters');
  const projects = Array.from(document.querySelectorAll('[data-category]'));
  filters.hidden = false;
  filters.addEventListener('click', event => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    const category = button.dataset.filter;
    filters.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    let visible = 0;
    projects.forEach(project => {
      project.hidden = category !== 'all' && project.dataset.category !== category;
      if (!project.hidden) visible += 1;
    });
    document.getElementById('filter-status').textContent = `${visible} ${visible === 1 ? 'project' : 'projects'} shown.`;
  });
  const copyButton = document.getElementById('copy-email');
  const copyStatus = document.getElementById('copy-status');
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText('jatindehmiwal@gmail.com');
      copyStatus.textContent = 'Email copied. Say something curious.';
    } catch {
      copyStatus.textContent = 'Copy manually: jatindehmiwal@gmail.com';
    }
  });
  document.getElementById('year').textContent = String(new Date().getFullYear());
  if ('IntersectionObserver' in window) {
    const links = Array.from(document.querySelectorAll('.header-inner nav a'));
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(link => {
        if (link.getAttribute('href') === `#${visible.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-15% 0px -45% 0px', threshold: 0 });
    document.querySelectorAll('main > section[id]').forEach(section => observer.observe(section));
  }
})();
