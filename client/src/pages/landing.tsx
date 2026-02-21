import React, { useEffect, useRef } from 'react'
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { gsap } from 'gsap'
import '@fontsource-variable/jetbrains-mono'
import Squares from '../components/scrolling-bg'
import './Landing.css'

type ScrambleTextFunction = (
  element: HTMLElement,
  finalText: string,
  duration?: number,
) => void

export default function Landing() {
  const mountReference = useRef<HTMLDivElement | null>(null)
  const titleReference = useRef<HTMLHeadingElement | null>(null)
  const containerReference = useRef<HTMLDivElement | null>(null)
  const scrambleTextReference = useRef<ScrambleTextFunction | null>(null)
  const lockedLettersReference = useRef(0)
  const scrambleIntervalReference = useRef<ReturnType<typeof setInterval> | null>(null)
  const initializedReference = useRef(false)

  useEffect(() => {
    if (!mountReference.current || initializedReference.current) {
      return
    }

    initializedReference.current = true

    const scene = new Scene()
    scene.background = null

    const camera = new PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    )
    camera.position.set(50, 50, 50)

    const renderer = new WebGLRenderer({ antialias: true, alpha: true })
    renderer.setClearColor(0x00_00_00, 0)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    mountReference.current.append(renderer.domElement)

    const mouse = { x: 0, y: 0 }
    const targetCameraPos = { x: 50, y: 50, z: 50 }
    const baseCameraPos = { x: 50, y: 50, z: 50 }
    const movementRange = 5

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = (event.clientY / window.innerHeight) * 2 - 1

      targetCameraPos.x = baseCameraPos.x + mouse.x * movementRange
      targetCameraPos.y = baseCameraPos.y - mouse.y * movementRange
    }

    globalThis.addEventListener('mousemove', handleMouseMove)

    scene.add(new AmbientLight(0xFF_FF_FF, 0.5))

    const dirLight = new DirectionalLight(0xFF_FF_FF, 1.5)
    dirLight.position.set(5, 20, 7)
    scene.add(dirLight)

    const scrambleText: ScrambleTextFunction = (element, finalText, duration = 2) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'
      const textLength = finalText.length
      let iteration = 0
      const totalIterations = duration * 30

      const interval = setInterval(() => {
        element.innerText = finalText
          .split('')
          .map((letter, index) => {
            if (index < iteration / (totalIterations / textLength)) {
              return finalText[index]
            }

            return chars[Math.floor(Math.random() * chars.length)]
          })
          .join('')

        iteration++

        if (iteration >= totalIterations) {
          clearInterval(interval)
          element.innerText = finalText
        }
      }, 1000 / 30)
    }

    scrambleTextReference.current = scrambleText

    const finalText = 'MELTDOWN'
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'

    // Start continuous scramble animation
    const startContinuousScramble = () => {
      if (scrambleIntervalReference.current) {
        clearInterval(scrambleIntervalReference.current)
      }

      scrambleIntervalReference.current = setInterval(() => {
        if (!titleReference.current) {
          return
        }

        titleReference.current.innerText = [...finalText]
          .map((letter, index) => {
            // Lock letters based on how many elements have turned red (every 2 elements = 1 letter)
            if (index < lockedLettersReference.current) {
              return letter
            }

            return chars[Math.floor(Math.random() * chars.length)]
          })
          .join('')
      }, 1000 / 15) // 30 FPS
    }

    // Don't start scrambling until model is loaded
    // startContinuousScramble();

    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')

    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)
    loader.setMeshoptDecoder(MeshoptDecoder)
    loader.load(
      '/plant-compressed.glb',
      (gltf) => {
        const model = gltf.scene
        scene.add(model)
        console.log('Model loaded successfully')

        // Start scrambling animation after model loads
        startContinuousScramble()

        const materialNames = [
          'auxventb',
          'transmissiona',
          'transmissionb',
          'waterchannela',
          'waterchannelb',
          'auxventa',
          'alternator',
          'towerb',
          'reactorb',
          'poola',
          'reactora',
          'auxilary',
          'pump',
          'towera',
          'poolb',
          'radiator',
        ]

        for (let index = materialNames.length - 1; index > 0; index--) {
          const index_ = Math.floor(Math.random() * (index + 1));
          [materialNames[index], materialNames[index_]] = [
            materialNames[index_]!,
            materialNames[index]!,
          ]
        }

        let currentIndex = 0
        const targetColor = new Color('#723435')

        const intervalId: ReturnType<typeof setInterval> = setInterval(() => {
          if (currentIndex >= materialNames.length) {
            clearInterval(intervalId)
            return
          }

          const targetMaterial = materialNames[currentIndex]

          model.traverse((child) => {
            const mesh = child as Mesh
            const { material } = mesh
            if (!material) {
              return
            }

            const materials = Array.isArray(material) ? material : [material]

            for (const mat of materials) {
              if (mat.name !== targetMaterial) {
                continue
              }

              if (!('color' in mat) || !(mat.color instanceof Color)) {
                continue
              }

              gsap.to(mat.color, {
                r: targetColor.r,
                g: targetColor.g,
                b: targetColor.b,
                duration: 0.4,
                ease: 'power2.inOut',
              })
            }
          })

          // Update locked letters: every 2 elements = 1 letter locked
          lockedLettersReference.current = Math.floor((currentIndex + 1) / 2)

          currentIndex++
        }, 300)

        model.userData.intervalId = intervalId
      },
      (progress) => {
        console.log(
          'Loading progress:',
          (progress.loaded / progress.total) * 100 + '%',
        )
      },
      (error) => {
        console.error('Error loading model:', error)
      },
    )

    const composer = new EffectComposer(renderer)
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      composer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    function animate() {
      requestAnimationFrame(animate)

      camera.position.x += (targetCameraPos.x - camera.position.x) * 0.05
      camera.position.y += (targetCameraPos.y - camera.position.y) * 0.05
      camera.lookAt(0, 0, 0)

      composer.render()
    }

    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      globalThis.removeEventListener('mousemove', handleMouseMove)
      gsap.killTweensOf('*')
      if (scrambleIntervalReference.current) {
        clearInterval(scrambleIntervalReference.current)
      }

      scene.traverse((object) => {
        if (object.userData.intervalId) {
          clearInterval(object.userData.intervalId as number)
        }
      })
      mountReference.current?.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return (
    <div ref={containerReference} className='main-container landing-page-body'>
      <Squares
        speed={0.25}
        squareSize={40}
        direction='up'
        borderColor='#4848483a'
        bgColor='rgba(32, 32, 32, 0.31)'
        hoverFillColor='#222222'
      />
      <div className='vignette' />
      <div ref={mountReference} className='canvas-section'></div>
      <section className='title-section'>
        <h1 ref={titleReference} className='meltdown-title'>
          LWV4ZXWU
        </h1>
      </section>
    </div>
  )
}
