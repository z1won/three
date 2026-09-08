import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, OrbitControls, TransformControls, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './styles.css'

type TransformMode = 'translate' | 'rotate' | 'scale'

type ModelProps = {
  url: string
  selected: boolean
  mode: TransformMode
  onSelect: () => void
}

function Cube({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current && !selected) ref.current.rotation.y += delta * 0.5
  })

  const cube = (
    <mesh
      ref={ref}
      position={[0, 1, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color={selected ? '#22c55e' : '#4f46e5'} roughness={0.35} metalness={0.15} />
    </mesh>
  )

  return selected ? <TransformControls>{cube}</TransformControls> : cube
}

function GLTFModel({ url, selected, mode, onSelect }: ModelProps) {
  const { scene } = useGLTF(url)

  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
  }, [scene])

  const model = (
    <group
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <primitive object={scene} />
    </group>
  )

  return selected ? <TransformControls mode={mode}>{model}</TransformControls> : model
}

export default function App() {
  const [selected, setSelected] = useState<'cube' | 'model' | null>(null)
  const [modelUrl, setModelUrl] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [modelName, setModelName] = useState('')
  const [mode, setMode] = useState<TransformMode>('translate')

  useEffect(() => {
    return () => {
      if (modelUrl.startsWith('blob:')) URL.revokeObjectURL(modelUrl)
    }
  }, [modelUrl])

  const loadModel = (url: string, name = 'Remote model') => {
    if (!url) return
    setModelUrl(url)
    setModelName(name)
    setSelected('model')
  }

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const isSupported = /\.(glb|gltf)$/i.test(file.name)
    if (!isSupported) {
      window.alert('GLB 또는 GLTF 파일만 선택할 수 있습니다.')
      event.target.value = ''
      return
    }

    if (modelUrl.startsWith('blob:')) URL.revokeObjectURL(modelUrl)
    const objectUrl = URL.createObjectURL(file)
    loadModel(objectUrl, file.name)
    event.target.value = ''
  }

  const handleUrlSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    loadModel(urlInput.trim())
  }

  const clearModel = () => {
    if (modelUrl.startsWith('blob:')) URL.revokeObjectURL(modelUrl)
    setModelUrl('')
    setModelName('')
    setSelected(null)
  }

  return (
    <main className="app">
      <header className="toolbar">
        <div>
          <strong>Three.js Playground</strong>
          <span>Browser-only 3D renderer</span>
        </div>
        <span className="status">React Three Fiber · Three.js · GLB/GLTF</span>
      </header>

      <section className="viewport">
        <Canvas
          camera={{ position: [5, 3.5, 7], fov: 50 }}
          shadows
          onPointerMissed={() => setSelected(null)}
        >
          <color attach="background" args={['#0b1020']} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[5, 8, 5]} intensity={2} castShadow />
          <directionalLight position={[-4, 3, -4]} intensity={0.5} />

          {!modelUrl && <Cube selected={selected === 'cube'} onSelect={() => setSelected('cube')} />}

          {modelUrl && (
            <Suspense fallback={null}>
              <GLTFModel
                url={modelUrl}
                selected={selected === 'model'}
                mode={mode}
                onSelect={() => setSelected('model')}
              />
            </Suspense>
          )}

          <Grid
            args={[20, 20]}
            cellSize={1}
            cellThickness={0.6}
            sectionSize={5}
            sectionThickness={1.2}
            fadeDistance={30}
            fadeStrength={1}
          />
          <OrbitControls makeDefault enableDamping />
        </Canvas>

        <aside className="panel">
          <h2>Scene</h2>

          {!modelUrl && (
            <button className={selected === 'cube' ? 'active' : ''} onClick={() => setSelected('cube')}>
              Cube
            </button>
          )}

          <div className="model-loader">
            <label className="file-button">
              GLB / GLTF 업로드
              <input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={handleFile} />
            </label>

            <form onSubmit={handleUrlSubmit} className="url-form">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://.../model.glb"
                aria-label="GLB/GLTF URL"
              />
              <button type="submit">Load</button>
            </form>

            {modelUrl && (
              <div className="loaded-model">
                <span title={modelName}>{modelName}</span>
                <button type="button" onClick={clearModel}>×</button>
              </div>
            )}
          </div>

          {selected && (
            <div className="transform-tools">
              <span className="section-label">Transform</span>
              <div className="mode-buttons">
                <button className={mode === 'translate' ? 'active' : ''} onClick={() => setMode('translate')}>Move</button>
                <button className={mode === 'rotate' ? 'active' : ''} onClick={() => setMode('rotate')}>Rotate</button>
                <button className={mode === 'scale' ? 'active' : ''} onClick={() => setMode('scale')}>Scale</button>
              </div>
            </div>
          )}

          <div className="help">
            <p>마우스 드래그: 카메라 회전</p>
            <p>휠: 줌</p>
            <p>오브젝트 클릭: 선택</p>
            <p>GLB/GLTF는 서버 없이 브라우저에서 바로 로드됩니다.</p>
          </div>
        </aside>
      </section>
    </main>
  )
}
