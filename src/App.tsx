import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, OrbitControls, TransformControls } from '@react-three/drei'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import './styles.css'

function Cube({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current && !selected) ref.current.rotation.y += delta * 0.5
  })
  const cube = <mesh ref={ref} position={[0, 1, 0]} onClick={(e) => { e.stopPropagation(); onSelect() }}><boxGeometry args={[2, 2, 2]} /><meshStandardMaterial color={selected ? '#22c55e' : '#4f46e5'} roughness={0.35} metalness={0.15} /></mesh>
  return selected ? <TransformControls>{cube}</TransformControls> : cube
}

export default function App() {
  const [selected, setSelected] = useState(false)
  return <main className="app">
    <header className="toolbar"><div><strong>Three.js Playground</strong><span>Browser-only 3D renderer</span></div><span className="status">React Three Fiber · Three.js</span></header>
    <section className="viewport">
      <Canvas camera={{ position: [5, 3.5, 7], fov: 50 }} shadows onPointerMissed={() => setSelected(false)}>
        <color attach="background" args={['#0b1020']} /><ambientLight intensity={0.55} /><directionalLight position={[5, 8, 5]} intensity={2} castShadow /><directionalLight position={[-4, 3, -4]} intensity={0.5} />
        <Cube selected={selected} onSelect={() => setSelected(true)} />
        <Grid args={[20, 20]} cellSize={1} cellThickness={0.6} sectionSize={5} sectionThickness={1.2} fadeDistance={30} fadeStrength={1} />
        <OrbitControls makeDefault enableDamping />
      </Canvas>
      <aside className="panel"><h2>Scene</h2><button className={selected ? 'active' : ''} onClick={() => setSelected(true)}>Cube</button><p>마우스 드래그: 회전</p><p>휠: 줌</p><p>오브젝트 클릭: 선택</p><p>선택 후 TransformControls로 이동/회전/스케일</p></aside>
    </section>
  </main>
}
