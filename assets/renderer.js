/** Dependency-free orthographic 3D renderer. Actual FK geometry, not keyframes.
 * Canvas 2D + depth-sorted shaded polygons keeps the experiment usable without
 * WebGL, downloaded models, fonts, or a third-party runtime. */
import {add,sub,scale,dot,cross,unit,norm,mv,clamp,forward,spectral,jacobian} from './kinematics.js';
const PAPER='#f4f3ee',INK='#272a2a',ACCENT='#9a482f';
const rgb=(a,f)=>`rgb(${a.map(v=>Math.round(clamp(v*f,0,255))).join(',')})`;
export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    if(!this.ctx)throw new Error('Canvas 2D is unavailable');
    this.yaw=-.45;this.pitch=.40;this.w=1;this.h=1;this.faces=[];
    this.light=unit([-.4,-.65,1]);this.configure();
  }
  resize(w,h) {
    this.w=w;this.h=h;const dpr=Math.min(window.devicePixelRatio||1,2);
    this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);this.configure();
  }
  configure() {
    const {yaw:a,pitch:b}=this;
    this.right=[Math.cos(a),Math.sin(a),0];
    this.up=[-Math.sin(a)*Math.sin(b),Math.cos(a)*Math.sin(b),Math.cos(b)];
    this.view=cross(this.right,this.up);
    this.center=[this.w<700?.36:.33,-.02,.40];
    this.s=Math.min(this.w<700?this.w*.90:this.w*.72,this.h*1.05);
    this.ox=this.w<700?this.w*.50:this.w*.60;
    this.oy=this.h*.50;
  }
  project(p) {const v=sub(p,this.center);return [this.ox+dot(this.right,v)*this.s,this.oy-dot(this.up,v)*this.s,dot(this.view,v)];}
  unproject(x,y,depth) {
    const u=(x-this.ox)/this.s+dot(this.right,this.center);
    const v=-(y-this.oy)/this.s+dot(this.up,this.center);
    const px=(u-this.right[1]*depth)/this.right[0];
    return [px,depth,(v-this.up[0]*px-this.up[1]*depth)/this.up[2]];
  }
  line(points,color,width=1,dash=[]) {
    if(points.length<2)return;
    const c=this.ctx;c.beginPath();c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);
    points.forEach((p,i)=>{const [x,y]=this.project(p);if(i===0)c.moveTo(x,y);else c.lineTo(x,y);});c.stroke();c.setLineDash([]);
  }
  label(text,p,dx=0,dy=0,color='#757a75') {
    const [x,y]=this.project(p),c=this.ctx;c.fillStyle=color;c.font='9px "Courier New",monospace';c.fillText(text,x+dx,y+dy);
  }
  face(vertices,normal,color) {
    if(dot(normal,this.view)<-.02)return;
    const depth=vertices.reduce((n,p)=>n+dot(p,this.view),0)/vertices.length;
    const shade=.60+.30*Math.max(0,dot(normal,this.light))+.10*Math.pow(Math.max(0,dot(normal,unit(add(this.light,this.view)))),12);
    this.faces.push({vertices,depth,fill:rgb(color,shade)});
  }
  cylinder(a,b,ra,rb,color=[240,240,229],segments=16) {
    const axis=unit(sub(b,a));if(norm(sub(b,a))<1e-8)return;
    const u=unit(cross(axis,Math.abs(axis[2])>.9?[1,0,0]:[0,0,1])),v=cross(axis,u);
    const ring=(p,r)=>Array.from({length:segments},(_,i)=>add(p,add(scale(u,r*Math.cos(i*2*Math.PI/segments)),scale(v,r*Math.sin(i*2*Math.PI/segments)))));
    const A=ring(a,ra),B=ring(b,rb);
    this.face(A.slice().reverse(),scale(axis,-1),color);this.face(B,axis,color);
    for(let i=0;i<segments;i++) {
      const j=(i+1)%segments;
      const n=unit(add(scale(u,Math.cos((i+.5)*2*Math.PI/segments)),scale(v,Math.sin((i+.5)*2*Math.PI/segments))));
      this.face([A[i],A[j],B[j],B[i]],n,color);
    }
  }
  mesh(fk) {
    const p=fk.points;
    this.cylinder([0,0,.002],[0,0,.033],.135,.135,[179,184,177],24);
    this.cylinder([0,0,.033],[0,0,.065],.112,.10,[222,225,216],24);
    this.cylinder([0,0,.065],p[0],.082,.075,[96,104,104],24);
    for(let i=0;i<7;i++) {
      const start=p[i],end=p[i+1],axis=fk.axes[i],radius=.069-i*.004;
      const direction=unit(sub(end,start)),length=norm(sub(end,start));
      const a=add(start,scale(direction,Math.min(.035,length*.18))),b=add(end,scale(direction,-Math.min(.035,length*.18)));
      this.cylinder(a,b,radius*.72,radius*.57,[241,243,234]);
      // Machined joint drums, graphite bearing rings, pale end plates.
      const extent=.045-i*.003;
      this.cylinder(add(start,scale(axis,-extent)),add(start,scale(axis,extent)),radius,radius,[55,63,64],20);
      this.cylinder(add(start,scale(axis,extent)),add(start,scale(axis,extent+.012)),radius*.97,radius*.86,[220,224,216],20);
      this.cylinder(add(start,scale(axis,-extent-.012)),add(start,scale(axis,-extent)),radius*.86,radius*.97,[220,224,216],20);
      this.cylinder(add(start,scale(axis,extent+.012)),add(start,scale(axis,extent+.014)),radius*.53,radius*.53,[129,137,132],20);
      this.cylinder(add(start,scale(axis,extent+.014)),add(start,scale(axis,extent+.016)),radius*.18,radius*.18,[61,69,70],12);
      if(length>.2) {
        // Dark mechanical seam along each major arm link.
        const offset=scale(unit(cross(direction,axis)),radius*.50);
        this.cylinder(add(a,offset),add(b,offset),.007,.005,[95,103,102],8);
      }
    }
    // Open parallel gripper; the target marks its grasp centre, not a fictitious face.
    const t=fk.tip, R=fk.rotation,side=mv(R,[0,1,0]),back=mv(R,[-1,0,0]);
    const wrist=add(t,scale(back,.04));
    this.cylinder(add(wrist,scale(side,-.037)),add(wrist,scale(side,.037)),.018,.018,[70,80,79],12);
    for(const sign of [-1,1]) {
      const a=add(wrist,scale(side,sign*.035)),b=add(t,scale(side,sign*.035));
      this.cylinder(a,b,.009,.006,[160,168,159],8);
      this.cylinder(b,add(b,scale(side,-sign*.018)),.006,.006,[59,67,65],8);
    }
  }
  draw({q,target,ghosts=[],trail=[],path=[],axes=false,ellipsoid=false,mode='reach'}) {
    this.configure();const c=this.ctx,w=this.w,h=this.h,fk=forward(q);
    c.fillStyle=PAPER;c.fillRect(0,0,w,h);
    c.save();c.beginPath();c.rect(0,0,w,h);c.clip();
    // A survey grid: fine, bounded, and not an animated particle backdrop.
    for(let i=-8;i<=10;i++) {
      const n=i*.1;
      this.line([[-.45,n,0],[1.12,n,0]],i===0?'#c4c9bf':'#dfE2d9',i===0?.8:.45);
      this.line([[n,-.7,0],[n,.7,0]],i===0?'#c4c9bf':'#dfe2d9',i===0?.8:.45);
    }
    // Soft projected contact shadows, purely a rendering effect.
    for(let i=0;i<7;i++) {
      const a=fk.points[i].slice(),b=fk.points[i+1].slice();a[2]=.001;b[2]=.001;
      c.save();c.globalAlpha=.05;c.shadowColor='#253328';c.shadowBlur=14;
      this.line([a,b],'#2d352f',12);c.restore();
    }
    if(path.length)this.line(path,'#b7c2bf',1,[2,4]);
    if(trail.length)this.line(trail,ACCENT,1.5);
    if(mode==='null')ghosts.forEach((g,i)=>{
      const f=forward(g),alpha=.08+.10*(i+1)/ghosts.length;
      this.line(f.points,`rgba(78,103,111,${alpha})`,1);
      for(const p of f.points){const [x,y]=this.project(p);c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.strokeStyle=`rgba(78,103,111,${alpha})`;c.lineWidth=.7;c.stroke();}
    });
    // Fixed target projected onto the ground: the dotted line isn't the arm.
    this.line([[target[0],target[1],.004],target],'#a4afa2',.7,[2,5]);
    const floor=this.project([target[0],target[1],0]);c.strokeStyle='#a4afa2';c.lineWidth=.7;c.beginPath();c.moveTo(floor[0]-4,floor[1]);c.lineTo(floor[0]+4,floor[1]);c.moveTo(floor[0],floor[1]-4);c.lineTo(floor[0],floor[1]+4);c.stroke();
    this.faces=[];this.mesh(fk);this.faces.sort((a,b)=>a.depth-b.depth);
    for(const f of this.faces) {
      c.beginPath();f.vertices.forEach((p,i)=>{const [x,y]=this.project(p);if(!i)c.moveTo(x,y);else c.lineTo(x,y);});c.closePath();
      c.fillStyle=f.fill;c.fill();c.strokeStyle=f.fill;c.lineWidth=.45;c.stroke();
    }
    if(axes)for(let i=0;i<7;i++) {
      const p=fk.points[i],a=fk.axes[i];this.line([add(p,scale(a,-.09)),add(p,scale(a,.11))],'#657e86',.9,[3,3]);
      this.label(`q${i+1}`,add(p,scale(a,.13)),3,-3,'#48616b');
    }
    if(ellipsoid) {
      const spec=spectral(jacobian(fk)),factor=.16;
      for(const [a,b] of [[0,1],[1,2],[0,2]]) {
        const pts=Array.from({length:65},(_,i)=>add(fk.tip,add(scale(spec.axes[a],factor*spec.values[a]*Math.cos(i*Math.PI/32)),scale(spec.axes[b],factor*spec.values[b]*Math.sin(i*Math.PI/32)))));
        this.line(pts,'#83989c',.8);
      }
    }
    const end=this.project(fk.tip),goal=this.project(target);
    if(norm(sub(fk.tip,target))>.002)this.line([fk.tip,target],ACCENT,.9,[3,4]);
    c.beginPath();c.arc(end[0],end[1],2.7,0,Math.PI*2);c.fillStyle=INK;c.fill();
    // Crosshair remains useful in screenshots and in the static fallback.
    c.strokeStyle=ACCENT;c.lineWidth=1;c.beginPath();c.arc(goal[0],goal[1],8,0,Math.PI*2);c.moveTo(goal[0]-14,goal[1]);c.lineTo(goal[0]-6,goal[1]);c.moveTo(goal[0]+6,goal[1]);c.lineTo(goal[0]+14,goal[1]);c.moveTo(goal[0],goal[1]-14);c.lineTo(goal[0],goal[1]-6);c.moveTo(goal[0],goal[1]+6);c.lineTo(goal[0],goal[1]+14);c.stroke();
    if(w>600) {
      this.label('BASE / {0}',[0,0,.03],-70,29);
      this.label(mode==='null'?'x*  FIXED':'x*  TARGET',target,22,-16,ACCENT);
      this.label('ILLUSTRATIVE 7R',fk.points[3],-114,-13);
      this.line([add(fk.points[3],[-.14,0,.023]),fk.points[3]],'#a9b0a5',.7);
    }
    // World coordinate triad: exactly the same camera projection as the model.
    const origin=[38,h-37],colors=['#666f6b','#858d7f','#9a482f'];
    [[1,0,0],[0,1,0],[0,0,1]].forEach((a,i)=>{
      const dx=dot(this.right,a)*24,dy=-dot(this.up,a)*24;
      c.beginPath();c.moveTo(...origin);c.lineTo(origin[0]+dx,origin[1]+dy);c.strokeStyle=colors[i];c.lineWidth=1;c.stroke();
      c.font='8px "Courier New",monospace';c.fillStyle=colors[i];c.fillText('xyz'[i],origin[0]+dx+3,origin[1]+dy-2);
    });
    c.restore();return {target:goal,tip:end,fk};
  }
}
