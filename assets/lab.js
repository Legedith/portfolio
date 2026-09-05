/* LE-G1 is a deterministic, local simulation, not a model or a live robot. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const lab = $('lab'), scene = $('robot-scene'), zone = $('draw-zone');
  const ink = $('ink'), hint = $('paper-hint'), status = $('robot-status');
  const replay = $('replay'), gaze = $('gaze');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const bounds = { left: 155, right: 570, top: 402, bottom: 524 };
  const limits = { strokes: 16, points: 1800 };
  const home = { x: 491, y: 475 };
  const state = { strokes: [], pointer: null, current: null, points: 0,
    playing: false, frame: null, pen: false, position: { ...home }, preset: 0 };
  let motion = !preference.matches, sound = false, audio = null, waveTimer = null;
  try { if (localStorage.getItem('legedith-lab-motion') === 'off') motion = false; } catch { /* Preferences are optional. */ }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const bounded = p => ({ x: clamp(p.x, bounds.left, bounds.right), y: clamp(p.y, bounds.top, bounds.bottom) });
  const fixed = n => Number(n.toFixed(2));
  const say = text => { if (text) status.textContent = text; };
  const pathStart = p => `M${fixed(p.x)} ${fixed(p.y)}l.01 0`;
  const pathLine = p => `L${fixed(p.x)} ${fixed(p.y)}`;
  const newPath = points => {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('d', points.length ? pathStart(points[0]) + points.slice(1).map(pathLine).join('') : '');
    ink.append(el);
    return el;
  };
  function fullRender() {
    ink.replaceChildren();
    state.strokes.forEach(stroke => { stroke.el = newPath(stroke.points); });
    hint.style.display = state.strokes.length ? 'none' : '';
    replay.disabled = !state.strokes.length;
  }
  // Analytical two-link inverse kinematics. The pen tip stays inside a reachable rectangle.
  function pose(point) {
    const p = bounded(point), sx = 368, sy = 279, l1 = 156, l2 = 180;
    const dx = p.x - sx, dy = p.y - 30 - sy;
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + .01, l1 + l2 - .01);
    const a = Math.atan2(dy, dx) - Math.acos(clamp((l1*l1 + d*d - l2*l2)/(2*l1*d), -1, 1));
    const ex = sx + Math.cos(a)*l1, ey = sy + Math.sin(a)*l1;
    const b = Math.atan2(p.y - 30 - ey, p.x - ex);
    $('upper-arm').setAttribute('transform', `translate(${sx} ${sy}) rotate(${fixed(a*180/Math.PI)})`);
    $('forearm').setAttribute('transform', `translate(${fixed(ex)} ${fixed(ey)}) rotate(${fixed(b*180/Math.PI)})`);
    $('elbow').setAttribute('transform', `translate(${fixed(ex)} ${fixed(ey)})`);
    $('tool').setAttribute('transform', `translate(${fixed(p.x)} ${fixed(p.y)})`);
    $('joint-readout').textContent = `θ₁ ${Math.round(a*180/Math.PI)}° / θ₂ ${Math.round((b-a)*180/Math.PI)}°`;
    state.position = p;
    if (motion) gaze.style.transform = `translate(${fixed(clamp((p.x-300)/30,-7,7))}px, 4px)`;
  }
  function pointFromEvent(event) {
    const matrix = scene.getScreenCTM();
    if (!matrix) return { ...state.position };
    const point = scene.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    return bounded(point.matrixTransform(matrix.inverse()));
  }
  function updateReady() {
    lab.classList.remove('is-playing');
    lab.dataset.state = state.strokes.length ? 'ready' : 'idle';
    replay.replaceChildren(document.createTextNode('Replay '));
    const symbol = document.createElement('span');
    symbol.setAttribute('aria-hidden','true'); symbol.textContent = '↺'; replay.append(symbol);
    replay.disabled = !state.strokes.length;
  }
  function stopPlayback(message = '') {
    if (state.frame !== null) cancelAnimationFrame(state.frame);
    state.frame = null;
    if (state.playing) {
      state.playing = false;
      fullRender();
      lab.classList.remove('is-drawing');
      updateReady();
    }
    say(message);
  }
  function endStroke(message = '') {
    state.current = null;
    state.pen = false;
    lab.classList.remove('is-drawing');
    updateReady(); say(message);
  }
  function beginStroke(point) {
    if (state.strokes.length >= limits.strokes || state.points >= limits.points) {
      say('Sketch full. Clear the page for a fresh start.'); return false;
    }
    const p = bounded(point);
    const stroke = { points: [p], el: newPath([p]) };
    state.strokes.push(stroke); state.current = stroke; state.points++;
    hint.style.display = 'none'; replay.disabled = false;
    lab.classList.add('is-drawing'); lab.dataset.state = 'drawing'; pose(p);
    return true;
  }
  function extendStroke(point) {
    const p = bounded(point), stroke = state.current;
    pose(p);
    if (!stroke || state.points >= limits.points) return;
    const last = stroke.points[stroke.points.length - 1];
    if (Math.hypot(p.x-last.x,p.y-last.y) < 1.8) return;
    stroke.points.push(p); state.points++;
    stroke.el.setAttribute('d', stroke.el.getAttribute('d') + pathLine(p));
    if (state.points === limits.points) say('Sketch full. Replay it, or clear to start again.');
  }
  zone.addEventListener('pointerdown', event => {
    if (state.pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); stopPlayback(); endStroke();
    zone.focus({ preventScroll: true });
    if (!beginStroke(pointFromEvent(event))) return;
    state.pointer = event.pointerId;
    zone.setPointerCapture(event.pointerId);
    say('Your hand. My joints. Let’s make something.');
  });
  zone.addEventListener('pointermove', event => {
    if (event.pointerId !== state.pointer) return;
    event.preventDefault(); extendStroke(pointFromEvent(event));
  });
  const finishPointer = event => {
    if (event.pointerId !== state.pointer) return;
    if (event.type === 'pointerup') extendStroke(pointFromEvent(event));
    const id = state.pointer; state.pointer = null;
    if (zone.hasPointerCapture(id)) zone.releasePointerCapture(id);
    endStroke('Nice. Add another stroke, or let me replay it.');
  };
  zone.addEventListener('pointerup', finishPointer);
  zone.addEventListener('pointercancel', finishPointer);
  zone.addEventListener('lostpointercapture', finishPointer);
  zone.addEventListener('keydown', event => {
    const step = event.shiftKey ? 16 : 5;
    const directions = { ArrowLeft: [-step,0], ArrowRight: [step,0], ArrowUp: [0,-step], ArrowDown: [0,step] };
    if (directions[event.key]) {
      event.preventDefault(); stopPlayback();
      const [dx,dy] = directions[event.key], p = bounded({ x: state.position.x+dx, y: state.position.y+dy });
      if (state.pen) extendStroke(p); else pose(p);
    } else if (event.key === ' ' && !event.repeat) {
      event.preventDefault(); stopPlayback();
      if (state.pen) endStroke('Pen lifted. Space to draw again.');
      else if (beginStroke(state.position)) { state.pen = true; say('Pen down. Move with the arrow keys.'); }
    } else if (event.key === 'Enter') {
      event.preventDefault(); endStroke(); play();
    } else if (event.key === 'Escape') {
      event.preventDefault(); stopPlayback(); endStroke('Stopped. Tab to leave the drawing pad.');
    }
  });
  zone.addEventListener('blur', () => { if (state.pen) endStroke(); });
  function play() {
    if (!state.strokes.length) return;
    if (state.playing) { stopPlayback('Stopped. Your sketch is still here.'); return; }
    endStroke();
    const steps = state.strokes.flatMap(stroke => stroke.points.map((p,i) => ({ ...p, start: i===0 })));
    if (!motion) {
      fullRender(); pose(steps[steps.length-1]);
      say('Sketch complete. Motion is off, so no animated replay.'); return;
    }
    ink.replaceChildren();
    state.playing = true; lab.dataset.state = 'playing';
    lab.classList.add('is-playing','is-drawing');
    replay.textContent = 'Stop ■'; replay.disabled = false;
    say('Replaying the path. Same instructions, robot hands.');
    const duration = clamp(steps.length * 18, 1200, 6000);
    let startTime = null, next = 0, path = null, d = '';
    const frame = now => {
      if (!state.playing) return;
      if (startTime === null) startTime = now;
      const count = Math.min(steps.length, Math.floor((now-startTime)/duration*steps.length)+1);
      while (next < count) {
        const step = steps[next++];
        if (step.start) { path = newPath([]); d = pathStart(step); } else { d += pathLine(step); }
        path.setAttribute('d', d);
      }
      pose(steps[Math.max(0,next-1)]);
      if (next < steps.length) { state.frame = requestAnimationFrame(frame); }
      else {
        state.frame = null; state.playing = false;
        fullRender(); lab.classList.remove('is-drawing'); updateReady();
        say('That one goes on the fridge. Your turn?');
      }
    };
    state.frame = requestAnimationFrame(frame);
  }
  replay.addEventListener('click', () => { beep(380); play(); });
  $('clear').addEventListener('click', () => {
    stopPlayback(); endStroke(); state.strokes = []; state.points = 0;
    fullRender(); updateReady(); pose(home); beep(220);
    say('Blank page. Excellent possibilities.');
  });
  function parametric(fn, count = 130) {
    return Array.from({ length: count+1 }, (_,i) => bounded(fn(i/count*Math.PI*2)));
  }
  function makePreset(n) {
    if (n === 0) return [
      parametric(t => { const r=25+12*Math.cos(5*t); return { x:341+r*Math.sin(t), y:450+r*Math.cos(t) }; }),
      [{x:341,y:487},{x:341,y:518}],
      [{x:341,y:510},{x:357,y:496},{x:364,y:498},{x:356,y:509},{x:341,y:510}]
    ];
    if (n === 1) return [
      parametric(t => ({ x:355+33*Math.cos(t), y:461+33*Math.sin(t) })),
      parametric(t => ({ x:355+92*Math.cos(t)*.97+16*Math.sin(t)*.24, y:461-92*Math.cos(t)*.24+16*Math.sin(t)*.97 }))
    ];
    if (n === 2) return [
      [{x:299,y:420},{x:397,y:420},{x:404,y:427},{x:404,y:493},{x:397,y:500},{x:299,y:500},{x:292,y:493},{x:292,y:427},{x:299,y:420}],
      [{x:349,y:420},{x:349,y:407}],
      [{x:319,y:441},{x:319,y:458}], [{x:377,y:441},{x:377,y:458}],
      [{x:333,y:477},{x:340,y:483},{x:358,y:483},{x:365,y:477}]
    ];
    const points = Array.from({length:11},(_,i) => {
      const a=i*Math.PI/5-Math.PI/2, r=i%2 ? 23 : 52;
      return {x:348+r*Math.cos(a), y:466+r*Math.sin(a)};
    });
    return [points];
  }
  $('surprise').addEventListener('click', () => {
    stopPlayback(); endStroke();
    state.strokes = makePreset(state.preset++ % 4).map(points => ({ points, el:null }));
    state.points = state.strokes.reduce((n,s) => n+s.points.length,0);
    hint.style.display = 'none'; fullRender(); beep(560); play();
  });
  $('xray').addEventListener('click', event => {
    const on = event.currentTarget.getAttribute('aria-pressed') !== 'true';
    event.currentTarget.setAttribute('aria-pressed', String(on)); lab.classList.toggle('is-xray',on);
    say(on ? 'Under the shell: two joints, a little geometry.' : 'Shell back on. Still curious.'); beep(on ? 650 : 330);
  });
  $('greet').addEventListener('click', () => {
    if (waveTimer) clearTimeout(waveTimer);
    lab.classList.remove('is-waving');
    if (motion) { void lab.offsetWidth; lab.classList.add('is-waving'); }
    $('smile').setAttribute('d','M280 180q19 26 38 0');
    say('Hello, human. Nice hands. Can I borrow your ideas?'); beep(740);
    waveTimer = setTimeout(() => {
      lab.classList.remove('is-waving'); $('smile').setAttribute('d','M284 183q16 16 31 0');
      waveTimer = null;
    }, 1500);
  });
  $('stage').addEventListener('pointermove', event => {
    if (!motion || state.playing || state.pointer !== null || event.pointerType === 'touch') return;
    const r = $('stage').getBoundingClientRect();
    const x=clamp((event.clientX-r.left)/r.width*18-9,-7,7);
    const y=clamp((event.clientY-r.top)/r.height*12-6,-4,5);
    gaze.style.transform=`translate(${fixed(x)}px,${fixed(y)}px)`;
  });
  $('stage').addEventListener('pointerleave', () => { if (!state.playing) gaze.style.transform = ''; });
  $('take-controls').addEventListener('click', event => {
    event.preventDefault();
    lab.scrollIntoView({behavior:motion?'smooth':'instant',block:'center'});
    zone.focus({preventScroll:true}); say('Draw on the paper. Or press Space and use the arrow keys.');
  });
  function applyMotion() {
    document.documentElement.dataset.motion = motion ? 'on' : 'off';
    $('motion').textContent = motion ? 'Motion on' : 'Motion off';
    $('motion').setAttribute('aria-pressed',String(motion));
    $('motion').disabled = preference.matches;
    $('motion').title = preference.matches ? 'Your device requests reduced motion.' : 'Toggle decorative motion and animated replay';
    if (!motion) { stopPlayback('Motion off. Drawing and all controls still work.'); gaze.style.transform=''; }
  }
  $('motion').addEventListener('click', () => {
    motion = !motion; applyMotion();
    try { localStorage.setItem('legedith-lab-motion',motion?'on':'off'); } catch { /* Storage can be blocked. */ }
  });
  preference.addEventListener('change', event => {
    if (event.matches) motion=false;
    applyMotion();
  });
  function beep(frequency) {
    if (!sound || !audio || audio.state !== 'running') return;
    const oscillator=audio.createOscillator(), volume=audio.createGain();
    oscillator.type='sine'; oscillator.frequency.setValueAtTime(frequency,audio.currentTime);
    volume.gain.setValueAtTime(.035,audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.1);
    oscillator.connect(volume); volume.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime+.11);
    oscillator.addEventListener('ended',()=>{oscillator.disconnect();volume.disconnect();},{once:true});
  }
  $('sound').addEventListener('click', async () => {
    if (sound) {
      sound=false; $('sound').textContent='Sound off'; $('sound').setAttribute('aria-pressed','false');
      if (audio?.state === 'running') await audio.suspend().catch(()=>{});
      return;
    }
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio unavailable');
      if (!audio) audio=new Audio();
      await audio.resume(); sound=true; $('sound').textContent='Sound on';
      $('sound').setAttribute('aria-pressed','true'); beep(520);
    } catch { sound=false; say('Sound is unavailable. Everything else still works.'); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPlayback();
    lab.classList.toggle('offscreen',document.hidden);
  });
  if ('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{
      const visible=entries[0].isIntersecting;
      lab.classList.toggle('offscreen',!visible);
      if (!visible) stopPlayback();
    });
    observer.observe(lab);
  }
  const projectData = Object.freeze({
    brushos:{title:'BrushOS',type:'01 / Embodied AI',hook:'Not text-to-image. Text-to-paper.',
      description:'A Gemini 3 agent, a Niryo arm, and a real brush. It plans strokes, paints, looks at the result, and decides what to change.',
      tech:'Python / Gemini 3 / Niryo',links:[['Watch the real robot','https://www.youtube.com/watch?v=bNbsj1z06Kk'],['Explore the code','https://github.com/Legedith/BrushOS-Robotic-painting-in-action']],
      caveat:'Physical prototype. The playground on this site is a separate simulation, not a live connection to BrushOS.'},
    dungeons:{title:'Dungeons',type:'02 / Creative tools',hook:'Learn the terminal. Play the dungeon.',
      description:'A text-based adventure for learning Linux commands. Explore a world by using the terminal, rather than reading another command cheat sheet.',
      tech:'Python / Linux / Game-based learning',links:[['Explore the code','https://github.com/Legedith/Dungeons']],
      caveat:'An earlier experiment in making unfamiliar tools feel approachable.'},
    space:{title:'Space ExploARtion',type:'03 / Augmented reality',hook:'A little space, in your space.',
      description:'An augmented-reality experiment that brings space exploration off the screen and into your surroundings.',
      tech:'Augmented reality / Creative coding',links:[['Explore the project','https://github.com/Legedith/Space-exploARtion'],['Hackathon archive','https://devpost.com/Legedith']],
      caveat:'An earlier AR exploration. The card illustration is decorative, not an app screenshot.'}
  });
  const dialogFocus = new WeakMap();
  function openDialog(dialog) {
    if (typeof dialog.showModal !== 'function') return false;
    stopPlayback(); dialogFocus.set(dialog,document.activeElement); dialog.showModal(); return true;
  }
  document.querySelectorAll('[data-about]').forEach(link=>link.addEventListener('click',event=>{
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (openDialog($('about-dialog'))) event.preventDefault();
  }));
  document.querySelectorAll('[data-project]').forEach(link=>link.addEventListener('click',event=>{
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const data=projectData[link.dataset.project]; if (!data) return;
    $('project-title').textContent=data.title; $('project-type').textContent=data.type;
    $('project-hook').textContent=data.hook; $('project-description').textContent=data.description;
    $('project-tech').textContent=data.tech; $('project-caveat').textContent=data.caveat;
    const links=data.links.map(([label,url],i)=>{
      const a=document.createElement('a'); a.href=url; a.textContent=`${label} ↗`;
      if (i===0) a.className='primary'; return a;
    });
    $('project-links').replaceChildren(...links);
    if (openDialog($('project-dialog'))) event.preventDefault();
  }));
  document.querySelectorAll('dialog').forEach(dialog=>{
    dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('keydown',event=>{
      if (event.key !== 'Tab') return;
      const focusable=Array.from(dialog.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')).filter(el=>el.getClientRects().length);
      const first=focusable[0],last=focusable[focusable.length-1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement===first || document.activeElement===dialog)) {
        event.preventDefault();last.focus();
      } else if (!event.shiftKey && document.activeElement===last) {
        event.preventDefault();first.focus();
      }
    });
    dialog.addEventListener('close',()=>{
      const previous=dialogFocus.get(dialog);if(previous?.isConnected) previous.focus({preventScroll:true});
    });
    dialog.addEventListener('click',event=>{
      if (event.target!==dialog) return;
      const r=dialog.getBoundingClientRect();
      if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close();
    });
  });
  zone.hidden=false; $('lab-controls').hidden=false; $('greet').hidden=false; $('preferences').hidden=false;
  $('year').textContent=String(new Date().getFullYear());
  pose(home); updateReady(); applyMotion();
})();
