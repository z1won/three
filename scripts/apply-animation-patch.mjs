import fs from 'node:fs'

const path = 'src/App.tsx'
let s = fs.readFileSync(path, 'utf8')
if (s.includes('AnimationController')) process.exit(0)

s = s.replace(
  "import { Canvas, ThreeEvent, useThree } from '@react-three/fiber'",
  "import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'"
)
s = s.replace(
  "type ModelProps={url:string;onSelect:(o:THREE.Object3D)=>void;onLoaded:(o:THREE.Object3D)=>void}",
  "type ModelProps={url:string;onSelect:(o:THREE.Object3D)=>void;onLoaded:(o:THREE.Object3D)=>void;onAnimations:(clips:THREE.AnimationClip[])=>void}"
)
s = s.replace(
  "function GLTFModel({url,onSelect,onLoaded}:ModelProps){const{scene}=useGLTF(url,true,true,configureLoader);useEffect(()=>{scene.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.editorSelectable=true;o.castShadow=true;o.receiveShadow=true}});onLoaded(scene)},[scene,onLoaded]);return <primitive object={scene} onClick={(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();if(e.object instanceof THREE.Mesh)onSelect(e.object)}}/>}",
  "function GLTFModel({url,onSelect,onLoaded,onAnimations}:ModelProps){const{scene,animations}=useGLTF(url,true,true,configureLoader);useEffect(()=>{scene.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.editorSelectable=true;o.castShadow=true;o.receiveShadow=true}});onLoaded(scene);onAnimations(animations)},[scene,animations,onLoaded,onAnimations]);return <primitive object={scene} onClick={(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();if(e.object instanceof THREE.Mesh)onSelect(e.object)}}/>}"
)
const marker = "function getMeshNodes(scene:THREE.Object3D){"
const animationController = `function AnimationController({scene,clips,index,playing}:{scene:THREE.Object3D|null;clips:THREE.AnimationClip[];index:number;playing:boolean}){\n const mixer=useRef<THREE.AnimationMixer|null>(null),action=useRef<THREE.AnimationAction|null>(null)\n useEffect(()=>{if(!scene||!clips.length){mixer.current=null;action.current=null;return};const m=new THREE.AnimationMixer(scene);mixer.current=m;const clip=clips[index]??clips[0];const a=m.clipAction(clip);a.reset().setLoop(THREE.LoopRepeat,Infinity);if(playing)a.play();action.current=a;return()=>{m.stopAllAction();m.uncacheRoot(scene);mixer.current=null;action.current=null}},[scene,clips,index])\n useEffect(()=>{if(!action.current)return;playing?action.current.play():action.current.paused=true},[playing])\n useFrame((_,delta)=>{mixer.current?.update(delta)})\n return null\n}\n`
if (!s.includes(animationController.trim())) s = s.replace(marker, animationController + marker)

s = s.replace(
  "[nameEdit,setNameEdit]=useState(''),[libraryQuery,setLibraryQuery]=useState(''),[libraryFormat,setLibraryFormat]=useState<'ALL'|'GLB'|'GLTF'>('ALL')",
  "[nameEdit,setNameEdit]=useState(''),[libraryQuery,setLibraryQuery]=useState(''),[libraryFormat,setLibraryFormat]=useState<'ALL'|'GLB'|'GLTF'>('ALL'),[animationClips,setAnimationClips]=useState<THREE.AnimationClip[]>([]),[animationIndex,setAnimationIndex]=useState(0),[animationPlaying,setAnimationPlaying]=useState(true)"
)
s = s.replace(
  "setModelUrl(url);setModelName(name);setSelected(null);setModelMeshes([]);setModelScene(null);setExportTarget(null);",
  "setModelUrl(url);setModelName(name);setSelected(null);setModelMeshes([]);setModelScene(null);setExportTarget(null);setAnimationClips([]);setAnimationIndex(0);setAnimationPlaying(true);"
)
s = s.replace(
  "setModelUrl('');setModelName('');setModelMeshes([]);setModelScene(null);setExportTarget(null);setSelected(null);",
  "setModelUrl('');setModelName('');setModelMeshes([]);setModelScene(null);setExportTarget(null);setAnimationClips([]);setAnimationIndex(0);setAnimationPlaying(true);setSelected(null);"
)
s = s.replace(
  "const handleSelect=(o:THREE.Object3D)=>{setSelected(o);setNameEdit(o.name||'');if(!modelUrl)setExportTarget(o)};const handleModelLoaded=useCallback((s:THREE.Object3D)=>{setModelScene(s);setExportTarget(s);setModelMeshes(getMeshNodes(s));setHierarchyVersion(v=>v+1)},[])",
  "const handleSelect=(o:THREE.Object3D)=>{setSelected(o);setNameEdit(o.name||'');if(!modelUrl)setExportTarget(o)};const handleModelLoaded=useCallback((s:THREE.Object3D)=>{setModelScene(s);setExportTarget(s);setModelMeshes(getMeshNodes(s));setHierarchyVersion(v=>v+1)},[]);const handleAnimations=useCallback((clips:THREE.AnimationClip[])=>{setAnimationClips(clips);setAnimationIndex(0);setAnimationPlaying(clips.length>0)},[]);"
)
s = s.replace(
  "<section className=\"panel\"><span className=\"section-label\">Camera</span>",
  "<section className=\"panel\"><span className=\"section-label\">Animation</span>{animationClips.length?<><div className=\"animation-controls\"><button onClick={()=>setAnimationPlaying(v=>!v)}>{animationPlaying?'Pause':'Play'}</button><select value={animationIndex} onChange={e=>{setAnimationIndex(+e.target.value);setAnimationPlaying(true)}}>{animationClips.map((clip,i)=><option key={`${clip.name}-${i}`} value={i}>{clip.name||`Animation ${i+1}`}</option>)}</select></div><small>{animationClips.length} clip{animationClips.length===1?'':'s'} · realtime playback</small></>:<small>이 모델에는 Animation Clip이 없습니다.</small>}</section><section className=\"panel\"><span className=\"section-label\">Camera</span>"
)
s = s.replace(
  "<FocusSelected selected={selected} focusToken={focusToken}/>",
  "<FocusSelected selected={selected} focusToken={focusToken}/><AnimationController scene={modelScene} clips={animationClips} index={animationIndex} playing={animationPlaying}/>"
)
s = s.replace(
  "<GLTFModel url={modelUrl} onSelect={handleSelect} onLoaded={handleModelLoaded}/>",
  "<GLTFModel url={modelUrl} onSelect={handleSelect} onLoaded={handleModelLoaded} onAnimations={handleAnimations}/>"
)

if (!s.includes('AnimationController')) throw new Error('Animation patch failed: controller not inserted')
fs.writeFileSync(path, s)
`});