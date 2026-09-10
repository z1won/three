import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type Key = { id:string; t:number; p:[number,number,number]; r:[number,number,number]; s:[number,number,number] }
type Props = { selected: THREE.Object3D | null }
const cloneKey=(o:THREE.Object3D,t:number):Key=>({id:`${Date.now()}-${Math.random()}`,t,p:[o.position.x,o.position.y,o.position.z],r:[o.rotation.x,o.rotation.y,o.rotation.z],s:[o.scale.x,o.scale.y,o.scale.z]})
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t
const apply=(o:THREE.Object3D,a:Key,b:Key,u:number)=>{o.position.set(lerp(a.p[0],b.p[0],u),lerp(a.p[1],b.p[1],u),lerp(a.p[2],b.p[2],u));const qa=new THREE.Quaternion().setFromEuler(new THREE.Euler(...a.r));const qb=new THREE.Quaternion().setFromEuler(new THREE.Euler(...b.r));o.quaternion.copy(qa).slerp(qb,u);o.scale.set(lerp(a.s[0],b.s[0],u),lerp(a.s[1],b.s[1],u),lerp(a.s[2],b.s[2],u));o.updateMatrixWorld(true)}
export default function KeyframeTimeline({selected}:Props){
 const [keys,setKeys]=useState<Key[]>([]),[time,setTime]=useState(0),[duration,setDuration]=useState(5),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[selectedKey,setSelectedKey]=useState<string|null>(null)
 const last=useRef(0),drag=useRef(false),editing=useRef(false)
 const sorted=useMemo(()=>[...keys].sort((a,b)=>a.t-b.t),[keys])
 useEffect(()=>{setTime(0);setPlaying(false);setKeys([]);setSelectedKey(null)},[selected])
 useEffect(()=>{let raf=0;const tick=(now:number)=>{const dt=Math.min(.05,(now-last.current)/1000||0);last.current=now;if(playing&&selected){const n=time+dt*speed;if(n>=duration){setTime(0);setPlaying(false)}else setTime(n)}raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[playing,selected,time,speed,duration])
 useEffect(()=>{if(!selected||drag.current||editing.current||!sorted.length)return;let a=sorted[0],b=sorted[sorted.length-1];if(time<=a.t){apply(selected,a,a,0);return}if(time>=b.t){apply(selected,b,b,0);return}for(let i=0;i<sorted.length-1;i++)if(time>=sorted[i].t&&time<=sorted[i+1].t){a=sorted[i];b=sorted[i+1];break}apply(selected,a,b,THREE.MathUtils.clamp((time-a.t)/Math.max(.0001,b.t-a.t),0,1))},[time,selected,sorted])
 if(!selected)return <div className="keyframe-timeline muted">Select an object to create transform keyframes.</div>
 const seek=(v:number)=>{setTime(THREE.MathUtils.clamp(v,0,duration));setPlaying(false)}
 const addKey=()=>{const k=cloneKey(selected,time);setKeys(v=>[...v.filter(x=>Math.abs(x.t-time)>.03),k]);setSelectedKey(k.id);apply(selected,k,k,0)}
 const removeAtTime=()=>setKeys(v=>v.filter(k=>Math.abs(k.t-time)>.03))
 const jump=(k:Key)=>{setSelectedKey(k.id);setTime(k.t);setPlaying(false);apply(selected,k,k,0)}
 const patch=(id:string,field:'p'|'r'|'s',index:number,value:number)=>setKeys(v=>v.map(k=>{if(k.id!==id)return k;const a=[...k[field]] as [number,number,number];a[index]=value;return {...k,[field]:a}}))
 const patchTime=(id:string,value:number)=>setKeys(v=>v.map(k=>k.id===id?{...k,t:THREE.MathUtils.clamp(value,0,duration)}:k))
 const updateDuration=(value:number)=>{const d=Math.max(.5,Math.min(60,value));setDuration(d);setTime(v=>Math.min(v,d));setKeys(v=>v.map(k=>({...k,t:Math.min(k.t,d)})))}
 const field=(id:string,label:string,arr:[number,number,number],kind:'p'|'r'|'s')=><div className="keyframe-fields"><span>{label}</span>{arr.map((v,i)=><input key={i} type="number" step="0.01" value={kind==='r'?THREE.MathUtils.radToDeg(v).toFixed(2):v} onFocus={()=>{editing.current=true}} onBlur={()=>{editing.current=false}} onChange={e=>patch(id,kind,i,kind==='r'?THREE.MathUtils.degToRad(Number(e.target.value)):Number(e.target.value))}/>)}</div>
 return <section className="keyframe-timeline panel-section">
  <div className="panel-section-title"><span>Transform Timeline</span><span>{time.toFixed(2)}s / {duration.toFixed(2)}s</span></div>
  <div className="keyframe-toolbar"><button onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><button onClick={()=>{setTime(0);setPlaying(false)}}>Restart</button><button onClick={addKey}>◆ Add Key</button><button onClick={removeAtTime}>Remove Key</button><label>Speed <select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.25,.5,1,1.5,2].map(v=><option key={v} value={v}>{v}x</option>)}</select></label><label>Duration <input type="number" min="0.5" max="60" step="0.5" value={duration} onChange={e=>updateDuration(Number(e.target.value))}/>s</label></div>
  <input className="timeline-range" type="range" min="0" max={duration} step="0.01" value={time} onChange={e=>seek(Number(e.target.value))}/>
  <div className="keyframe-track" onPointerDown={e=>{if((e.target as HTMLElement).closest('.keyframe-marker'))return;const r=e.currentTarget.getBoundingClientRect();drag.current=true;seek(((e.clientX-r.left)/r.width)*duration);const move=(ev:PointerEvent)=>seek(((ev.clientX-r.left)/r.width)*duration);const up=()=>{drag.current=false;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)}}>{sorted.map(k=><button className={`keyframe-marker${selectedKey===k.id?' active':''}`} key={k.id} style={{left:`${k.t/duration*100}%`}} title={`${k.t.toFixed(2)}s`} onClick={()=>jump(k)}>◆</button>)}<span className="timeline-cursor" style={{left:`${time/duration*100}%`}}/></div>
  <div className="keyframe-meta">Position · Rotation · Scale · rotation uses quaternion slerp</div>
  {sorted.length>0&&<div className="keyframe-list">{sorted.map((k,i)=><div className={`keyframe-row${selectedKey===k.id?' selected':''}`} key={k.id}><button onClick={()=>jump(k)}>◆ K{i+1}</button><label>Time <input type="number" min="0" max={duration} step="0.01" value={k.t} onFocus={()=>{editing.current=true}} onBlur={()=>{editing.current=false}} onChange={e=>patchTime(k.id,Number(e.target.value))}/></label><button onClick={()=>setKeys(v=>v.filter(x=>x.id!==k.id))}>×</button>{field(k.id,'P',k.p,'p')}{field(k.id,'R°',k.r,'r')}{field(k.id,'S',k.s,'s')}</div>)}</div>}
 </section>
}