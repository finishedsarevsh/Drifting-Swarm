import { useState } from 'react'
import { motion } from 'framer-motion'
import { useIntersection } from '../hooks/useIntersection'
import { NODES } from '../data/nodes'
import { MapPin, Sliders, ListFilter, ShieldCheck, Database } from 'lucide-react'

// Accurate coordinate positions on a 960x540 continental US projection
const CITY_NODES: Record<string, { x: number; y: number; city: string; state: string; role: string }> = {
  CA: { x: 125, y: 260, city: 'Sacramento / SF Bay', state: 'California', role: 'High-Density Cohort Sentinel (Max Scale)' },
  TX: { x: 440, y: 395, city: 'Austin / Dallas', state: 'Texas', role: 'Strongest Drift Signal Sentinel' },
  OH: { x: 710, y: 235, city: 'Columbus / Cleveland', state: 'Ohio', role: 'Mid-West Baseline Node' },
  WY: { x: 330, y: 200, city: 'Cheyenne', state: 'Wyoming', role: 'Sparse Rural Anomaly Sentinel' },
  NY: { x: 840, y: 175, city: 'Albany / NYC Metro', state: 'New York', role: 'Concurrent Drift Peer A (Race Benchmark)' },
  NJ: { x: 865, y: 215, city: 'Trenton / Newark', state: 'New Jersey', role: 'Concurrent Drift Peer B (CAS Lease Loser)' },
}

const MODEL_HYPERPARAMS = [
  { name: 'Model Architecture', value: 'LightGBM GBDT', desc: 'Gradient Boosted Decision Trees with warm-start continuation' },
  { name: 'Objective Function', value: 'binary:logloss', desc: 'Binary cross-entropy loss for DIABETE3 outcome' },
  { name: 'Learning Rate (η)', value: '0.05', desc: 'Conservative rate preserving historical tree weights during fine-tuning' },
  { name: 'Trees per Retrain', value: '50 trees', desc: 'Incremental estimators fitted per detected drift epoch' },
  { name: 'Max Depth Limit', value: '6', desc: 'Hard depth ceiling preventing micro-structure tree explosion' },
  { name: 'Number of Leaves', value: '31', desc: 'Capped at ≤ 2^max_depth to avoid localized overfitting' },
  { name: 'Histogram Bins (max_bin)', value: '63', desc: 'Reduced from 255 down to 63, reducing memory usage 4x' },
  { name: 'Min Child Samples', value: '50', desc: 'Minimum leaf samples stopping splits on noisy outliers' },
  { name: 'Accumulated Tree Cap', value: '200 trees', desc: 'Strict upper bound holding pickled memory < 4 MB' },
  { name: 'Validation Split', value: '20% held-out', desc: 'Chronological validation slice for early-stopping evaluation' },
]

const BRFSS_FEATURES = [
  { col: 'feat_bp', code: '_RFHYPE5', name: 'High Blood Pressure', desc: 'Physician-diagnosed hypertension indicator' },
  { col: 'feat_chol', code: '_CHOLCHK1', name: 'Cholesterol Recency', desc: 'Time interval since blood cholesterol evaluation' },
  { col: 'feat_bmi', code: '_BMI5', name: 'Body Mass Index', desc: 'Computed BMI (kg/m² × 100)' },
  { col: 'feat_inactive', code: '_TOTINDA', name: 'Physical Inactivity', desc: 'No leisure-time exercise or physical activity' },
  { col: 'feat_alcohol', code: '_DRNKWK2', name: 'Weekly Alcohol', desc: 'Calculated drinks per week metric' },
  { col: 'feat_age', code: '_AGEG5YR', name: 'Age Category', desc: '14-level five-year age demographic stratification' },
  { col: 'feat_genhlth', code: 'GENHLTH', name: 'General Health', desc: 'Self-reported overall health (1=Excellent to 5=Poor)' },
  { col: 'feat_physhlth', code: 'PHYSHLTH', name: 'Physical Health Days', desc: 'Number of days physical illness hindered activity' },
  { col: 'feat_menthlth', code: 'MENTHLTH', name: 'Mental Health Days', desc: 'Number of days mental health sub-optimal' },
  { col: 'feat_coverage', code: 'HLTHPLN1', name: 'Insurance Coverage', desc: 'Health insurance or health care payment plan coverage' },
  { col: 'feat_medcost', code: 'MEDCOST', name: 'Medical Cost Barrier', desc: 'Unable to see a physician in past 12m due to cost' },
  { col: 'feat_checkup', code: 'CHECKUP1', name: 'Routine Checkup', desc: 'Recency of last routine medical physical examination' },
  { col: 'feat_smoke', code: 'SMOKE100', name: 'Smoking History', desc: 'Has smoked at least 100 cigarettes in lifetime' },
  { col: 'feat_sex', code: 'SEX1', name: 'Biological Sex', desc: 'Sex of survey respondent' },
  { col: 'feat_educa', code: 'EDUCA', name: 'Education Level', desc: 'Highest educational attainment completed' },
  { col: 'feat_income', code: 'INCOME3', name: 'Household Income', desc: 'Annual household income bracket classification' },
]

