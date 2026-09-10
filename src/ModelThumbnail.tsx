import { Canvas } from '@react-three/fiber'
import { Bounds, Environment, OrbitControls, useGLTF } from '@react-three/drei'
import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import type { PublicModel } from './modelCatalog'

function ThumbnailScene({ model }: { model: PublicModel }) {
  const { scene } = useGLTF(model.url)

  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
  }, [scene])

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 6, 5]} intensity={3} />
      <Environment preset="studio" environmentIntensity={0.8} />
      <Bounds fit clip observe margin={1.25}>
        <primitive object={scene} />
      </Bounds>
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.2} />
    </>
  )
}

export default function ModelThumbnail({ model }: { model: PublicModel }) {
  return (
    <div className="model-thumbnail" aria-hidden="true">
      <Canvas
        camera={{ position: [3, 2, 4], fov: 35 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <ThumbnailScene model={model} />
        </Suspense>
      </Canvas>
    </div>
  )
}
