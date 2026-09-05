import {HOME,MODEL,forward,jacobian,spectral,solve,nullStep,trajectory,norm,sub,clamp} from './kinematics.js';
import {Renderer} from './renderer.js';
const $=id=>document.getElementById(id);
try {
  const canvas=$('scene'),viewport=$('viewport'),handle=$('target-handle');
  const renderer=new Renderer(canvas),media=matchMedia('(prefers-reduced-motion: reduce)');
  let motion=!media.matches;
  try{if(localStorage.getItem('legedith-study-motion')==='off')motion=false;}catch{/* Storage is optional. */}
  const state={q:HOME.slice(),target:forward(HOME).tip.slice(),mode:'reach',phase:0,playing:false,
    damping:.012,error:0,rank:3,ratio:0,axes:false,ellipsoid:false,ghosts:[],trail:[],path:[],
    iterations:0,frames:0,stepBudget:0,stalled:false};
  let visible=true,frame=null,lastTime=0,lastTelemetry=0,pointer=null,dragStart=null,orbitPointer=null;
  let lastGhost=0,oldFocus=null;
  const sceneTop=()=>innerWidth<=650?75:0;
  const announce=text=>{$('status').textContent=text;};
  const finiteTarget=p=>[clamp(p[0],-.9,1.05),clamp(p[1],-.6,.6),clamp(p[2],.12,1.22)];
  const formatNumber=n=>`${n<0?'−':''}${Math.abs(n).toFixed(0)}`;
  function schedule() {
    if(frame===null&&visible&&!document.hidden&&!$('method-dialog').open)frame=requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    state.playing=Boolean(on&&motion&&state.mode!=='reach');
    $('play').textContent=state.playing?'Pause':'Run';
    $('play').setAttribute('aria-pressed',String(state.playing));
    $('play').disabled=!motion;
    lastTime=0;schedule();
  }
  function parameterUI() {
    const p=$('parameter');
    if(state.mode==='reach') {
      $('parameter-label').innerHTML='Target depth <span>y</span>';
      p.min='-600';p.max='600';p.step='5';p.value=String(Math.round(state.target[1]*1000));
      p.setAttribute('aria-label','Target depth in millimetres');
      $('parameter-value').textContent=`${formatNumber(state.target[1]*1000)} mm`;
    } else {
      $('parameter-label').textContent=state.mode==='null'?'Posture bias':'Curve position';
      p.min='0';p.max='1000';p.step='1';p.value=String(Math.round(((state.phase%(2*Math.PI))+2*Math.PI)%(2*Math.PI)/(2*Math.PI)*1000));
      p.setAttribute('aria-label',state.mode==='null'?'Posture bias phase':'Position along the spatial curve');
      $('parameter-value').textContent=`${Math.round(Number(p.value)/10)} %`;
    }
  }
  function changeMode(mode) {
    state.mode=mode;state.phase=0;state.ghosts=[];state.trail=[];state.path=[];state.stalled=false;
    document.querySelectorAll('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    handle.disabled=mode!=='reach';$('play').hidden=mode==='reach';
    if(mode==='reach') {
      $('observation').innerHTML='Choose a point.<br>The arm finds a way.';
      $('figure-caption').textContent='Seven joints. One tool point. More than one way to get there.';
      announce('Reach mode. Drag the target, or focus it and use the arrow keys.');
    } else if(mode==='null') {
      // Lock the actual achieved point, including after an unreachable reach request.
      state.target=forward(state.q).tip.slice();state.ghosts=[state.q.slice()];
      $('observation').innerHTML='The point stays.<br>The arm changes.';
      $('figure-caption').textContent='Watch the arm reconfigure while the tool point stays nearly fixed.';
      announce('The achieved tool point is now locked. Exploring internal joint motion.');
    } else {
      state.path=Array.from({length:241},(_,i)=>trajectory(i*Math.PI/120));state.target=trajectory(0);
      $('observation').innerHTML='One curve.<br>Seven moving joints.';
      $('figure-caption').textContent='A spatial trefoil, traced by solving inverse kinematics at every step.';
      announce('Following a three-dimensional trefoil. Use the slider to inspect individual points.');
    }
    state.stepBudget=100;parameterUI();setPlaying(mode!=='reach');
    if(!motion)settle();schedule();
  }
  function telemetry() {
    const fk=forward(state.q),s=spectral(jacobian(fk));
    state.error=norm(sub(state.target,fk.tip));state.rank=s.rank;state.ratio=s.values[2]/Math.max(s.values[0],1e-12);
    const mm=state.error*1000;
    $('error').textContent=mm<.001?'< 0.001 mm':`${mm.toFixed(mm<10?3:1)} mm`;
    $('freedom').textContent=String(7-s.rank);$('condition').textContent=state.ratio.toFixed(3);
    let text='Converged';let warn=false;
    if(state.error>.0005){text=state.stalled?'Residual remains':'Solving';warn=true;}
    else if(state.playing)text=state.mode==='null'?'Tip held':'Tracking';
    else if(state.mode!=='reach')text=motion?'Paused':'Manual';
    if(state.ratio<.01){text='Near singular';warn=true;}
    $('solver-state').textContent=text;$('solver-state').dataset.warning=String(warn);
    viewport.dataset.mode=state.mode;viewport.dataset.running=String(state.playing);
    viewport.dataset.error=String(state.error);
  }
  function render() {
    const result=renderer.draw(state),[x,y]=result.target;
    handle.style.left=`${x}px`;handle.style.top=`${y+sceneTop()}px`;
    handle.classList.toggle('off-canvas',x<24||x>renderer.w-24||y<24||y>renderer.h-24);
    // Keep an off-screen keyboard target reachable, but don't misplace its drawn marker.
    if(x<24||x>renderer.w-24||y<24||y>renderer.h-24) {
      handle.style.left=`${clamp(x,24,renderer.w-24)}px`;
      handle.style.top=`${clamp(y,24,renderer.h-24)+sceneTop()}px`;
      handle.querySelector('span').textContent='Target off view';
    } else handle.querySelector('span').textContent='Drag the target';
  }
  function settle() {
    const r=solve(state.q,state.target,{iterations:100,damping:state.damping,tolerance:1e-7});
    state.q=r.q;state.error=r.error;state.iterations+=r.iterations;
    state.stalled=!r.converged;state.stepBudget=0;
  }
  function tick(now) {
    frame=null;if(!visible||document.hidden||$('method-dialog').open){lastTime=0;return;}
    const dt=lastTime?Math.min((now-lastTime)/1000,.045):1/60;lastTime=now;
    let keepGoing=false;
    if(state.playing) {
      state.phase+=dt*(state.mode==='null'?.4:.45);
      if(state.mode==='null') {
        const r=nullStep(state.q,state.target,state.phase,dt*.8,state.damping);
        state.q=r.q;state.iterations+=r.iterations;state.stalled=!r.accepted;
        if(now-lastGhost>340){state.ghosts.push(state.q.slice());if(state.ghosts.length>12)state.ghosts.shift();lastGhost=now;}
      } else {
        state.target=trajectory(state.phase);
        const r=solve(state.q,state.target,{iterations:12,damping:state.damping,tolerance:1e-7});state.q=r.q;state.iterations+=r.iterations;
        const tip=r.fk.tip;
        if(!state.trail.length||norm(sub(tip,state.trail.at(-1)))>.002){state.trail.push(tip.slice());if(state.trail.length>450)state.trail.shift();}
      }
      keepGoing=true;
    } else if(state.stepBudget>0) {
      const before=norm(sub(forward(state.q).tip,state.target));
      const r=solve(state.q,state.target,{iterations:motion?5:100,damping:state.damping,tolerance:1e-7});
      state.q=r.q;state.iterations+=r.iterations;state.stepBudget--;
      if(r.error<1e-6||Math.abs(before-r.error)<1e-12||state.stepBudget<=0){state.stepBudget=0;state.stalled=r.error>5e-4;}
      keepGoing=state.stepBudget>0;
    }
    state.frames++;render();
    if(now-lastTelemetry>110||!keepGoing){telemetry();if(state.playing)parameterUI();lastTelemetry=now;}
    if(keepGoing)schedule();else lastTime=0;
  }
  function moveTarget(p) {
    state.target=finiteTarget(p);state.stepBudget=100;state.stalled=false;
    if(!motion)settle();parameterUI();schedule();
  }
  document.querySelectorAll('button[data-mode]').forEach(b=>b.addEventListener('click',()=>changeMode(b.dataset.mode)));
  handle.addEventListener('pointerdown',e=>{
    if(pointer!==null||state.mode!=='reach'||e.button!==0)return;
    e.preventDefault();pointer=e.pointerId;handle.setPointerCapture(pointer);handle.focus({preventScroll:true});
    viewport.classList.add('is-dragging');const r=canvas.getBoundingClientRect();
    const start=renderer.project(state.target);dragStart={x:e.clientX-r.left-start[0],y:e.clientY-r.top-start[1]};
  });
  handle.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointer)return;e.preventDefault();const r=canvas.getBoundingClientRect();
    moveTarget(renderer.unproject(e.clientX-r.left-dragStart.x,e.clientY-r.top-dragStart.y,state.target[1]));
  });
  function release(e) {
    if(e.pointerId!==pointer)return;const id=pointer;pointer=null;dragStart=null;
    if(handle.hasPointerCapture(id))handle.releasePointerCapture(id);viewport.classList.remove('is-dragging');
    announce('Target updated. The readout shows the measured position error.');
  }
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>handle.addEventListener(type,release));
  handle.addEventListener('keydown',e=>{
    const step=e.shiftKey?.05:.01;
    const offsets={ArrowLeft:[-step,0,0],ArrowRight:[step,0,0],ArrowUp:[0,0,step],ArrowDown:[0,0,-step],PageUp:[0,step,0],PageDown:[0,-step,0]};
    if(offsets[e.key]){e.preventDefault();moveTarget(state.target.map((v,i)=>v+offsets[e.key][i]));}
    if(e.key==='Escape')handle.blur();
  });
  // Mouse background drag rotates the camera; touch background keeps native scrolling.
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='mouse'||e.button!==0)return;
    orbitPointer={id:e.pointerId,x:e.clientX,yaw:renderer.yaw};canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!orbitPointer||orbitPointer.id!==e.pointerId)return;
    renderer.yaw=clamp(orbitPointer.yaw+(e.clientX-orbitPointer.x)*.004,-1.05,1.05);schedule();
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,e=>{
    if(orbitPointer?.id===e.pointerId){const id=orbitPointer.id;orbitPointer=null;if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
  }));
  $('parameter').addEventListener('input',e=>{
    const value=Number(e.target.value);
    if(state.mode==='reach')moveTarget([state.target[0],value/1000,state.target[2]]);
    else {
      setPlaying(false);state.phase=value/1000*Math.PI*2;
      if(state.mode==='null') {
        // Manual scrubbing is finite optimization, not an animation. Keeps target fixed.
        if(!state.ghosts.length)state.ghosts.push(state.q.slice());
        for(let i=0;i<24;i++)state.q=nullStep(state.q,state.target,state.phase,.035,state.damping).q;
        state.ghosts.push(state.q.slice());if(state.ghosts.length>12)state.ghosts.shift();
      } else {state.target=trajectory(state.phase);settle();state.trail=[];}
      parameterUI();telemetry();schedule();
    }
  });
  $('play').addEventListener('click',()=>{setPlaying(!state.playing);announce(state.playing?'Experiment running.':'Experiment paused.');});
  $('reset').addEventListener('click',()=>{
    state.q=HOME.slice();state.target=forward(HOME).tip.slice();renderer.yaw=-.45;
    state.iterations=0;changeMode('reach');announce('Initial pose and target restored.');
  });
  for(const [id,key] of [['axes','axes'],['ellipsoid','ellipsoid']])$(id).addEventListener('click',()=>{
    state[key]=!state[key];$(id).setAttribute('aria-pressed',String(state[key]));schedule();
    if(key==='ellipsoid')announce(state[key]?'Velocity dexterity ellipsoid shown. This is not the reachable workspace.':'Dexterity overlay hidden.');
  });
  for(const [id,sign] of [['orbit-left',-1],['orbit-right',1]])$(id).addEventListener('click',()=>{
    renderer.yaw=clamp(renderer.yaw+sign*.23,-1.05,1.05);schedule();
  });
  function applyMotion() {
    document.documentElement.dataset.motion=motion?'on':'off';
    $('motion').textContent=motion?'Motion on':'Motion off';$('motion').setAttribute('aria-pressed',String(motion));
    $('motion').disabled=media.matches;$('motion').title=media.matches?'Your system requests reduced motion.':'Toggle automatic experiment motion';
    if(!motion){setPlaying(false);settle();}
    $('play').disabled=!motion;schedule();
  }
  $('motion').addEventListener('click',()=>{
    motion=!motion;applyMotion();try{localStorage.setItem('legedith-study-motion',motion?'on':'off');}catch{/* Private storage is not required. */}
  });
  media.addEventListener('change',e=>{if(e.matches)motion=false;applyMotion();});
  $('damping').addEventListener('input',e=>{state.damping=Number(e.target.value)/1000;$('damping-value').textContent=state.damping.toFixed(3);state.stepBudget=100;});
  const dialog=$('method-dialog');
  $('method-link').addEventListener('click',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||typeof dialog.showModal!=='function')return;
    e.preventDefault();oldFocus=document.activeElement;setPlaying(false);dialog.showModal();
  });
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{oldFocus?.focus({preventScroll:true});lastTime=0;schedule();});
  dialog.addEventListener('click',e=>{
    if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
  });
  dialog.addEventListener('keydown',e=>{
    if(e.key!=='Tab')return;
    const items=[...dialog.querySelectorAll('a[href],button:not([disabled]),summary,input:not([disabled])')].filter(el=>el.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
  function size() {const r=viewport.getBoundingClientRect();renderer.resize(r.width,r.height-sceneTop());schedule();}
  const observer=new ResizeObserver(size);observer.observe(viewport);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;
    if(!visible){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=0;}
    else schedule();
  },{rootMargin:'100px'}).observe(viewport);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastTime=0;}else schedule();
  });
  // Read-only diagnostic snapshots support independent tests without exposing a control API.
  Object.defineProperty(window,'kinematicStudy',{value:Object.freeze({version:'1.0.0',snapshot:()=>({
    q:state.q.slice(),target:state.target.slice(),tip:forward(state.q).tip.slice(),error:norm(sub(state.target,forward(state.q).tip)),
    mode:state.mode,playing:state.playing,rank:state.rank,frames:state.frames,iterations:state.iterations,
    ghosts:state.ghosts.length,trail:state.trail.length,motion,damping:state.damping,cameraYaw:renderer.yaw
  })}),writable:false});
  for(const id of ['scene','experiment-menu','target-handle','scene-tools','instrument','readout','motion'])$(id).hidden=false;
  $('fallback').setAttribute('hidden','');$('year').textContent=String(new Date().getFullYear());
  size();parameterUI();applyMotion();telemetry();render();viewport.dataset.ready='true';
} catch(error) {
  console.error('Kinematic study failed:',error);
  $('load-error').hidden=false;$('fallback').removeAttribute('hidden');$('scene').hidden=true;
  for(const id of ['experiment-menu','target-handle','scene-tools','instrument','readout'])$(id).hidden=true;
}
