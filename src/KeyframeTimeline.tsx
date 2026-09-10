import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type Key = { t:number; p:[number,number,number]; r:[number,number,number]; s:[number,number,number] }
type Props = { selected: THREE.Object3D | null }

const cloneKey=(o:THREE.Object3D,t:number):Key=>({t,p:[o.position.x,o.position.y,o.position.z],r:[o.rotation.x,o.rotation.y,o.rotation.z],s:[o.scale.x,o.scale.y,o.scale.z]})
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t

export default function KeyframeTimeline({selected}:Props){
 const [keys,setKeys]=useState<Key[]>([]),[time,setTime]=useState(0),[duration]=useState(5),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1)
 const last=useRef(0),drag=useRef(false)
 const sorted=useMemo(()=>[...keys].sort((a,b)=>a.t-b.t),[keys])
 useEffect(()=>{if(!selected){setKeys([]);setTime(0);setPlaying(false);return}setKeys([]);setTime(0)},[selected])
 useEffect(()=>{let raf=0;const tick=(now:number)=>{const dt=Math.min(.05,(now-last.current)/1000||0);last.current=now;if(playing&&selected){const next=time+dt*speed;if(next>=duration){setTime(0);setPlaying(false)}else setTime(next)}raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[playing,selected,time,speed,duration])
 useEffect(()=>{if(!selected||drag.current||!sorted.length)return;let a=sorted[0],b=sorted[sorted.length-1];for(let i=0;i<sorted.length-1;i++){if(time>=sorted[i].t&&time<=sorted[i+1].t){a=sorted[i];b=sorted[i+1];break}}const span=Math.max(.0001,b.t-a.t),u=THREE.MathUtils.clamp((time-a.t)/span,0,1);selected.position.set(lerp(a.p[0],b.p[0],u),lerp(a.p[1],b.p[1],u),lerp(a.p[2],b.p[2],u));selected.rotation.set(lerp(a.r[0],b.r[0],u),lerp(a.r[1],b.r[1],u),lerp(a.r[2],b.r[2],u));selected.scale.set(lerp(a.s[0],b.s[0],u),lerp(a.s[1],b.s[1],u),lerp(a.s[2],b.s[2],u));selected.updateMatrixWorld(true)},[time,selected,sorted])
 if(!selected)return <div className="keyframe-timeline muted">Select an object to create transform keyframes.</div>
 const addKey=()=>{const k=cloneKey(selected,time);setKeys(v=>[...v.filter(x=>Math.abs(x.t-time)>.03),k])}
 const removeKey=()=>setKeys(v=>v.filter(k=>Math.abs(k.t-time)>.03))
 const seek=(v:number)=>{setTime(v);setPlaying(false)}
 return <section className="keyframe-timeline panel-section">
  <div className="panel-section-title"><span>Transform Timeline</span><span>{time.toFixed(2)}s / {duration.toFixed(2)}s</span></div>
  <div className="keyframe-toolbar"><button onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><button onClick={()=>{setTime(0);setPlaying(false)}}>Restart</button><button onClick={addKey}>◆ Add Key</button><button onClick={removeKey}>Remove Key</button><label>Speed <select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.25,.5,1,1.5,2].map(v=><option key={v} value={v}>{v}x</option>)}</select></label></div>
  <input className="timeline-range" type="range" min="0" max={duration} step="0.01" value={time} onChange={e=>seek(Number(e.target.value))}/>
  <div className="keyframe-track" onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect();drag.current=true;seek(THREE.MathUtils.clamp((e.clientX-r.left)/r.width,0,1)*duration);const up=()=>{drag.current=false;window.removeEventListener('pointerup',up)};window.addEventListener('pointerup',up)}}>
   {sorted.map(k=><button className="keyframe-marker" key={k.t} style={{left:`${k.t/duration*100}%`}} title={`${k.t.toFixed(2)}s`} onClick={()=>seek(k.t)}>◆</button>)}
   <span className="timeline-cursor" style={{left:`${time/duration*100}%`}}/>
  </div>
  <div className="keyframe-meta">Position · Rotation · Scale · Linear interpolation</div>
 </section>
}
