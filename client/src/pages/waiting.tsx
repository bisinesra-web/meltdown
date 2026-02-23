import React, { useEffect, useRef, useCallback } from 'react'
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { gsap } from 'gsap'
import '@fontsource-variable/jetbrains-mono'

import Squares from '../components/scrolling-bg'
import DiagnosticPopup, { useDiagnosticPing } from '../components/diagnostic-popup'
import { useCrtGlitch } from '../hooks/useCrtGlitch'
import './waiting.css'

/* ── Material name → friendly sector label mapping ── */
const SECTOR_MAP: Record<string, string> = {
  auxventb: 'AUX-VENT-B',
  transmissiona: 'TRANSMISSION-A',
  transmissionb: 'TRANSMISSION-B',
  waterchannela: 'WATER-CHANNEL-A',
  waterchannelb: 'WATER-CHANNEL-B',
  auxventa: 'AUX-VENT-A',
  alternator: 'ALTERNATOR',
  towerb: 'TOWER-B',
  reactorb: 'REACTOR-B',
  poola: 'POOL-A',
  reactora: 'REACTOR-A',
  auxilary: 'AUXILIARY',
  pump: 'COOLANT-PUMP',
  towera: 'TOWER-A',
  poolb: 'POOL-B',
  radiator: 'RADIATOR',
}

/* Reactor-core material names that should pulse red */
const REACTOR_NAMES = new Set(['reactora', 'reactorb'])

