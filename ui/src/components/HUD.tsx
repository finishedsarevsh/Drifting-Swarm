import { useState, useEffect } from 'react'
import { ExternalLink, Menu, X, Activity, Sparkles, Compass } from 'lucide-react'

const SECTIONS = [
  { id: 1,  name: 'The Problem Trilemma',      badge: 'Section 01' },
  { id: 2,  name: 'The Machine Learning Model', badge: 'Section 02' },
  { id: 3,  name: 'Concept Drift & Decay',      badge: 'Section 03' },
  { id: 4,  name: 'Distributed Asymmetric Drift', badge: 'Section 04' },
  { id: 5,  name: 'Competitive Analysis Matrix', badge: 'Section 05' },
  { id: 6,  name: 'Methodology & 5-Step Loop',  badge: 'Section 06' },
  { id: 7,  name: 'Dual-Sentinel Detection Engine', badge: 'Section 07' },
  { id: 8,  name: 'Architecture & Model Specs', badge: 'Section 08' },
  { id: 9,  name: 'Live Demonstrator & Telemetry', badge: 'Section 09' },
  { id: 10, name: 'Phase 1 Results & Proof',     badge: 'Section 10' },
  { id: 11, name: 'Enterprise Cloud Scalability', badge: 'Section 11' },
  { id: 12, name: 'Cross-Domain Applications',   badge: 'Section 12' },
  { id: 13, name: 'The Sponsor Ask',             badge: 'Section 13' },
  { id: 14, name: 'Deliverables & ROI Profile',   badge: 'Section 14' },
  { id: 15, name: 'Engineering Team',            badge: 'Section 15' },
]

export function HUD({
  currentSection,
  pointerActive,
  setPointerActive,
}: {
  currentSection: number
  pointerActive: boolean
  setPointerActive: (fn: (prev: boolean) => boolean) => void
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const scrollTo = (sectionNum: number) => {
    const el = document.getElementById(`section-${sectionNum}`)
    if (el) {
      const top = el.getBoundingClientRect().top + window.pageYOffset - 64
      window.scrollTo({ top, behavior: 'smooth' })
    }
    setDrawerOpen(false)
  }

  return (
    <>
      <header className={`hud ${scrolled ? 'hud-scrolled' : 'hud-transparent'}`}>
        <div className="container-xl w-full flex items-center justify-between">
          {/* Logo & Brand */}
          <div
            onClick={() => scrollTo(1)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--blue) 0%, var(--navy) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(37,99,235,0.35)',
              color: '#ffffff',
            }}>
              <Activity size={17} />
            </div>
            <div>
              <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 15, color: 'var(--navy)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                The Drifting Swarm
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                Phase 1 Technical Pitch &amp; Live Demonstrator
              </div>
            </div>
          </div>

          {/* Right Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Presenter Laser Pointer Toggle */}
            <button
              onClick={() => setPointerActive(prev => !prev)}
              className="btn-ghost"
              style={{
                padding: '7px 12px', fontSize: 12,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: pointerActive ? 'var(--blue-pale)' : 'var(--surface)',
                borderColor: pointerActive ? 'var(--blue)' : 'var(--border)',
                color: pointerActive ? 'var(--blue)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
              title="Toggle interactive presenter laser cursor trail"
            >
              <Sparkles size={13} color={pointerActive ? 'var(--blue)' : 'var(--text-muted)'} />
              <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>Pointer {pointerActive ? 'ON' : 'OFF'}</span>
            </button>

            {/* Progress counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <Compass size={13} color="var(--blue)" />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>
                {String(currentSection).padStart(2, '0')}/15
              </span>
              <div style={{ width: 48, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(currentSection / 15) * 100}%`,
                  background: 'var(--blue)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>

            {/* Prominent Contents Button */}
            <button
              id="contents-nav-button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: 13, gap: 7, borderRadius: 9 }}
              aria-label="Toggle Table of Contents"
            >
              {drawerOpen ? <X size={15} /> : <Menu size={15} />}
              <span>Contents</span>
            </button>

            {/* GitHub Link */}
            <a
              href="https://github.com/finishedsarevsh/Drifting-Swarm"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
              style={{ padding: '8px 12px', fontSize: 13 }}
              title="View Source on GitHub"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </header>

      {/* Slide-out Navigation Drawer */}
      <nav
        className={`nav-drawer ${drawerOpen ? 'open' : ''}`}
        aria-label="Table of Contents Navigation"
        style={{
          width: 320,
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div style={{ padding: '24px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 16, color: 'var(--navy)' }}>
              Presentation Contents
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-muted)' }}>
              15 Verified Agenda Sections
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="btn-ghost"
            style={{ padding: '5px 8px', borderRadius: 6 }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '12px 14px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          {SECTIONS.map(s => {
            const isCurrent = currentSection === s.id
            return (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                style={{
                  width: '100%', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 9, border: 'none',
                  background: isCurrent ? 'var(--blue-pale)' : 'transparent',
                  cursor: 'pointer',
                  marginBottom: 3,
                  transition: 'all 0.15s ease',
                  borderLeft: isCurrent ? '3px solid var(--blue)' : '3px solid transparent',
                }}
              >
                <span style={{
                  fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700,
                  color: isCurrent ? 'var(--blue)' : 'var(--text-faint)',
                  minWidth: 20,
                }}>
                  {String(s.id).padStart(2, '0')}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13, fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? 'var(--navy)' : 'var(--text-secondary)',
                    lineHeight: 1.3,
                  }}>
                    {s.name}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Backdrop overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 98,
            background: 'rgba(15, 23, 42, 0.3)',
            backdropFilter: 'blur(3px)',
            transition: 'opacity 0.2s',
          }}
        />
      )}
    </>
  )
}
