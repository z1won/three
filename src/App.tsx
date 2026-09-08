import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'

function Cube() {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.x += delta * 0.5
    ref.current.rotation.y += delta * 0.8
  })

  return (
    <mesh ref={ref} position={[0, 1, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#4f46e5" roughness={0.35} metalness={0.15} />
    </mesh>
  )
}

export default function App() {
  return (
    <main className="app">
      <header className="toolbar">
        <div>
          <strong>Three.js Playground</strong>
          <span>React Three Fiber</span>
        </div>
        <span className="hint">Drag · Wheel · Right click</span>
      </header>

      <Canvas camera={{ position: [4, 3, 6], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={['#0b1020']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} />
        <Cube />
        <Grid
          args={[20, 20]}
          cellSize={1}
          cellThickness={0.6}
          sectionSize={5}
          sectionThickness={1.2}
          fadeDistance={30}
          fadeStrength={1}
        />
        <OrbitControls makeDefault />
      </Canvas>
    </main>
  )
}