export default function WaitingRoom() {
  const mountReference = useRef<HTMLDivElement | null>(null)
  const initializedReference = useRef(false)
  const modelReference = useRef<Group | null>(null)
  const cameraReference = useRef<PerspectiveCamera | null>(null)
  const raycasterReference = useRef(new Raycaster())
  const pointerReference = useRef(new Vector2())

  const isGlitching = useCrtGlitch(5000, 10_000, 300)
  const [diagResult, triggerDiag] = useDiagnosticPing()

  /* ── Handle click on the 3D model for diagnostic ping ── */
  const handleViewportClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (
        !modelReference.current
        || !cameraReference.current
      ) {
        return
      }

      const rect = (event.target as HTMLElement).getBoundingClientRect()

      pointerReference.current.x
        = ((event.clientX - rect.left) / rect.width) * 2 - 1

      pointerReference.current.y
        = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycasterReference.current.setFromCamera(
        pointerReference.current,
        cameraReference.current,
      )

      const intersects = raycasterReference.current.intersectObject(
        modelReference.current,
        true,
      )

      if (intersects.length === 0) {
        return
      }

      const hit = intersects[0]
      if (!hit) {
        return
      }

      const mesh = hit.object as Mesh
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      const matName = materials[0]?.name ?? ''
      const sectorLabel
        = (SECTOR_MAP[matName] ?? matName.toUpperCase()) || 'UNKNOWN'

      // Brief flash on the clicked element
      for (const mat of materials) {
        if (
          !('color' in mat)
          || !(mat.color instanceof Color)
        ) {
          continue
        }

        const original = mat.color.clone()
        const originalOpacity = mat.opacity

        gsap.to(mat as unknown as gsap.TweenTarget, {
          opacity: 0.8,
          duration: 0.12,
          ease: 'power2.in',
          onComplete() {
            gsap.to(
              mat as gsap.TweenTarget,
              {
                opacity: originalOpacity,
                duration: 0.5,
                ease: 'power2.out',
              },
            )
          },
        })

        gsap.to(mat.color as unknown as gsap.TweenTarget, {
          r: 194 / 255,
          g: 214 / 255,
          b: 133 / 255,
          duration: 0.12,
          ease: 'power2.in',
          onComplete() {
            gsap.to(
              mat.color as gsap.TweenTarget,
              {
                r: original.r,
                g: original.g,
                b: original.b,
                duration: 0.5,
                ease: 'power2.out',
              },
            )
          },
        })
      }

      triggerDiag(sectorLabel)
    },
    [triggerDiag],
  )

  /* ── Three.js setup ── */
  useEffect(() => {
    if (!mountReference.current || initializedReference.current) {
      return
    }

    initializedReference.current = true

    const mountElement = mountReference.current

    const scene = new Scene()

    // eslint-disable-next-line unicorn/no-null
    scene.background = null

    const camera = new PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    )
    camera.position.set(55, 45, 55)
    cameraReference.current = camera

    const renderer = new WebGLRenderer({ antialias: true, alpha: true })
    renderer.setClearColor(0x00_00_00, 0)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mountElement.append(renderer.domElement)

    /* Orbit controls — user can rotate the facility */
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enableZoom = false
    controls.enablePan = false
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.4
    controls.minPolarAngle = Math.PI * 0.2
    controls.maxPolarAngle = Math.PI * 0.65

    /* Lighting — ambient + directional */
    scene.add(new AmbientLight(0xFF_FF_FF, 0.5))

    const directionalLight = new DirectionalLight(0xFF_FF_FF, 1.2)
    directionalLight.position.set(5, 30, 10)
    scene.add(directionalLight)

    /* ── Scanner plane (glowing green plane sweeps up/down) ── */
    const scannerMaterial = new ShaderMaterial({
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
      uniforms: {
        uColor: { value: new Color('#C2D685') },
        uOpacity: { value: 0.28 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(uColor, uOpacity);
        }
      `,
    })

    // We'll create the scanner plane geometry after loading the model
    // so we can size it exactly to the model's bounds.
    let scannerPlane: Mesh | null = null

    /* ── Load model ── */
    const darkGreen = new Color('#6B7548')
    const reactorRed = new Color('#723435')

    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)
    loader.setMeshoptDecoder(MeshoptDecoder)
    loader.load(
      '/plant-compressed.glb',
      (gltf) => {
        const model = gltf.scene
        modelReference.current = model
        scene.add(model)

        /* Make materials transparent, add edge lines */
        const edgeGroup = new Group()
        const edgeColor = new Color('#C2D685')
        const edgeMaterial = new LineBasicMaterial({
          color: edgeColor,
          transparent: true,
          opacity: 0.8,
        })

        model.traverse((child) => {
          if (!(child instanceof Mesh)) {
            return
          }

          const mesh = child as Mesh
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]

          for (const mat of materials) {
            mat.transparent = true
            mat.opacity = 0

            if ('color' in mat && mat.color instanceof Color) {
              mat.color.copy(darkGreen)
            }

            if ('roughness' in mat) {
              (mat as MeshStandardMaterial).roughness = 0.85
            }

            if ('metalness' in mat) {
              (mat as MeshStandardMaterial).metalness = 0.1
            }
          }

          /* Edge-detection wireframe overlay */
          const edges = new EdgesGeometry(mesh.geometry, 25)
          const line = new LineSegments(
            edges,
            edgeMaterial.clone(),
          )
          line.position.copy(mesh.position)
          line.rotation.copy(mesh.rotation)
          line.scale.copy(mesh.scale)
          mesh.getWorldPosition(line.position)
          mesh.getWorldQuaternion(line.quaternion)
          mesh.getWorldScale(line.scale)
          edgeGroup.add(line)
        })
        scene.add(edgeGroup)

        /* Compute model bounds for scanner sweep range and plane size */
        const box = new Box3().setFromObject(model)
        const minY = box.min.y
        const maxY = box.max.y
        const sizeX = box.max.x - box.min.x
        const sizeZ = box.max.z - box.min.z
        const centerX = (box.max.x + box.min.x) / 2
        const centerZ = (box.max.z + box.min.z) / 2

        /* Create scanner plane sized to model bounds */
        scannerPlane = new Mesh(
          new PlaneGeometry(sizeX, sizeZ),
          scannerMaterial,
        )
        scannerPlane.rotation.x = -Math.PI / 2
        scannerPlane.position.set(centerX, minY, centerZ)
        scene.add(scannerPlane)

        /* Scanner sweep animation */
        const scanPosition = { y: minY }
        const timeline = gsap.timeline({ repeat: -1, yoyo: true })
        timeline.to(scanPosition, {
          y: maxY,
          duration: 4,
          ease: 'sine.inOut',
          onUpdate() {
            if (scannerPlane) {
              scannerPlane.position.y = scanPosition.y
            }

            // Illuminate parts near the scanner plane
            model.traverse((child) => {
              if (!(child instanceof Mesh)) {
                return
              }

              const m = child as Mesh
              const mats = Array.isArray(m.material)
                ? m.material
                : [m.material]

              const meshBox = new Box3().setFromObject(m)
              const midY = (meshBox.min.y + meshBox.max.y) / 2
              const distance = Math.abs(scanPosition.y - midY)
              const range
                = (meshBox.max.y - meshBox.min.y) / 2 + 3

              for (const mat of mats) {
                if (
                  !('color' in mat)
                  || !(mat.color instanceof Color)
                ) {
                  continue
                }

                const isReactor = REACTOR_NAMES.has(mat.name)
                const baseColor = isReactor
                  ? reactorRed
                  : darkGreen
                const glowColor = new Color('#C2D685')

                if (distance < range) {
                  const t = 1 - distance / range
                  const mixed = baseColor
                    .clone()
                    .lerp(glowColor, t * 0.45)
                  mat.color.copy(mixed)
                }
                else {
                  mat.color.copy(baseColor)
                }
              }
            })
          },
        })

        /* Reactor pulse — red glow oscillation */
        const pulseState = { intensity: 0 }
        gsap.to(pulseState, {
          intensity: 1,
          duration: 2,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          onUpdate() {
            model.traverse((child) => {
              if (!(child instanceof Mesh)) {
                return
              }

              const m = child as Mesh
              const mats = Array.isArray(m.material)
                ? m.material
                : [m.material]

              for (const mat of mats) {
                if (!REACTOR_NAMES.has(mat.name)) {
                  continue
                }

                if (!('emissive' in mat)) {
                  continue
                }

                const std = mat as MeshStandardMaterial
                std.emissive = reactorRed
                std.emissiveIntensity
                  = pulseState.intensity * 0.35
              }
            })
          },
        })
      },
      undefined,
      (error) => {
        console.error('Error loading model:', error)
      },
    )

    /* ── Resize handler ── */
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    /* ── Render loop ── */
    let rafId: number

    function animate() {
      rafId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
      gsap.killTweensOf('*')
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <>
      <Squares
        speed={0.12}
        squareSize={40}
        direction='diagonal'
        borderColor='rgba(55,55,55,0.31)'
        bgColor='rgba(10, 10, 10, 0.85)'
        hoverFillColor='#111111'
      />

      <div className='waiting-room'>
        <div className='waiting-room__entry-overlay' aria-hidden='true' />
        <div className='waiting-room__vignette' />
        <div className='waiting-room__scanlines' />

        {/* CRT glitch layer */}
        <div
          className={`waiting-room__glitch-layer${isGlitching ? ' waiting-room__glitch-layer--active' : ''}`}
        />

        {/* Header */}
        <header className='waiting-room__header'>
          <h1 className='waiting-room__title'>MELTDOWN</h1>
        </header>

        {/* 3D viewport */}
        <div
          ref={mountReference}
          className={`waiting-room__viewport${isGlitching ? ' waiting-room__viewport--glitch' : ''}`}
          onClick={handleViewportClick}
        />
        {/* Diagnostic popup */}
        <DiagnosticPopup diag={diagResult} />

        {/* Bottom status text */}
        <div className='waiting-room__status-bar'>
          <span className='waiting-room__status-text'>
            AWAITING EXTERNAL CONNECTION
            <span className='waiting-room__cursor' />
          </span>
        </div>
      </div>
    </>
  )
}
