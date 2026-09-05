/**
 * Seven spatial revolute joints; position-only differential IK.
 * Geometry is in metres, joint angles in radians. This is an illustrative
 * model, not a hardware controller. No dynamics or collision checking.
 * See METHODS.md for derivation, numerical limits, and references.
 */
export const add = (a,b) => a.map((v,i)=>v+b[i]);
export const sub = (a,b) => a.map((v,i)=>v-b[i]);
export const scale = (a,k) => a.map(v=>v*k);
export const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export const norm = a => Math.hypot(...a);
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit = a => scale(a,1/(norm(a)||1));
export const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const I = () => [[1,0,0],[0,1,0],[0,0,1]];
export const mv = (m,v) => m.map(r=>dot(r,v));
export const mm = (a,b) => a.map(r=>[0,1,2].map(j=>r.reduce((s,v,k)=>s+v*b[k][j],0)));
export function rotation(axis,angle) {
  const [x,y,z]=axis, c=Math.cos(angle),s=Math.sin(angle),t=1-c;
  return [[t*x*x+c,t*x*y-s*z,t*x*z+s*y],[t*x*y+s*z,t*y*y+c,t*y*z-s*x],[t*x*z-s*y,t*y*z+s*x,t*z*z+c]];
}
export const MODEL = Object.freeze({
  axes:[[0,0,1],[0,1,0],[1,0,0],[0,1,0],[1,0,0],[0,1,0],[0,0,1]],
  links:[[0,0,.16],[0,0,.38],[.04,0,.08],[0,0,.34],[0,0,.075],[0,0,.14],[.10,0,.04]],
  base:[0,0,.095],
  limits:[2.9,2.1,2.9,2.6,2.9,2.1,2.9]
});
export const HOME = [-.35,.35,.45,1.5,-.65,-.7,.25];
export const REACH_BOUND = MODEL.links.reduce((n,p)=>n+norm(p),0);
export function validVector(v,length,name='vector') {
  if (!Array.isArray(v)||v.length!==length||!v.every(Number.isFinite)) throw new TypeError(`${name} must contain ${length} finite numbers`);
}
export function forward(q) {
  validVector(q,7,'q');
  let p=MODEL.base.slice(),R=I();
  const points=[p], axes=[], frames=[];
  for(let i=0;i<7;i++) {
    axes.push(mv(R,MODEL.axes[i]));
    R=mm(R,rotation(MODEL.axes[i],q[i]));
    frames.push(R);
    p=add(p,mv(R,MODEL.links[i])); points.push(p);
  }
  return {points,axes,frames,tip:p,rotation:R};
}
export function jacobian(fk) {
  const columns=fk.axes.map((axis,i)=>cross(axis,sub(fk.tip,fk.points[i])));
  return [0,1,2].map(i=>columns.map(c=>c[i]));
}
export const gram = J => J.map(a=>J.map(b=>dot(a,b)));
/** Pivoted Gaussian elimination; returns null rather than fabricating a solution. */
export function linear3(A,b) {
  const m=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<3;c++) {
    let p=c;
    for(let r=c+1;r<3;r++)if(Math.abs(m[r][c])>Math.abs(m[p][c]))p=r;
    if(Math.abs(m[p][c])<1e-15)return null;
    [m[c],m[p]]=[m[p],m[c]];
    const d=m[c][c];for(let j=c;j<4;j++)m[c][j]/=d;
    for(let r=0;r<3;r++)if(r!==c){const f=m[r][c];for(let j=c;j<4;j++)m[r][j]-=f*m[c][j];}
  }
  return m.map(r=>r[3]);
}
/** Reorthogonalized row basis gives the exact (up to roundoff) null projection.
 * A damped inverse is deliberately NOT used for this projector: I-J#J would
 * leak task-space velocity when J# is damped.
 */
