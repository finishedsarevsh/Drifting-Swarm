import { useState } from 'react'
import { motion } from 'framer-motion'
import { useIntersection } from '../hooks/useIntersection'

export function AnalogyModel({ id }: { id: string }) {
  const { ref, visible } = useIntersection()
  const [wx, setWx] = useState(2)
  const [wy, setWy] = useState(3)

  const size = 300, scale = 24, cx = size/2, cy = size/2
  const getY = (x: number) => (wy !== 0 ? -(wx*x)/wy : 0)
  const toSc  = (x: number, y: number) => ({ sx: cx+x*scale, sy: cy-y*scale })

  const pts = [
    {x:-3,y:2,l:0},{x:-2,y:0.9,l:0},{x:-1.5,y:0.3,l:0},{x:0.2,y:1.2,l:0},{x:-0.5,y:-0.1,l:1},
    {x:2,y:-1.5,l:1},{x:3,y:-2.1,l:1},{x:1.5,y:-0.6,l:1},{x:-2.5,y:-0.4,l:1},{x:1,y:0.6,l:0},
  ]

  const lineX1=-5,lineX2=5
  const {sx:sx1,sy:sy1}=toSc(lineX1,getY(lineX1))
  const {sx:sx2,sy:sy2}=toSc(lineX2,getY(lineX2))

  return (
    <section id={id} className="section-block bg-white" ref={ref}>
      <div className="container-xl w-full">
        <motion.div
          initial={{opacity:0,y:28}} animate={visible?{opacity:1,y:0}:{}}
          transition={{duration:0.7}} style={{textAlign:'center',marginBottom:52}}
        >
          <div className="section-badge mb-6 mx-auto" style={{display:'inline-flex'}}>
            Section 02 — The Model
          </div>
          <h2 className="text-section-title mb-4" style={{fontSize:'clamp(1.9rem,3.5vw,3rem)'}}>
            What is a Machine Learning Model?
          </h2>
          <p style={{color:'var(--text-secondary)',maxWidth:500,margin:'0 auto',lineHeight:1.75,fontSize:'1.05rem'}}>
            Strip away complexity. At its core, every ML model solves a weighted equation.
          </p>
        </motion.div>

        <div className="grid-2">
          {/* SVG visualization */}
          <motion.div
            initial={{opacity:0,x:-28}} animate={visible?{opacity:1,x:0}:{}}
            transition={{duration:0.65,delay:0.15}} className="card" style={{padding:24}}
          >
            <p className="text-label mb-4" style={{color:'var(--blue)'}}>Interactive Decision Boundary</p>
            <svg width={size} height={size} style={{display:'block',margin:'0 auto',borderRadius:8,background:'var(--surface-2)',border:'1px solid var(--border)'}}>
              {/* Grid lines */}
              {[-4,-2,0,2,4].map(v=>{
                const{sx}=toSc(v,0),{sy}=toSc(0,v)
                return <g key={v}>
                  <line x1={sx} y1={0} x2={sx} y2={size} stroke="var(--border)" strokeWidth={1}/>
                  <line x1={0} y1={sy} x2={size} y2={sy} stroke="var(--border)" strokeWidth={1}/>
                </g>
              })}
              {/* Axes */}
              <line x1={0} y1={cy} x2={size} y2={cy} stroke="var(--border-mid)" strokeWidth={1.5}/>
              <line x1={cx} y1={0} x2={cx} y2={size} stroke="var(--border-mid)" strokeWidth={1.5}/>
              {/* Axis labels */}
              <text x={size-16} y={cy-6} fontSize={10} fill="var(--text-faint)" fontFamily="monospace">x</text>
              <text x={cx+5}   y={12}   fontSize={10} fill="var(--text-faint)" fontFamily="monospace">y</text>
              {/* Decision boundary */}
              <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke="var(--blue)" strokeWidth={2.5} strokeDasharray="8,4"/>
              {/* Data points */}
              {pts.map((p,i)=>{
                const{sx,sy}=toSc(p.x,p.y)
                const wrongSide=(p.l===0&&p.x>cx/scale+0.5)||(p.l===1&&p.x<cx/scale-0.5)
                return <circle key={i} cx={sx} cy={sy} r={6}
                  fill={p.l===0?'var(--emerald)':'var(--blue)'}
                  fillOpacity={wrongSide?0.9:0.75}
                  stroke={wrongSide?'var(--crimson)':'transparent'} strokeWidth={2}
                />
              })}
            </svg>

            {/* Sliders */}
            <div style={{marginTop:20,display:'flex',flexDirection:'column',gap:14}}>
              {[{label:'Weight W₁ (for x)',val:wx,set:setWx},{label:'Weight W₂ (for y)',val:wy,set:setWy}].map(s=>(
                <div key={s.label}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontFamily:'JetBrains Mono',fontSize:11,color:'var(--text-muted)'}}>{s.label}</span>
                    <span style={{fontFamily:'JetBrains Mono',fontSize:13,fontWeight:700,color:'var(--blue)'}}>{s.val}</span>
                  </div>
                  <input type="range" min={-5} max={5} step={0.5} value={s.val}
                    onChange={e=>s.set(Number(e.target.value)||0.1)}
                    style={{width:'100%',accentColor:'var(--blue)'}}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Formula breakdown */}
          <motion.div
            initial={{opacity:0,x:28}} animate={visible?{opacity:1,x:0}:{}}
            transition={{duration:0.65,delay:0.25}}
          >
            {/* Live equation */}
            <div className="card" style={{padding:28,textAlign:'center',marginBottom:20,background:'var(--navy)'}}>
              <p style={{fontFamily:'JetBrains Mono',fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:8,letterSpacing:'0.1em'}}>CURRENT EQUATION</p>
              <div style={{fontFamily:'JetBrains Mono',fontSize:28,fontWeight:700,color:'#fff',letterSpacing:'-0.01em'}}>
                <span style={{color:'#93c5fd'}}>{wx}</span>
                <span style={{color:'rgba(255,255,255,0.5)'}}>x + </span>
                <span style={{color:'#93c5fd'}}>{wy}</span>
                <span style={{color:'rgba(255,255,255,0.5)'}}>y = </span>
                <span style={{color:'#6ee7b7'}}>0</span>
              </div>
              <p style={{fontFamily:'JetBrains Mono',fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:8}}>Decision boundary equation</p>
            </div>

            {/* Component breakdown */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {[
                {sym:'x, y', label:'Input Features', ex:'Patient BMI, blood pressure, age — the observable signals.',col:'var(--text-secondary)'},
                {sym:`${wx}, ${wy}`, label:'Model Weights (W)', ex:'Learned coefficients tuned during training — the model\'s "knowledge".',col:'var(--blue)'},
                {sym:'= 0', label:'Classification Threshold', ex:'The boundary separating positive and negative predictions.',col:'var(--emerald)'},
              ].map((r,i)=>(
                <div key={i} className="card-inset" style={{padding:'16px 20px',display:'flex',gap:16,alignItems:'flex-start'}}>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:18,fontWeight:700,color:r.col,minWidth:40}}>{r.sym}</div>
                  <div>
                    <div style={{fontWeight:600,fontSize:14,color:'var(--text-primary)',marginBottom:4}}>{r.label}</div>
                    <div style={{fontSize:13,color:'var(--text-muted)',lineHeight:1.6}}>{r.ex}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{marginTop:16,padding:'16px 20px',borderLeft:'4px solid var(--emerald)',borderRadius:'0 12px 12px 0'}}>
              <p className="text-label mb-2">Key insight</p>
              <p style={{fontSize:13,color:'var(--text-secondary)',lineHeight:1.65}}>
                Drag the sliders above. The decision boundary shifts — that is exactly what retraining does:
                adjusting <strong>W</strong> to fit a new data distribution.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
