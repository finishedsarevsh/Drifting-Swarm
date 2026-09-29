import { useRef, useState, useEffect, Suspense, Component, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html, Sphere, Cylinder, Ring } from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { useIntersection } from '../hooks/useIntersection'
import { Eye, RefreshCw, Lock, Radio, Zap, Play, Pause, RotateCcw, CheckCircle2, ArrowRight } from 'lucide-react'

const STEPS = [
  { id: 0, label: '01. Watch', title: 'Watch & Monitor', sub: 'Continuous dual-sentinel drift scoring', color: '#2563eb', pale: '#dbeafe', angle: 0, icon: <Eye size={16} /> },
  { id: 1, label: '02. Retrain', title: 'Deterministic Retrain', sub: 'Only drifted node claims lease', color: '#059669', pale: '#d1fae5', angle: 72, icon: <RefreshCw size={16} /> },
  { id: 2, label: '03. Compress & Sign', title: 'Compress & Cryptographically Sign', sub: 'Ed25519 signature + sparse ΔW', color: '#7c3aed', pale: '#ede9fe', angle: 144, icon: <Lock size={16} /> },
  { id: 3, label: '04. Broadcast', title: 'P2P MQTT Delta Broadcast', sub: 'Event-driven payload dissemination', color: '#d97706', pale: '#fef3c7', angle: 216, icon: <Radio size={16} /> },
  { id: 4, label: '05. Apply', title: 'Warm-Start Peer Assimilation', sub: 'Sub-15ms local gradient merge', color: '#0ea5e9', pale: '#e0f2fe', angle: 288, icon: <Zap size={16} /> },
]

const R = 2.4

// Error boundary to gracefully catch any WebGL context loss
class WebGLErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function StepNode3D({
  step,
  index,
  active,
  onClick
}: {
  step: typeof STEPS[0]
  index: number
  active: boolean
  onClick: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)
  const rad = (step.angle * Math.PI) / 180
  const x = Math.sin(rad) * R
  const z = Math.cos(rad) * R

  useFrame((state, delta) => {
    if (meshRef.current) {
      if (active) {
        meshRef.current.rotation.y += delta * 1.5
        const scale = 1 + 0.12 * Math.sin(state.clock.elapsedTime * 4)
        meshRef.current.scale.set(scale, scale, scale)
      } else if (hovered) {
        meshRef.current.scale.set(1.15, 1.15, 1.15)
      } else {
        meshRef.current.scale.set(1, 1, 1)
      }
    }
  })

  return (
    <group position={[x, 0, z]}>
      {/* Outer focus halo */}
      {active && (
        <Ring args={[0.45, 0.52, 32]} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color={step.color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </Ring>
      )}

      {/* Main Node Sphere */}
      <Sphere
        ref={meshRef}
        args={[0.34, 32, 32]}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <meshStandardMaterial
          color={step.color}
          roughness={0.2}
          metalness={0.5}
          emissive={active ? step.color : hovered ? step.color : '#0f172a'}
          emissiveIntensity={active ? 0.7 : hovered ? 0.4 : 0.1}
        />
      </Sphere>

      {/* High-contrast HTML Label that never fails to render */}
      <Html center position={[0, -0.65, 0]} pointerEvents="none">
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          userSelect: 'none', pointerEvents: 'none', whiteSpace: 'nowrap'
        }}>
          <span style={{
            fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700,
            padding: '2px 7px', borderRadius: 4,
            background: active ? step.color : 'rgba(255,255,255,0.92)',
            color: active ? '#ffffff' : 'var(--navy)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            border: `1px solid ${step.color}50`
          }}>
            {String(index + 1).padStart(2, '0')} {step.title.split(' ')[0]}
          </span>
        </div>
      </Html>
    </group>
  )
}

