// Shared runtime helpers for Aestra Live Table.
// This module deliberately contains no Supabase or GM-domain logic.

export function valueEqual(a,b){
  if(Object.is(a,b))return true;
  if(a==null||b==null)return a===b;
  if(typeof a!=='object'||typeof b!=='object')return false;
  try{return JSON.stringify(a)===JSON.stringify(b)}catch(_){return false}
}

export function changedKeys(previous,next){
  const before=previous&&typeof previous==='object'?previous:{};
  const after=next&&typeof next==='object'?next:{};
  const keys=new Set([...Object.keys(before),...Object.keys(after)]);
  const changed=[];
  for(const key of keys){
    if(key==='updated_at'||key==='updated_by')continue;
    if(!valueEqual(before[key],after[key]))changed.push(key);
  }
  return changed;
}

export function delegate(root,type,selector,handler,options){
  if(!root)return()=>{};
  const listener=event=>{
    const origin=event.target instanceof Element?event.target:null;
    const target=origin?.closest(selector);
    if(!target||!root.contains(target))return;
    handler(event,target);
  };
  root.addEventListener(type,listener,options);
  return()=>root.removeEventListener(type,listener,options);
}

export class LifecycleManager{
  constructor(){
    this.tasks=new Map();
  }

  stop(name){
    const task=this.tasks.get(name);
    if(!task)return;
    this.tasks.delete(name);
    try{task()}catch(_){}
  }

  stopPrefix(prefix){
    for(const name of [...this.tasks.keys()]){
      if(name.startsWith(prefix))this.stop(name);
    }
  }

  stopAll(){
    for(const name of [...this.tasks.keys()])this.stop(name);
  }

  interval(name,fn,ms){
    this.stop(name);
    const id=setInterval(fn,ms);
    this.tasks.set(name,()=>clearInterval(id));
    return id;
  }

  timeout(name,fn,ms){
    this.stop(name);
    const id=setTimeout(()=>{
      this.tasks.delete(name);
      fn();
    },ms);
    this.tasks.set(name,()=>clearTimeout(id));
    return id;
  }

  raf(name,fn,{fps=0}={}){
    this.stop(name);
    let frame=0;
    let last=0;
    let active=true;
    const minGap=fps>0?1000/fps:0;
    const tick=now=>{
      if(!active)return;
      frame=requestAnimationFrame(tick);
      if(minGap&&now-last<minGap)return;
      last=now;
      fn(now);
    };
    frame=requestAnimationFrame(tick);
    this.tasks.set(name,()=>{
      active=false;
      cancelAnimationFrame(frame);
    });
    return frame;
  }
}