export function ArchitectureMap({ id }: { id: string }) {
  const { ref, visible } = useIntersection()
  const [selectedId, setSelectedId] = useState('CA')
  const [activeTab, setActiveTab] = useState<'params' | 'features' | 'node' | 'codec'>('params')

  const selNode = NODES.find(n => n.id === selectedId) || NODES[0]
  const selMeta = CITY_NODES[selectedId] || CITY_NODES.CA

  return (
    <section id={id} className="section-block bg-white" ref={ref}>
      <div className="container-xl w-full">
        {/* Centered Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          style={{ textAlign: 'center', marginBottom: 44 }}
        >
          <div className="section-badge mb-4 mx-auto" style={{ display: 'inline-flex' }}>
            Section 08 — Swarm Architecture &amp; Parameters
          </div>
          <h2 className="text-section-title mb-4" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            Phase 1 Swarm Network &amp; Model Specifications
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto', lineHeight: 1.75, fontSize: '1.05rem' }}>
            6 distributed state nodes across the continental US processing real annual CDC BRFSS cohorts (1999–2024). Click any city on the map or list to inspect its configuration and model parameters.
          </p>
        </motion.div>

        {/* Map + Node Selector Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.8fr) minmax(280px, 1fr)', gap: 24, marginBottom: 24 }}>
          {/* High-Resolution SVG US Map */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={visible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.15 }}
            className="card"
            style={{ padding: 24, overflow: 'hidden', position: 'relative' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={16} color="var(--blue)" />
                <span className="text-label" style={{ color: 'var(--navy)' }}>Decentralized Topology (6 US Nodes)</span>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-faint)' }}>
                Click any city to inspect
              </span>
            </div>

            {/* SVG Visual Canvas */}
            <svg
              viewBox="0 0 960 540"
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              {/* Subtle map coordinate grid */}
              <defs>
                <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(226, 232, 240, 0.6)" strokeWidth="0.8" />
                </pattern>
                <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="960" height="540" fill="url(#mapGrid)" rx="12" />

              {/* Realistic US Mainland Outline */}
              <path
                d="M 100,120 L 140,85 L 240,75 L 420,70 L 610,65 L 750,75 L 820,105 L 860,110 L 890,140 L 910,180 L 895,215 L 870,250 L 840,320 L 810,380 L 780,450 L 710,470 L 590,440 L 490,490 L 400,470 L 330,420 L 220,440 L 140,380 L 100,320 L 80,240 L 85,170 Z"
                fill="#ffffff"
                stroke="#cbd5e1"
                strokeWidth="2"
              />

              {/* Inter-node P2P Mesh Communication Arcs */}
              {NODES.map((a, i) =>
                NODES.slice(i + 1).map((b, j) => {
                  const p1 = CITY_NODES[a.id]
                  const p2 = CITY_NODES[b.id]
                  const isHighlighted = selectedId === a.id || selectedId === b.id
                  return (
                    <line
                      key={`${a.id}-${b.id}-${j}`}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={isHighlighted ? 'rgba(37, 99, 235, 0.45)' : 'rgba(203, 213, 225, 0.6)'}
                      strokeWidth={isHighlighted ? 2 : 1}
                      strokeDasharray={isHighlighted ? '6 4' : undefined}
                    />
                  )
                })
              )}

              {/* 6 Clickable Node Markers with Generous 40px Hit Targets */}
              {NODES.map(node => {
                const pos = CITY_NODES[node.id]
                const isSelected = selectedId === node.id

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedId(node.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Concentric radar pulse for active selection */}
                    {isSelected && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={24}
                        fill="none"
                        stroke={node.color}
                        strokeWidth="2.5"
                        opacity="0.6"
                      >
                        <animate attributeName="r" values="14;34;14" dur="2.4s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.7;0;0.7" dur="2.4s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Invisible 48px Clickable Hit Area */}
                    <circle cx={pos.x} cy={pos.y} r={28} fill="transparent" />

                    {/* Outer Pin Halo */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isSelected ? 11 : 8}
                      fill={isSelected ? node.color : '#ffffff'}
                      stroke={node.color}
                      strokeWidth={isSelected ? 3 : 2}
                    />

                    {/* Inner Center Dot */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isSelected ? 5 : 3.5}
                      fill={isSelected ? '#ffffff' : node.color}
                    />

                    {/* Node Identifier Badge on Map */}
                    <rect
                      x={pos.x + 14}
                      y={pos.y - 18}
                      width={node.name.length > 8 ? 88 : 74}
                      height={28}
                      rx={6}
                      fill={isSelected ? node.color : '#ffffff'}
                      stroke={isSelected ? node.color : '#e2e8f0'}
                      strokeWidth="1.5"
                      filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.08))"
                    />
                    <text
                      x={pos.x + 20}
                      y={pos.y - 4}
                      fontFamily="JetBrains Mono"
                      fontWeight="700"
                      fontSize="11"
                      fill={isSelected ? '#ffffff' : 'var(--navy)'}
                    >
                      {node.id} · {pos.city.split(' ')[0]}
                    </text>
                  </g>
                )
              })}
            </svg>
          </motion.div>

          {/* Right Column: Node City List Cards */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={visible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.25 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="text-label">Participating State Clusters</span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-muted)' }}>6 Nodes</span>
            </div>

            {NODES.map(node => {
              const meta = CITY_NODES[node.id]
              const isSelected = selectedId === node.id

              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedId(node.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 12,
                    background: isSelected ? node.bgColor : 'var(--surface)',
                    border: isSelected ? `2px solid ${node.color}` : '1px solid var(--border)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'all 0.18s ease',
                    boxShadow: isSelected ? `0 6px 18px ${node.color}20` : 'var(--shadow-xs)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: node.color,
                      boxShadow: isSelected ? `0 0 0 4px ${node.color}35` : undefined
                    }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: node.color }}>
                          Node {node.id}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                          {meta.state}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {meta.city}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                      {node.rows.toLocaleString()}
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--text-faint)' }}>
                      survey rows
                    </div>
                  </div>
                </button>
              )
            })}
          </motion.div>
        </div>

        {/* Tabbed Inspector: Model Parameters, Input Features, Node Spec, & Codec */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="card"
          style={{ padding: 24, borderTop: `4px solid ${selNode.color}` }}
        >
          {/* Tab Navigation Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { id: 'params', label: 'Input Model Hyperparameters', icon: <Sliders size={14} /> },
              { id: 'features', label: 'BRFSS Input Feature Set (16 Clinical Signals)', icon: <ListFilter size={14} /> },
              { id: 'node', label: `${selNode.name} (${selNode.id}) Cluster Profile`, icon: <Database size={14} /> },
              { id: 'codec', label: 'Delta Codec & Cryptographic Signing', icon: <ShieldCheck size={14} /> },
            ].map(tab => {
              const isTabActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8,
                    background: isTabActive ? 'var(--blue-pale)' : 'var(--surface-3)',
                    border: isTabActive ? '1px solid var(--blue)' : '1px solid var(--border)',
                    color: isTabActive ? 'var(--blue)' : 'var(--text-secondary)',
                    fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: isTabActive ? 700 : 500,
                    cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab 1: Input Model Hyperparameters */}
          {activeTab === 'params' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span className="text-label" style={{ color: 'var(--blue)' }}>
                  Production LightGBM Binary Classification Parameters
                </span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-muted)' }}>
                  Target: DIABETE3 (0 = Negative, 1 = Positive Diagnosis)
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {MODEL_HYPERPARAMS.map((hp, i) => (
                  <div key={i} className="card-inset" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-muted)' }}>{hp.name}</span>
                      <code style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: 'var(--blue)', background: 'var(--surface)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                        {hp.value}
                      </code>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {hp.desc}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tab 2: BRFSS Input Features */}
          {activeTab === 'features' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span className="text-label" style={{ color: 'var(--emerald)' }}>
                  16 Demographic, Behavioral &amp; Physiological Feature Columns
                </span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-muted)' }}>
                  CDC Behavioral Risk Factor Surveillance System (BRFSS)
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {BRFSS_FEATURES.map((feat, i) => (
                  <div key={i} className="card-inset" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>
                        {feat.name}
                      </span>
                      <code style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--emerald)', background: 'var(--emerald-pale)', padding: '1px 6px', borderRadius: 4 }}>
                        {feat.code}
                      </code>
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                      column: {feat.col}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {feat.desc}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tab 3: Selected Node Cluster Profile */}
          {activeTab === 'node' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div className="card-inset" style={{ padding: 16 }}>
                  <p className="text-label mb-2" style={{ color: selNode.color }}>Node Identifier</p>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>
                    {selNode.name} ({selNode.id})
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Metro Hub: {selMeta.city}
                  </div>
                </div>
                <div className="card-inset" style={{ padding: 16 }}>
                  <p className="text-label mb-2" style={{ color: selNode.color }}>Cohort Records</p>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18, color: 'var(--navy)' }}>
                    {selNode.rows.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Survey years: 1999–2024
                  </div>
                </div>
                <div className="card-inset" style={{ padding: 16 }}>
                  <p className="text-label mb-2" style={{ color: selNode.color }}>Network Testing Role</p>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>
                    {selMeta.role}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Continuous PSI evaluation: τ = 0.05
                  </div>
                </div>
                <div className="card-inset" style={{ padding: 16 }}>
                  <p className="text-label mb-2" style={{ color: selNode.color }}>Data Residency</p>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 14, color: 'var(--emerald)' }}>
                    100% Host-Isolated
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    HIPAA/GDPR compliant; zero raw rows exported.
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tab 4: Cryptographic Delta Codec */}
          {activeTab === 'codec' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                <div className="card-inset" style={{ padding: 16 }}>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 4 }}>
                    Ed25519 Asymmetric Signatures
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Every delta package is cryptographically signed using the node private key (`keys/{selectedId}_private.pem`). Peer nodes verify signatures against the public key before applying weights.
                  </p>
                </div>
                <div className="card-inset" style={{ padding: 16 }}>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 4 }}>
                    Float16 Sparse Quantization
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Weight delta matrices ΔW are filtered via sparsity thresholding and cast to float16, shrinking the total payload over the wire to under 5 KB without precision loss.
                  </p>
                </div>
                <div className="card-inset" style={{ padding: 16 }}>
                  <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 4 }}>
                    Atomic Lease Arbitration (CAS)
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    FastAPI + SQLite compare-and-swap lease granting on `/claim` prevents concurrent race condition retraining. In Phase 2, this maps directly to Amazon DynamoDB conditional writes.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  )
}