export function rowBasis(J,tolerance=1e-9) {
  const basis=[];
  for(const row of J) {
    let v=row.slice();
    for(let pass=0;pass<2;pass++)for(const r of basis)v=sub(v,scale(r,dot(v,r)));
    if(norm(v)>tolerance)basis.push(unit(v));
  }
  return basis;
}
export function nullProject(J,z) {
  let v=z.slice();
  for(const r of rowBasis(J))v=sub(v,scale(r,dot(v,r)));
  return v;
}
export function spectral(J) {
  // Jacobi eigenvalue rotations of the symmetric 3x3 Gram matrix.
  let A=gram(J),V=I();
  for(let k=0;k<24;k++) {
    let p=0,q=1;
    for(const [i,j] of [[0,2],[1,2]])if(Math.abs(A[i][j])>Math.abs(A[p][q]))[p,q]=[i,j];
    if(Math.abs(A[p][q])<1e-13)break;
    const a=.5*Math.atan2(2*A[p][q],A[q][q]-A[p][p]),c=Math.cos(a),s=Math.sin(a);
    const T=I();T[p][p]=c;T[q][q]=c;T[p][q]=s;T[q][p]=-s;
    const TT=T[0].map((_,i)=>T.map(r=>r[i]));
    A=mm(mm(TT,A),T);V=mm(V,T);
  }
  const data=[0,1,2].map(i=>({sigma:Math.sqrt(Math.max(0,A[i][i])),axis:V.map(r=>r[i])})).sort((a,b)=>b.sigma-a.sigma);
  return {values:data.map(d=>d.sigma),axes:data.map(d=>d.axis),rank:data.filter(d=>d.sigma>1e-7).length};
}
export function solve(seed,target,{iterations=40,damping=.012,tolerance=1e-6,maxStep=.14}={}) {
  validVector(seed,7,'seed');validVector(target,3,'target');
  if(!Number.isFinite(damping)||damping<0)throw new RangeError('Damping must be finite and nonnegative');
  let q=seed.map((v,i)=>clamp(v,-MODEL.limits[i],MODEL.limits[i])), fk=forward(q),error=norm(sub(target,fk.tip)),count=0;
  const lambda=Math.max(damping,1e-5);
  for(;count<Math.min(200,Math.max(0,iterations));count++) {
    if(error<tolerance)break;
    const J=jacobian(fk),A=gram(J);for(let i=0;i<3;i++)A[i][i]+=lambda*lambda;
    let e=sub(target,fk.tip);if(norm(e)>.1)e=scale(e,.1/norm(e));
    const v=linear3(A,e);if(!v)break;
    let dq=q.map((_,i)=>J.reduce((s,row,j)=>s+row[i]*v[j],0));
    const largest=Math.max(...dq.map(Math.abs));if(largest>maxStep)dq=scale(dq,maxStep/largest);
    // Backtracking preserves descent even when joint limits clip a step.
    let accepted=false;
    for(let t=1;t>=1/64;t/=2) {
      const next=q.map((v,i)=>clamp(v+t*dq[i],-MODEL.limits[i],MODEL.limits[i]));
      const candidate=forward(next),residual=norm(sub(target,candidate.tip));
      if(residual<error-1e-13) {q=next;fk=candidate;error=residual;accepted=true;break;}
    }
    if(!accepted)break;
  }
  return {q,fk,error,iterations:count,converged:error<tolerance,outsideBound:norm(sub(target,MODEL.base))>REACH_BOUND};
}
export function nullStep(q,target,phase,amount=.025,damping=.012) {
  const J=jacobian(forward(q));
  const reference=HOME.map((v,i)=>v+[1.15,.48,1.3,.45,1.2,.5,1.3][i]*Math.sin(phase+[0,.9,2.1,.4,3.0,1.1,2.8][i]));
  const desired=q.map((v,i)=>2*(reference[i]-v)-.08*Math.pow(v/MODEL.limits[i],7));
  let direction=nullProject(J,desired);
  const length=norm(direction);if(length>1)direction=scale(direction,1/length);
  for(let step=amount;step>=amount/8;step/=2) {
    const candidate=q.map((v,i)=>clamp(v+step*direction[i],-MODEL.limits[i],MODEL.limits[i]));
    const result=solve(candidate,target,{iterations:20,damping,tolerance:1e-7,maxStep:.06});
    if(result.error<2e-5)return {...result,accepted:true};
  }
  const fk=forward(q);return {q:q.slice(),fk,error:norm(sub(target,fk.tip)),iterations:0,accepted:false};
}
export function trajectory(t) {
  // Spatial trefoil; not a prerecorded joint animation. IK is solved at each sample.
  return [.53+.075*(Math.sin(t)+2*Math.sin(2*t)),
          -.06+.075*(Math.cos(t)-2*Math.cos(2*t)),
          .66+.10*Math.sin(3*t)];
}
