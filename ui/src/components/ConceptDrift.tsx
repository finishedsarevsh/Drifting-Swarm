import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useIntersection } from '../hooks/useIntersection'
import { AlertTriangle } from 'lucide-react'

function DriftCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const driftRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    c.width = 400; c.height = 260
    const CX = c.width/2, CY = c.height/2

    const pts = Array.from({length:48},(_,i)=>({
      ox: CX+(Math.random()-0.5)*280,
      oy: CY+(Math.random()-0.5)*180,
      x:0,y:0,l:i<24?0:1,
      vx:(Math.random()-0.5)*0.4, vy:(Math.random()-0.5)*0.3,
    }))
    pts.forEach(p=>{p.x=p.ox;p.y=p.oy})

    const draw = ()=>{
      const d=driftRef.current
      ctx.clearRect(0,0,c.width,c.height)

      // Grid
      ctx.strokeStyle='rgba(226,232,240,0.8)'; ctx.lineWidth=1
      for(let x=0;x<c.width;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke()}
      for(let y=0;y<c.height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke()}

      // Static boundary
      ctx.beginPath();ctx.moveTo(CX-80,40);ctx.lineTo(CX+80,c.height-40)
      ctx.strokeStyle='rgba(37,99,235,0.6)';ctx.lineWidth=2.5;ctx.setLineDash([10,5]);ctx.stroke();ctx.setLineDash([])
      ctx.font='10px monospace';ctx.fillStyle='rgba(37,99,235,0.55)';ctx.fillText('Model boundary (static)',CX-70,34)

      pts.forEach(p=>{
        if(d>0){
          p.x=p.ox+(p.l===0?-d*90:d*90)+p.vx*d*20
          p.y=p.oy+(p.l===0?-d*30:d*30)+p.vy*d*10
        } else {
          p.x+=(p.ox-p.x)*0.06; p.y+=(p.oy-p.y)*0.06
        }
        const wrong=(p.l===0&&p.x>CX+15)||(p.l===1&&p.x<CX-15)
        ctx.beginPath();ctx.arc(p.x,p.y,5.5,0,Math.PI*2)
        ctx.fillStyle=wrong?'rgba(220,38,38,0.85)':p.l===0?'rgba(5,150,105,0.8)':'rgba(37,99,235,0.8)'
        ctx.fill()
        if(wrong){ctx.strokeStyle='rgba(220,38,38,0.6)';ctx.lineWidth=1.5;ctx.stroke()}
      })

      const errs=pts.filter(p=>(p.l===0&&p.x>CX+15)||(p.l===1&&p.x<CX-15)).length
      const pct=Math.round(errs/pts.length*100)
      ctx.fillStyle='#64748b';ctx.font='11px monospace';ctx.fillText(`Error rate: ${pct}%`,10,c.height-12)
      ctx.fillStyle='rgba(226,232,240,0.9)';ctx.fillRect(10,c.height-30,110,8)
      ctx.fillStyle=pct>25?'#dc2626':'#059669';ctx.fillRect(10,c.height-30,110*pct/100,8)

      rafRef.current=requestAnimationFrame(draw)
    }
    draw()
    return ()=>cancelAnimationFrame(rafRef.current)
  },[])

  useEffect(()=>{
    let t=0
    const step=()=>{
      t=active?Math.min(t+0.018,1):Math.max(t-0.02,0)
      driftRef.current=t
      rafRef.current=requestAnimationFrame(step)
    }
    step()
    return ()=>cancelAnimationFrame(rafRef.current)
  },[active])

  return <canvas ref={canvasRef} style={{borderRadius:8,maxWidth:'100%',display:'block'}}/>
}

