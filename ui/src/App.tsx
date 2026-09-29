import { useEffect, useState } from 'react'
import { HUD } from './components/HUD'
import { PresenterCursor } from './components/PresenterCursor'
import { HeroProblem } from './components/HeroProblem'
import { AnalogyModel } from './components/AnalogyModel'
import { ConceptDrift } from './components/ConceptDrift'
import { DecentralizedDrift, ComparisonMatrix } from './components/ComparisonMatrix'
import { Methodology, DriftDetectionEngine } from './components/Methodology'
import { ArchitectureMap } from './components/SwarmMapCanvas'
import { LiveTelemetryDashboard } from './components/LiveTelemetryDashboard'
import {
  Phase1Conclusion, CloudScale, IndustryApplicability,
  TheAsk, ROI, AboutUs,
} from './components/Sections10to15'
import { useSwarmMetrics } from './hooks/useSwarmMetrics'

function useCurrentSection(total: number) {
  const [current, setCurrent] = useState(1)
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id
          const match = id.match(/^section-(\d+)$/)
          if (match) setCurrent(parseInt(match[1]))
        }
      })
    }, { threshold: 0.25, rootMargin: '-10% 0px -10% 0px' })

    for (let i = 1; i <= total; i++) {
      const el = document.getElementById(`section-${i}`)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [total])
  return current
}

export default function App() {
  const { metrics, connected, mqttEvents, ledgerEpochs, refetch } = useSwarmMetrics()
  const currentSection = useCurrentSection(15)
  const [pointerActive, setPointerActive] = useState(true)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      {/* Presenter interactive cursor trail */}
      <PresenterCursor active={pointerActive} />

      {/* Navigation HUD */}
      <HUD
        currentSection={currentSection}
        pointerActive={pointerActive}
        setPointerActive={setPointerActive}
      />

      {/* 15 Sequential Presentation Sections */}
      <HeroProblem            id="section-1"  />
      <AnalogyModel           id="section-2"  />
      <ConceptDrift           id="section-3"  />
      <DecentralizedDrift     id="section-4"  />
      <ComparisonMatrix       id="section-5"  />
      <Methodology            id="section-6"  />
      <DriftDetectionEngine   id="section-7"  />
      <ArchitectureMap        id="section-8"  />
      <LiveTelemetryDashboard
        id="section-9"
        metrics={metrics}
        connected={connected}
        mqttEvents={mqttEvents}
        ledgerEpochs={ledgerEpochs}
        refetch={refetch}
      />
      <Phase1Conclusion       id="section-10" />
      <CloudScale             id="section-11" />
      <IndustryApplicability  id="section-12" />
      <TheAsk                 id="section-13" />
      <ROI                    id="section-14" />
      <AboutUs                id="section-15" />
    </div>
  )
}