function AnimatedBeam3D({ fromAngle, toAngle, active }: { fromAngle: number; toAngle: number; active: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const r1 = (fromAngle * Math.PI) / 180
  const r2 = (toAngle * Math.PI) / 180
  const x1 = Math.sin(r1) * R, z1 = Math.cos(r1) * R
  const x2 = Math.sin(r2) * R, z2 = Math.cos(r2) * R

  const midX = (x1 + x2) / 2, midZ = (z1 + z2) / 2
  const len = Math.hypot(x2 - x1, z2 - z1)
  const angle = Math.atan2(x2 - x1, z2 - z1)

  useFrame((state) => {
    if (ref.current && active) {
      const mat = ref.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.4 + 0.3 * Math.sin(state.clock.elapsedTime * 6)
    }
  })

  return (
    <Cylinder
      ref={ref}
      args={[0.028, 0.028, len * 0.75, 8]}
      position={[midX, 0, midZ]}
      rotation={[0, angle, Math.PI / 2]}
    >
      <meshStandardMaterial
        color={active ? '#2563eb' : '#cbd5e1'}
        roughness={0.3}
        emissive={active ? '#2563eb' : '#000000'}
        emissiveIntensity={active ? 0.5 : 0}
        transparent
        opacity={active ? 0.95 : 0.35}
      />
    </Cylinder>
  )
}

function CentralCore3D() {
  const coreRef = useRef<THREE.Mesh>(null!)
  const ringRef = useRef<THREE.Mesh>(null!)

  useFrame((state, delta) => {
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.4
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.6
      ringRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.3
    }
  })

  return (
    <group>
      <Sphere ref={coreRef} args={[0.55, 32, 32]}>
        <meshStandardMaterial color="#1a2e4a" roughness={0.15} metalness={0.7} />
      </Sphere>
      <Ring ref={ringRef} args={[0.72, 0.78, 32]}>
        <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.6} />
      </Ring>
      <Html center position={[0, 0, 0]} pointerEvents="none">
        <div style={{
          textAlign: 'center', color: '#ffffff', fontFamily: 'Plus Jakarta Sans',
          fontWeight: 800, fontSize: 10, letterSpacing: '0.04em', lineHeight: 1.2,
          textShadow: '0 2px 4px rgba(0,0,0,0.6)', userSelect: 'none'
        }}>
          SWARM<br />CORE
        </div>
      </Html>
    </group>
  )
}

function SwarmScene3D({ activeStep, setActiveStep }: { activeStep: number; setActiveStep: (i: number) => void }) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 8, 6]} intensity={1.4} />
      <pointLight position={[-4, 4, -4]} intensity={0.8} color="#2563eb" />
      <pointLight position={[4, 4, 4]} intensity={0.6} color="#059669" />

      {/* OrbitControls for user exploration */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        maxPolarAngle={Math.PI / 2.15}
        minPolarAngle={Math.PI / 5}
        rotateSpeed={0.6}
      />

      <CentralCore3D />

      {/* 5 Orbiting Nodes */}
      {STEPS.map((step, i) => (
        <StepNode3D
          key={step.id}
          step={step}
          index={i}
          active={activeStep === i}
          onClick={() => setActiveStep(i)}
        />
      ))}

      {/* Interconnecting Beams */}
      {STEPS.map((step, i) => {
        const next = STEPS[(i + 1) % STEPS.length]
        const isActiveBeam = activeStep === i || activeStep === (i + 1) % STEPS.length
        return (
          <AnimatedBeam3D
            key={i}
            fromAngle={step.angle}
            toAngle={next.angle}
            active={isActiveBeam}
          />
        )
      })}
    </>
  )
}

