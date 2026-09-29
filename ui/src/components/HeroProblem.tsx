import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Lock, TrendingDown, Cpu, ChevronDown } from 'lucide-react'

const TRILEMMA = [
  {
    icon: <Lock size={20} />,
    title: 'Data Cannot Move',
    body: 'GDPR, CCPA, and HIPAA compliance — combined with competitive risk — strictly prohibit pooling raw records across organizational boundaries.',
    accent: 'var(--crimson)', pale: 'var(--crimson-pale)',
  },
  {
    icon: <TrendingDown size={20} />,
    title: 'The World Drifts',
    body: 'Customer behavior, fraud patterns, and disease profiles evolve continuously. A model trained yesterday is already degrading today.',
    accent: 'var(--amber)', pale: 'var(--amber-pale)',
  },
  {
    icon: <Cpu size={20} />,
    title: 'Retraining is Broken',
    body: 'Central retraining violates data residency. Standard Federated Learning burns excessive compute retraining every node — even unaffected ones.',
    accent: 'var(--violet)', pale: 'var(--violet-pale)',
  },
]

export function HeroProblem({ id }: { id: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)

    const pts = Array.from({ length: 45 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => {
        p.x = (p.x + p.vx + canvas.width) % canvas.width
        p.y = (p.y + p.vy + canvas.height) % canvas.height
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(37,99,235,0.18)'; ctx.fill()
      })
      pts.forEach((a, i) => pts.slice(i+1).forEach(b => {
        const d = Math.hypot(a.x-b.x, a.y-b.y)
        if (d < 110) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(37,99,235,${0.06*(1-d/110)})`
          ctx.lineWidth = 0.8; ctx.stroke()
        }
      }))
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <section id={id} className="section-block bg-blue-tint" style={{position:'relative',overflow:'hidden'}}>
      <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}} />

      <div className="container-xl w-full relative" style={{zIndex:1}}>
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{textAlign:'center',marginBottom:56}}
        >
          <div className="section-badge mb-6 mx-auto" style={{display:'inline-flex'}}>
            Section 01 — The Problem
          </div>

          <h1 className="text-hero mb-6" style={{fontSize:'clamp(2.6rem,5.5vw,4.4rem)',maxWidth:760,margin:'0 auto 20px'}}>
            Enterprise ML Faces an<br />
            <span style={{color:'var(--blue)'}}>Impossible Trilemma</span>
          </h1>

          <p style={{fontSize:'1.1rem',lineHeight:1.75,color:'var(--text-secondary)',maxWidth:560,margin:'0 auto'}}>
            Three irreconcilable constraints trap every distributed ML system.
            Until now, enterprises were forced to sacrifice one.
          </p>
        </motion.div>

        {/* Trilemma cards */}
        <div className="grid-3 mb-10">
          {TRILEMMA.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 + i * 0.12 }}
              className="card-elevated"
              style={{padding:28}}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: t.pale,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: t.accent, marginBottom: 16,
              }}>
                {t.icon}
              </div>
              <h3 style={{fontWeight:700,fontSize:16,color:'var(--text-primary)',marginBottom:10,fontFamily:'Plus Jakarta Sans'}}>
                {t.title}
              </h3>
              <p style={{fontSize:14,color:'var(--text-secondary)',lineHeight:1.7}}>{t.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Core insight callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="card"
          style={{
            maxWidth: 680, margin: '0 auto',
            padding: '28px 36px',
            borderLeft: '4px solid var(--blue)',
            borderRadius: '0 16px 16px 0',
          }}
        >
          <p className="text-label mb-3">Core constraint</p>
          <p style={{fontSize:'1.05rem',lineHeight:1.72,color:'var(--text-secondary)',fontStyle:'italic'}}>
            "You cannot pool data. But distributed models silently decay as local realities diverge.
            The only known cure — full network retraining — is computationally wasteful and legally prohibited."
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
          style={{textAlign:'center',marginTop:48}}
        >
          <div style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:6,color:'var(--text-faint)'}}>
            <span style={{fontFamily:'JetBrains Mono',fontSize:11,letterSpacing:'0.1em',textTransform:'uppercase'}}>
              Scroll to explore
            </span>
            <ChevronDown size={16} style={{animation:'pulse-green 2s infinite'}} />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