export function ConceptDrift({ id }:{ id:string }) {
  const { ref, visible } = useIntersection()
  const [driftOn, setDriftOn] = useState(false)

  return (
    <section id={id} className="section-block bg-alt" ref={ref}>
      <div className="container-xl w-full">
        <motion.div
          initial={{opacity:0,y:28}} animate={visible?{opacity:1,y:0}:{}}
          transition={{duration:0.7}} style={{textAlign:'center',marginBottom:52}}
        >
          <div className="section-badge mb-6 mx-auto" style={{display:'inline-flex',background:'var(--crimson-pale)',borderColor:'var(--crimson-pale)',color:'var(--crimson)'}}>
            Section 03 — Concept Drift
          </div>
          <h2 className="text-section-title mb-4" style={{fontSize:'clamp(1.9rem,3.5vw,3rem)'}}>
            What Happens When the World Changes?
          </h2>
          <p style={{color:'var(--text-secondary)',maxWidth:520,margin:'0 auto',lineHeight:1.75,fontSize:'1.05rem'}}>
            The model's weights freeze at historical reality while the underlying distribution
            silently drifts — no runtime error, no warning.
          </p>
        </motion.div>

        <div className="grid-2">
          <motion.div
            initial={{opacity:0,x:-28}} animate={visible?{opacity:1,x:0}:{}}
            transition={{duration:0.65,delay:0.15}} className="card" style={{padding:24}}
          >
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <span className="text-label" style={{color:'var(--crimson)'}}>Distribution Shift Simulator</span>
              {driftOn && (
                <span className="badge-pill" style={{background:'var(--crimson-pale)',color:'var(--crimson)',border:'1px solid var(--crimson-pale)'}}>
                  <span style={{width:6,height:6,borderRadius:'50%',background:'var(--crimson)',display:'inline-block',animation:'pulse-red 0.8s infinite'}}/>
                  Drift Active
                </span>
              )}
            </div>
            <DriftCanvas active={driftOn}/>
            <button
              onClick={()=>setDriftOn(d=>!d)}
              style={{
                marginTop:16, width:'100%', padding:'12px 0',
                borderRadius:10, border:'none', cursor:'pointer',
                fontWeight:600, fontSize:14, fontFamily:'Inter',
                background: driftOn ? 'var(--crimson-pale)' : 'var(--emerald-pale)',
                color: driftOn ? 'var(--crimson)' : 'var(--emerald)',
                transition:'all 0.2s',
              }}
            >
              {driftOn ? 'Reset to Original Distribution' : 'Inject Distribution Shift'}
            </button>
          </motion.div>

          <motion.div
            initial={{opacity:0,x:28}} animate={visible?{opacity:1,x:0}:{}}
            transition={{duration:0.65,delay:0.25}}
            style={{display:'flex',flexDirection:'column',gap:16}}
          >
            <div className="card" style={{padding:24}}>
              <p className="text-label mb-3" style={{color:'var(--emerald)'}}>Before Drift</p>
              <div style={{fontFamily:'JetBrains Mono',fontSize:22,fontWeight:700,color:'var(--navy)',marginBottom:10}}>2x + 3y = 0</div>
              <p style={{fontSize:14,color:'var(--text-secondary)',lineHeight:1.65}}>
                Model weights perfectly align with the data distribution. Classification accuracy is high.
              </p>
            </div>

            <div style={{display:'flex',justifyContent:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 16px',borderRadius:8,background:'var(--crimson-pale)'}}>
                <AlertTriangle size={14} color="var(--crimson)"/>
                <span style={{fontSize:12,fontWeight:600,color:'var(--crimson)',fontFamily:'JetBrains Mono'}}>Distribution Shift</span>
              </div>
            </div>

            <div className="card" style={{padding:24,borderLeft:'4px solid var(--crimson)',borderRadius:'0 16px 16px 0'}}>
              <p className="text-label mb-3" style={{color:'var(--crimson)'}}>After Distribution Shift</p>
              <div style={{fontFamily:'JetBrains Mono',fontSize:22,fontWeight:700,color:'var(--navy)',marginBottom:10}}>5x − 8y = 0</div>
              <p style={{fontSize:14,color:'var(--text-secondary)',lineHeight:1.65}}>
                Real-world pattern changed. The frozen model boundary is now misclassifying a growing fraction of data.
              </p>
            </div>

            <div className="card-inset" style={{padding:'18px 22px'}}>
              <p className="text-label mb-2" style={{color:'var(--amber)'}}>The Silent Failure</p>
              <p style={{fontSize:14,color:'var(--text-secondary)',lineHeight:1.65}}>
                No exception is thrown. No alert fires. The model continues running confidently
                on the wrong distribution. Revenue leaks. Fraud escapes. Diagnoses fail.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