// Seamless 2D Orbital Radar Fallback if WebGL has issues
function FallbackOrbitalView({ activeStep, setActiveStep }: { activeStep: number; setActiveStep: (i: number) => void }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="-140 -140 280 280" style={{ width: '90%', height: '90%' }}>
        {/* Orbit track */}
        <circle cx="0" cy="0" r="100" fill="none" stroke="var(--border)" strokeWidth="2" strokeDasharray="4 4" />

        {/* Connector lines */}
        {STEPS.map((step, i) => {
          const next = STEPS[(i + 1) % STEPS.length]
          const r1 = (step.angle * Math.PI) / 180
          const r2 = (next.angle * Math.PI) / 180
          const x1 = Math.sin(r1) * 100, y1 = Math.cos(r1) * 100
          const x2 = Math.sin(r2) * 100, y2 = Math.cos(r2) * 100
          const isAct = activeStep === i
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isAct ? 'var(--blue)' : 'var(--border)'}
              strokeWidth={isAct ? '3' : '1.5'}
            />
          )
        })}

        {/* Center core */}
        <circle cx="0" cy="0" r="28" fill="var(--navy)" />
        <text x="0" y="4" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="Plus Jakarta Sans">
          CORE
        </text>

        {/* 5 Nodes */}
        {STEPS.map((step, i) => {
          const r = (step.angle * Math.PI) / 180
          const x = Math.sin(r) * 100, y = Math.cos(r) * 100
          const isAct = activeStep === i
          return (
            <g key={step.id} onClick={() => setActiveStep(i)} style={{ cursor: 'pointer' }}>
              {isAct && <circle cx={x} cy={y} r="22" fill="none" stroke={step.color} strokeWidth="2" opacity="0.5" />}
              <circle cx={x} cy={y} r="16" fill={step.color} />
              <text x={x} y={y + 3} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">
                {String(i + 1).padStart(2, '0')}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function Methodology({ id }: { id: string }) {
  const { ref, visible } = useIntersection()
  const [activeStep, setActiveStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Auto-play cycle feature for live presentation demonstration
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % STEPS.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [isPlaying])

  const STEP_DETAILS = [
    {
      step: '01',
      title: 'Phase 01 — Continuous Decentralized Sensing',
      desc: 'Each node continuously evaluates incoming epidemiological data batches using dual-sentinel sentinels (PSI macro shifts and River ADWIN loss tracking). Zero raw telemetry leaves the regional host.',
      technical: 'Formula: PSI = Σ (Aᵢ − Eᵢ) · ln(Aᵢ / Eᵢ). When PSI crosses τ=0.05, a drift event flag is triggered.',
      metric: 'Evaluated locally in < 3ms per batch · 0 bytes transmitted',
      color: 'var(--blue)',
      pale: 'var(--blue-pale)',
    },
    {
      step: '02',
      title: 'Phase 02 — Atomic Lease Arbitration',
      desc: 'The drifted node submits a lightweight compare-and-swap lease request (POST /claim) to the ledger service. Exactly one node wins the retrain lease per epoch, deterministically eliminating split-brain races.',
      technical: 'SQLite UNIQUE constraint on epoch_id provides hardware-level atomicity. Winners proceed to retrain; losers absorb the update.',
      metric: 'Arbitration latency < 2ms · zero concurrent retrain collisions',
      color: 'var(--emerald)',
      pale: 'var(--emerald-pale)',
    },
    {
      step: '03',
      title: 'Phase 03 — Sparse Fine-Tuning & Cryptographic Signing',
      desc: 'The winning node warm-starts a LightGBM fine-tune on its local shifted cohort. The resulting weight update ΔW is sparsified, float16 quantized, and signed using an Ed25519 asymmetric private key.',
      technical: 'LightGBM warm_start=True adds 50 trees. Sparsity gating filters negligible gradients, shrinking ΔW to < 5 KB.',
      metric: 'Payload compressed to < 5 KB · Ed25519 signature tamper-proof',
      color: 'var(--violet)',
      pale: 'var(--violet-pale)',
    },
    {
      step: '04',
      title: 'Phase 04 — Peer-to-Peer MQTT Dissemination',
      desc: 'The signed delta package is broadcast to the swarm topic swarm/deltas/<epoch_id> over Mosquitto MQTT. All peer nodes receive the payload simultaneously via pub/sub with sub-15ms latency.',
      technical: 'Topic format: swarm/deltas/{boot_uuid}-{node_id}-{year}-{counter}. Lightweight payload easily traverses low-bandwidth edge connections.',
      metric: 'Network transfer time < 8ms across all 6 nodes',
      color: 'var(--amber)',
      pale: 'var(--amber-pale)',
    },
    {
      step: '05',
      title: 'Phase 05 — Warm-Start Peer Assimilation',
      desc: 'Receiving nodes verify the Ed25519 public key signature, decode the sparse float16 weights, and merge ΔW directly into their local LightGBM model memory without performing full training.',
      technical: 'Peers update their model version and update their ledger version state, instantly acquiring global resilience without seeing remote data.',
      metric: 'Peer apply latency < 15ms · 83% compute reduction vs scheduled FL',
      color: 'var(--sky)',
      pale: 'var(--sky-pale)',
    },
  ]

  const activeDetail = STEP_DETAILS[activeStep]

  return (
    <section id={id} className="section-block bg-alt" ref={ref}>
      <div className="container-xl w-full">
        {/* Centered Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          style={{ textAlign: 'center', marginBottom: 44 }}
        >
          <div className="section-badge mb-4 mx-auto" style={{ display: 'inline-flex' }}>
            Section 06 — Architecture Methodology
          </div>
          <h2 className="text-section-title mb-4" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            The 5-Step Synchronization Loop
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 580, margin: '0 auto', lineHeight: 1.75, fontSize: '1.05rem' }}>
            An event-driven closed loop that converts regional distribution drift into a verified global model synchronization in milliseconds.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(320px, 1fr)', gap: 32, alignItems: 'stretch' }}>
          {/* Left Column: 3D Visualization Container */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={visible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.15 }}
            className="card"
            style={{
              height: 480,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              background: 'radial-gradient(ellipse at 50% 50%, #ffffff 0%, #f1f5f9 100%)',
            }}
          >
            {/* Top Toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--border)',
              background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(10px)',
              zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="text-label" style={{ color: 'var(--navy)' }}>3D Swarm Orbit</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)' }}>
                  (Click or drag to rotate)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="btn-ghost"
                  style={{
                    padding: '5px 12px', fontSize: 11,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: isPlaying ? 'var(--blue-pale)' : 'var(--surface)',
                    borderColor: isPlaying ? 'var(--blue)' : 'var(--border)',
                    color: isPlaying ? 'var(--blue)' : 'var(--text-secondary)'
                  }}
                  title={isPlaying ? 'Pause auto sequence' : 'Play automated 5-step loop'}
                >
                  {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                  <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{isPlaying ? 'PAUSE' : 'AUTO-PLAY'}</span>
                </button>
                <button
                  onClick={() => setActiveStep(0)}
                  className="btn-ghost"
                  style={{ padding: '5px 8px' }}
                  title="Reset to Phase 1"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>

            {/* 3D WebGL Canvas with Fallback */}
            <div style={{ flex: 1, position: 'relative' }}>
              <WebGLErrorBoundary fallback={<FallbackOrbitalView activeStep={activeStep} setActiveStep={setActiveStep} />}>
                <Suspense fallback={<FallbackOrbitalView activeStep={activeStep} setActiveStep={setActiveStep} />}>
                  <Canvas
                    camera={{ position: [0, 4.2, 5.8], fov: 44 }}
                    style={{ width: '100%', height: '100%', display: 'block' }}
                  >
                    <SwarmScene3D activeStep={activeStep} setActiveStep={setActiveStep} />
                  </Canvas>
                </Suspense>
              </WebGLErrorBoundary>
            </div>

            {/* Bottom active step indicator */}
            <div style={{
              padding: '10px 18px', background: 'rgba(255, 255, 255, 0.9)',
              borderTop: '1px solid var(--border)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeDetail.color }} />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                  Active: {activeDetail.title}
                </span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-muted)' }}>
                Phase {activeStep + 1} of 5
              </span>
            </div>
          </motion.div>

          {/* Right Column: Step Selector Buttons + Deep Dive Card */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={visible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.25 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {/* 5 Interactive Phase Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STEPS.map((s, i) => {
                const isSelected = activeStep === i
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveStep(i)
                      setIsPlaying(false)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 18px', borderRadius: 12,
                      background: isSelected ? s.pale : 'var(--surface)',
                      border: isSelected ? `2px solid ${s.color}` : '1px solid var(--border)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? `0 6px 20px ${s.color}20` : 'var(--shadow-xs)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: isSelected ? s.color : 'var(--surface-3)',
                        color: isSelected ? '#ffffff' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.2s'
                      }}>
                        {s.icon}
                      </div>
                      <div>
                        <div style={{
                          fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 14,
                          color: isSelected ? 'var(--navy)' : 'var(--text-primary)'
                        }}>
                          {s.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {s.sub}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <ArrowRight size={16} color={s.color} style={{ flexShrink: 0 }} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Deep Technical Explanation Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="card"
                style={{
                  padding: 22,
                  borderLeft: `4px solid ${activeDetail.color}`,
                  borderRadius: '0 16px 16px 0',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CheckCircle2 size={16} color={activeDetail.color} />
                  <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>
                    {activeDetail.title}
                  </span>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 14 }}>
                  {activeDetail.desc}
                </p>
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                  marginBottom: 12
                }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)', marginBottom: 2 }}>
                    ALGORITHMIC SPECIFICATION
                  </div>
                  <code style={{ fontFamily: 'JetBrains Mono', fontSize: 11.5, color: activeDetail.color, lineHeight: 1.6 }}>
                    {activeDetail.technical}
                  </code>
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 100,
                  background: activeDetail.pale, color: activeDetail.color,
                  fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono'
                }}>
                  {activeDetail.metric}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export function DriftDetectionEngine({ id }: { id: string }) {
  const { ref, visible } = useIntersection()

  return (
    <section id={id} className="section-block bg-white" ref={ref}>
      <div className="container-xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <div className="section-badge mb-4 mx-auto" style={{ display: 'inline-flex', background: 'var(--violet-pale)', borderColor: 'var(--violet-pale)', color: 'var(--violet)' }}>
            Section 07 — Detection Engine
          </div>
          <h2 className="text-section-title mb-4" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            Dual-Signal Drift Sentinel Architecture
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto', lineHeight: 1.75, fontSize: '1.05rem' }}>
            Two complementary algorithms run concurrently to catch both sudden cohort shifts and gradual decay.
          </p>
        </motion.div>

        <div className="grid-2">
          {[
            {
              label: 'PSI — Population Stability Index',
              badge: 'Macro Cohort Sentinel',
              code: 'PSI_THRESHOLD = 0.05',
              color: 'var(--blue)',
              pale: 'var(--blue-pale)',
              formula: 'PSI = Σ (Actual_pct − Expected_pct) × ln(Actual_pct / Expected_pct)',
              desc: 'Statistically sensitive metric calibrated to detect population distribution shifts between sequential survey years across demographic, behavioral, and clinical features.',
              why: 'Auditable and mathematically grounded. A score > 0.05 indicates legitimate epidemiological drift, prompting a lease claim.',
            },
            {
              label: 'River ADWIN — Adaptive Windowing',
              badge: 'Real-time Loss Sentinel',
              code: 'delta δ = 0.002',
              color: 'var(--emerald)',
              pale: 'var(--emerald-pale)',
              formula: 'ADWIN: P(|μ_window1 − μ_window2| ≥ ε) ≤ δ',
              desc: 'Streaming sliding-window algorithm that tracks loss degradation over sequential batches. Detects subtle, gradual concept decay that discrete annual histograms miss.',
              why: 'Dynamically expands and contracts memory based on stream variance. Provides immediate zero-delay detection of accuracy anomalies.',
            },
          ].map((d, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              animate={visible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, delay: 0.2 + i * 0.15 }}
              className="card-elevated"
              style={{ padding: 28 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span className="badge-pill" style={{ background: d.pale, color: d.color, border: `1px solid ${d.color}30` }}>
                  {d.badge}
                </span>
                <code style={{ fontFamily: 'JetBrains Mono', fontSize: 11, background: 'var(--surface-3)', padding: '4px 10px', borderRadius: 6, color: d.color, border: '1px solid var(--border)' }}>
                  {d.code}
                </code>
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 17, color: 'var(--navy)', marginBottom: 10, fontFamily: 'Plus Jakarta Sans' }}>
                {d.label}
              </h3>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 16 }}>
                {d.desc}
              </p>
              <div className="card-inset" style={{ padding: '14px 16px', textAlign: 'center', marginBottom: 16 }}>
                <code style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: d.color, lineHeight: 1.8 }}>
                  {d.formula}
                </code>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 10, background: d.pale, borderLeft: `3px solid ${d.color}` }}>
                <p className="text-label mb-1" style={{ color: d.color }}>Why It Matters</p>
                <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.6 }}>{d.why}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
