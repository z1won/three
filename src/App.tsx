import { Canvas, ThreeEvent, useThree } from '@react-three/fiber'
import { Bounds, Environment, Grid, OrbitControls, TransformControls, useGLTF } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import './styles.css'

type TransformMode='translate'|'rotate'|'scale'; type TransformSpace='world'|'local'; type SelectedObject=THREE.Object3D
// keep the remainder of the existing implementation unchanged
