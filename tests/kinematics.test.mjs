import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME,MODEL,forward,jacobian,solve,nullStep,nullProject,trajectory,spectral,gram,mv,norm,sub,dot} from '../assets/kinematics.js';
let randomState=149;
const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const legal=q=>q.every((v,i)=>Number.isFinite(v)&&Math.abs(v)<=MODEL.limits[i]+1e-9);

test('Forward kinematics preserves all seven link lengths in 100 configurations',()=>{
 for(let n=0;n<100;n++){
  const q=MODEL.limits.map(l=>(random()*2-1)*l),f=forward(q);
  assert.equal(f.points.length,8);assert.equal(f.axes.length,7);
  for(let i=0;i<7;i++){close(norm(sub(f.points[i+1],f.points[i])),norm(MODEL.links[i]));close(norm(f.axes[i]),1);}
 }
});
test('Analytic 3x7 Jacobian agrees with central finite differences',()=>{
 for(let n=0;n<40;n++){
  const q=HOME.map(v=>v+(random()-.5)*1.2),J=jacobian(forward(q)),h=1e-6;
  for(let j=0;j<7;j++){
   const a=q.slice(),b=q.slice();a[j]+=h;b[j]-=h;
   const diff=sub(forward(a).tip,forward(b).tip).map(v=>v/(2*h));
   for(let k=0;k<3;k++)close(J[k][j],diff[k],2e-8);
  }
 }
});
test('Damped IK converges for 80 reachable, warm-started targets',()=>{
 for(let n=0;n<80;n++){
  const goal=HOME.map((v,i)=>Math.max(-MODEL.limits[i]+.15,Math.min(MODEL.limits[i]-.15,v+(random()-.5)*1.5)));
  const seed=goal.map(v=>v+(random()-.5)*.35),target=forward(goal).tip;
  const r=solve(seed,target,{iterations:100,tolerance:1e-7});
  assert.ok(r.error<1e-6,`Fixture ${n}: residual ${r.error}`);assert.ok(legal(r.q));
 }
});
test('Projected null velocities produce negligible instantaneous tip velocity',()=>{
 for(let n=0;n<60;n++){
  const q=HOME.map(v=>v+(random()-.5)),J=jacobian(forward(q)),v=nullProject(J,q.map(()=>random()-.5));
  assert.ok(norm(J.map(row=>dot(row,v)))<1e-10);
 }
});
test('Null-space motion changes posture and holds a fixed tool point over 1,200 steps',()=>{
 let q=HOME.slice();const target=forward(q).tip;let maxError=0;
 for(let i=0;i<1200;i++){
  const r=nullStep(q,target,i*.01,.025);q=r.q;maxError=Math.max(maxError,r.error);assert.ok(legal(q));
 }
 assert.ok(norm(sub(q,HOME))>.3);assert.ok(maxError<2e-5,`Null error ${maxError}`);
 console.log(`null-space: maximum finite-step error ${(maxError*1000).toFixed(6)} mm`);
});
test('Trefoil tracking solves new 3D positions over two complete loops',()=>{
 let q=HOME.slice(),maxError=0;
 for(let i=0;i<1200;i++){
  const r=solve(q,trajectory(i/600*Math.PI*2),{iterations:25,tolerance:1e-7});q=r.q;maxError=Math.max(maxError,r.error);assert.ok(legal(q));
 }
 assert.ok(maxError<1e-5,`Trajectory residual ${maxError}`);
 console.log(`trefoil: maximum sampled error ${(maxError*1000).toFixed(6)} mm`);
});
test('Jacobi eigensystem has orthonormal axes and satisfies the Gram eigenproblem',()=>{
 for(let n=0;n<25;n++){
  const q=HOME.map(v=>v+(random()-.5)),J=jacobian(forward(q)),A=gram(J),s=spectral(J);
  assert.equal(s.rank,3);
  for(let i=0;i<3;i++){
   close(norm(s.axes[i]),1);
   const residual=sub(mv(A,s.axes[i]),s.axes[i].map(v=>v*s.values[i]**2));
   assert.ok(norm(residual)<1e-8);
   for(let j=i+1;j<3;j++)close(dot(s.axes[i],s.axes[j]),0);
  }
 }
});
test('Unreachable targets retain a nonzero residual without breaking limits',()=>{
 for(const target of [[8,8,8],[-8,-8,-8],[0,0,5]]){
  const r=solve(HOME,target,{iterations:100});assert.ok(r.outsideBound);assert.ok(!r.converged);assert.ok(r.error>1);assert.ok(legal(r.q));
 }
});
test('Rank-deficient and zero Jacobians remain numerically finite',()=>{
 assert.equal(spectral([[1,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]).rank,1);
 assert.deepEqual(nullProject(Array.from({length:3},()=>Array(7).fill(0)),HOME),HOME);
 const r=solve(Array(7).fill(0),[0,0,.4],{iterations:100});assert.ok(legal(r.q));assert.ok(Number.isFinite(r.error));
});
test('Invalid inputs fail clearly rather than propagating NaNs',()=>{
 assert.throws(()=>forward([1,2]),TypeError);
 assert.throws(()=>solve(HOME,[NaN,0,0]),TypeError);
 assert.throws(()=>solve(HOME,[0,0,0],{damping:-1}),RangeError);
});
