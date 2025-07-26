'use client'

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial, Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { motion } from 'framer-motion'

interface AudioVisualization3DProps {
  isUserSpeaking: boolean
  isAISpeaking: boolean
  audioLevel: number
  playbackLevel: number
  isConnected: boolean
}

// Audio-reactive globe
function AudioGlobe({ isUserSpeaking, isAISpeaking, audioLevel }: {
  isUserSpeaking: boolean
  isAISpeaking: boolean
  audioLevel: number
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  
  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime
      
      if (isUserSpeaking) {
        // User speaking - green with audio-reactive distortion
        meshRef.current.rotation.y = time * 0.8
        meshRef.current.rotation.x = Math.sin(time * 0.5) * 0.2
      } else if (isAISpeaking) {
        // AI speaking - blue with faster rotation
        meshRef.current.rotation.y = time * 1.5
        meshRef.current.rotation.x = Math.sin(time * 0.8) * 0.3
      } else {
        // Idle - slow rotation
        meshRef.current.rotation.y = time * 0.3
        meshRef.current.rotation.x = Math.sin(time * 0.2) * 0.1
      }
    }
  })

  const globeColor = isUserSpeaking 
    ? '#10b981' // Green for user
    : isAISpeaking 
      ? '#3b82f6' // Blue for AI
      : '#8b5cf6' // Purple for idle

  const distortAmount = isUserSpeaking 
    ? 0.4 + (audioLevel / 100) * 0.3 
    : isAISpeaking 
      ? 0.5 
      : 0.2

  return (
    <Sphere ref={meshRef} args={[2.5, 64, 64]} scale={1}>
      <MeshDistortMaterial
        color={globeColor}
        attach="material"
        distort={distortAmount}
        speed={isUserSpeaking ? 2.0 : isAISpeaking ? 1.8 : 1.0}
        roughness={0.2}
        metalness={0.8}
        emissive={globeColor}
        emissiveIntensity={isUserSpeaking || isAISpeaking ? 0.3 : 0.1}
      />
    </Sphere>
  )
}

// Floating dots around the globe
function FloatingDots({ isUserSpeaking, isAISpeaking, audioLevel }: {
  isUserSpeaking: boolean
  isAISpeaking: boolean
  audioLevel: number
}) {
  const pointsRef = useRef<THREE.Points>(null!)

  // Generate points in a sphere distribution
  const particlePositions = useMemo(() => {
    const positions = new Float32Array(150 * 3)
    
    for (let i = 0; i < 150; i++) {
      const radius = 4 + Math.random() * 2
      const phi = Math.acos(-1 + (2 * i) / 150)
      const theta = Math.sqrt(150 * Math.PI) * phi
      
      positions[i * 3] = radius * Math.cos(theta) * Math.sin(phi)
      positions[i * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi)
      positions[i * 3 + 2] = radius * Math.cos(phi)
    }
    
    return positions
  }, [])

  useFrame((state) => {
    if (pointsRef.current) {
      const time = state.clock.elapsedTime
      
      if (isUserSpeaking) {
        // User speaking - pulsing dots
        pointsRef.current.rotation.y = time * 0.5
        const scale = 1 + (audioLevel / 100) * 0.5
        pointsRef.current.scale.set(scale, scale, scale)
      } else if (isAISpeaking) {
        // AI speaking - flowing motion
        pointsRef.current.rotation.y = time * 0.8
        pointsRef.current.rotation.x = Math.sin(time * 0.6) * 0.2
        pointsRef.current.scale.set(1.2, 1.2, 1.2)
      } else {
        // Idle - gentle drift
        pointsRef.current.rotation.y = time * 0.2
        pointsRef.current.scale.set(1, 1, 1)
      }
    }
  })

  const dotColor = isUserSpeaking 
    ? '#10b981' // Green for user
    : isAISpeaking 
      ? '#3b82f6' // Blue for AI
      : '#8b5cf6' // Purple for idle

  const dotSize = isUserSpeaking || isAISpeaking ? 0.08 : 0.05

  return (
    <Points ref={pointsRef} positions={particlePositions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color={dotColor}
        size={dotSize}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={isUserSpeaking || isAISpeaking ? 0.9 : 0.6}
      />
    </Points>
  )
}

function Scene({ isUserSpeaking, isAISpeaking, audioLevel }: {
  isUserSpeaking: boolean
  isAISpeaking: boolean
  audioLevel: number
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />
      
      <AudioGlobe 
        isUserSpeaking={isUserSpeaking}
        isAISpeaking={isAISpeaking}
        audioLevel={audioLevel}
      />
      <FloatingDots 
        isUserSpeaking={isUserSpeaking}
        isAISpeaking={isAISpeaking}
        audioLevel={audioLevel}
      />
    </>
  )
}

export function AudioVisualization3D({
  isUserSpeaking,
  isAISpeaking,
  audioLevel,
  playbackLevel,
  isConnected
}: AudioVisualization3DProps) {
  const maxAudioLevel = Math.max(audioLevel, playbackLevel)

  return (
    <motion.div
      className="w-full h-full relative"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <Scene 
          isUserSpeaking={isUserSpeaking}
          isAISpeaking={isAISpeaking}
          audioLevel={maxAudioLevel}
        />
      </Canvas>
      
    </motion.div>
  )
}