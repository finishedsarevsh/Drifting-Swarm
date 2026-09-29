import { motion } from 'framer-motion'
import { useIntersection } from '../hooks/useIntersection'
import { Check, X, Minus, MapPin, Layers, AlertCircle } from 'lucide-react'

const COMPARISON = [
  {
    attribute: 'Who retrains, and when?',
    central: 'Central server on fixed schedule',
    fl: 'Every node, every sync round',
    swarm: 'Only the drifted node, on drift trigger',
  },
  {
    attribute: 'Payload transmitted',
    central: 'Massive raw datasets',
    fl: 'Full model parameter weights',
    swarm: 'Small cryptographically signed ΔW (<5KB)',
  },
  {
    attribute: 'Compute cost profile',
    central: 'Massive recurring central compute',
    fl: 'Heavy compute wasted on unaffected nodes',
    swarm: 'Near-zero (active only on detected change)',
  },
  {
    attribute: 'Raw data privacy',
    central: 'Violated (central pooling required)',
    fl: 'Preserved (local gradients)',
    swarm: 'Strictly Preserved — Zero raw records move',
  },
  {
    attribute: 'Adaptation latency',
    central: 'Hours or days (scheduled pipeline)',
    fl: 'Minutes (synchronous round delay)',
    swarm: 'Sub-15ms event-driven distribution',
  },
]

export function DecentralizedDrift({ id }: { id: string }) {
  const { ref, visible } = useIntersection()

  return (
    <section id={id} className="section-block bg-alt" ref={ref}>
      <div className="container-xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          style={{ textAlign: 'center', marginBottom: 52 }}
        >
          <div className="section-badge mb-4 mx-auto" style={{ display: 'inline-flex', background: 'var(--amber-pale)', borderColor: 'var(--amber-pale)', color: 'var(--amber)' }}>
            Section 04 — Distributed Drift
          </div>
          <h2 className="text-section-title mb-4" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            In Distributed Networks, Drift is<br />
            <span style={{ color: 'var(--amber)' }}>Asymmetric and Asynchronous</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 580, margin: '0 auto', lineHeight: 1.75, fontSize: '1.05rem' }}>
            Data distributions do not change uniformly across every region at once. Centralized and rigid round-based federated systems fail to handle regional realities.
          </p>
        </motion.div>

        <div className="grid-2 mb-10">
          {[
            {
              title: 'California detects localized flu drift',
              desc: 'Texas, Ohio, and Wyoming remain unaffected — their local models are completely accurate and effective.',
              icon: <MapPin size={22} color="var(--blue)" />,
              problem: 'Centralized architectures trigger an indiscriminate retrain across the entire network, forcing unaffected nodes to burn wasted compute.',
              accent: 'var(--blue)',
              pale: 'var(--blue-pale)',
            },
            {
              title: 'Wyoming observes a novel rural pattern',
              desc: 'A distinct, low-density rural cohort pattern appears that is absent from dense coastal populations.',
              icon: <Layers size={22} color="var(--amber)" />,
              problem: 'Standard Federated Learning averages the Wyoming update into the global weight vector, diluting an urgent local medical anomaly.',
              accent: 'var(--amber)',
              pale: 'var(--amber-pale)',
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              animate={visible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.15 }}
              className="card-elevated"
              style={{ padding: 28 }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: card.pale,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16
              }}>
                {card.icon}
              </div>
              <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 18, color: 'var(--navy)', marginBottom: 8 }}>
                {card.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 18 }}>
                {card.desc}
              </p>
              <div style={{ padding: 16, borderRadius: 10, background: 'var(--crimson-pale)', border: '1px solid rgba(220,38,38,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <AlertCircle size={14} color="var(--crimson)" />
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: 'var(--crimson)' }}>
                    Why Existing Approaches Fail
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {card.problem}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* What We Need Callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="card"
          style={{
            maxWidth: 780, margin: '0 auto',
            padding: '24px 32px',
            borderLeft: '4px solid var(--blue)',
            borderRadius: '0 16px 16px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span className="text-label" style={{ color: 'var(--blue)' }}>The Required Paradigm</span>
          </div>
          <p style={{ color: 'var(--navy)', fontSize: '1.05rem', lineHeight: 1.7, fontWeight: 500 }}>
            A system that detects drift <strong>per node independently</strong>, arbitrates retrains <strong>only on the drifted node</strong>, and propagates the knowledge update to peers — without moving a single raw data record.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

export function ComparisonMatrix({ id }: { id: string }) {
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
          <div className="section-badge mb-4 mx-auto" style={{ display: 'inline-flex' }}>
            Section 05 — Competitive Analysis
          </div>
          <h2 className="text-section-title mb-4" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            Why Existing Paradigms Fall Short
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto', lineHeight: 1.75, fontSize: '1.05rem' }}>
            A architectural comparison between centralized learning, scheduled federated rounds, and The Drifting Swarm.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="card overflow-hidden"
          style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Core Dimension</th>
                  <th style={{ width: '26%', color: 'var(--crimson)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <X size={14} color="var(--crimson)" />
                      Centralized ML
                    </div>
                  </th>
                  <th style={{ width: '26%', color: 'var(--amber)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Minus size={14} color="var(--amber)" />
                      Standard Federated Learning
                    </div>
                  </th>
                  <th style={{ width: '26%', color: 'var(--emerald)', background: 'var(--emerald-pale)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check size={14} color="var(--emerald)" />
                      The Drifting Swarm
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 600, fontSize: 13, color: 'var(--navy)' }}>
                        {row.attribute}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.central}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.fl}</span>
                    </td>
                    <td style={{ background: 'rgba(209, 250, 229, 0.25)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--emerald)' }}>
                        {row.swarm}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* 3 Metric Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.5 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 28 }}
        >
          {[
            { label: 'Compute Reduction', value: '83%', desc: 'vs continuous scheduled FL retraining', color: 'var(--emerald)' },
            { label: 'Distribution Latency', value: '<15ms', desc: 'vs multi-minute synchronous coordination', color: 'var(--blue)' },
            { label: 'Privacy Guarantees', value: '100%', desc: 'zero patient or subscriber records pooled', color: 'var(--violet)' },
          ].map((stat, i) => (
            <div key={i} className="card" style={{ padding: '20px 24px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: '2rem', fontWeight: 800, color: stat.color, marginBottom: 4 }}>
                {stat.value}
              </div>
              <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 2 }}>
                {stat.label}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-faint)' }}>
                {stat.desc}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
