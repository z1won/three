export type PublicModel = {
  name: string
  format: 'GLB' | 'GLTF'
  url: string
  description: string
}

export const publicModels: PublicModel[] = [
  {
    name: 'Damaged Helmet',
    format: 'GLB',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
    description: 'PBR material / texture sample',
  },
  {
    name: 'Flight Helmet',
    format: 'GLB',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/FlightHelmet/glTF-Binary/FlightHelmet.glb',
    description: 'Detailed hard-surface model',
  },
  {
    name: 'Cesium Man',
    format: 'GLB',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMan/glTF-Binary/CesiumMan.glb',
    description: 'Animated character sample',
  },
  {
    name: 'Fox',
    format: 'GLB',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb',
    description: 'Character with animation clips',
  },
  {
    name: 'BoomBox',
    format: 'GLB',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoomBox/glTF-Binary/BoomBox.glb',
    description: 'PBR / normal-map sample',
  },
  {
    name: 'Duck',
    format: 'GLTF',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF/Duck.gltf',
    description: 'GLTF with external resources',
  },
  {
    name: 'Avocado',
    format: 'GLTF',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF/Avocado.gltf',
    description: 'Compact PBR asset',
  },
  {
    name: 'Lantern',
    format: 'GLTF',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Lantern/glTF/Lantern.gltf',
    description: 'Metallic material sample',
  },
]
