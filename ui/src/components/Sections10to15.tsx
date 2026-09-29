import { motion } from 'framer-motion'
import { useIntersection } from '../hooks/useIntersection'
import {
  CheckCircle,
  Server,
  Database,
  Key,
  BarChart2,
  HardDrive,
  Box,
  Landmark,
  Radio,
  Factory,
  ShieldCheck,
  FolderGit2,
  Cloud,
  Cpu,
  FileCheck,
  Award,
  Target,
  TrendingUp,
  Zap,
  ArrowRight,
  ExternalLink,
  Terminal,
  Shield
} from 'lucide-react'

export function Phase1Conclusion({ id }: { id: string }) {
  const { ref, visible } = useIntersection()

  return (
    <section id={id} className="section-block bg-white" ref={ref}>
      <div className="container-xl w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <div className="section-badge mb-4 mx-auto" style={{ display: 'inline-flex', background: 'var(--emerald-pale)', borderColor: 'var(--emerald-pale)', color: 'var(--emerald)' }}>
            Section 10 — Phase 1 Results
          </div>
          <h2 className="text-section-title mb-4" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            The Architecture is No Longer<br />
            <span style={{ color: 'var(--emerald)' }}>Hypothetical</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.75, fontSize: '1.05rem' }}>
            Empirically validated on real CDC BRFSS public healthcare datasets across 6 independent nodes with zero cloud spend.
          </p>
        </motion.div>

        <div className="grid-3 mb-8">
          {[
            {
              title: 'Fully Operational Swarm',
              desc: '6-node containerized network processing multi-year healthcare records with zero cross-node data transfer.',
              color: 'var(--emerald)',
              pale: 'var(--emerald-pale)'
            },
            {
              title: 'Deterministic Lease Arbitration',
              desc: 'SQLite compare-and-swap lease acquisition strictly eliminates race conditions under simultaneous drift events.',
              color: 'var(--blue)',
              pale: 'var(--blue-pale)'
            },
            {
              title: 'Zero Enterprise Cloud Waste',
              desc: 'Architected and validated with zero baseline cloud compute waste, ready to port directly to managed cloud services.',
              color: 'var(--violet)',
              pale: 'var(--violet-pale)'
            },
          ].map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={visible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="card-elevated"
              style={{ padding: 28, textAlign: 'left' }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: c.pale, color: c.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16
              }}>
                <CheckCircle size={20} />
              </div>
              <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--navy)', marginBottom: 8 }}>
                {c.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                {c.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Proven Capabilities Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="card"
          style={{ padding: '28px 32px', textAlign: 'left', border: '1px solid var(--border)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Shield size={16} color="var(--emerald)" />
            <span className="text-label" style={{ color: 'var(--emerald)' }}>Validated Technical Guarantees</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {[
              'Ed25519 signature verification on every delta payload',
              'Dual-sentinel PSI statistical drift detection',
              'FastAPI atomic lease arbitration preventing split-brain',
              'LightGBM warm-start incremental model updating',
              'Sub-15ms delta dissemination over lightweight MQTT',
              'Live Prometheus metrics scraping and telemetry hold',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--text-secondary)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--emerald)', flexShrink: 0 }} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export function CloudScale({ id }: { id: string }) {
  const { ref, visible } = useIntersection()
  const MIGRATION = [
    { icon: <Server size={18} />, local: 'Mosquitto MQTT Broker', aws: 'AWS IoT Core', sub: 'Shared pub/sub MQTT contract' },
    { icon: <Database size={18} />, local: 'FastAPI + SQLite Ledger', aws: 'Amazon DynamoDB', sub: 'Atomic conditional writes' },
    { icon: <Key size={18} />, local: 'Local Ed25519 Keyfiles', aws: 'AWS KMS Asymmetric Keys', sub: 'Hardware-backed signing' },
    { icon: <BarChart2 size={18} />, local: 'Prometheus + Grafana', aws: 'Amazon CloudWatch + Managed Grafana', sub: 'Enterprise observability' },
    { icon: <HardDrive size={18} />, local: 'Local Isolated Data Mounts', aws: 'Amazon S3 Customer Buckets', sub: 'Per-tenant isolated data residency' },
    { icon: <Box size={18} />, local: 'Independent Node Containers', aws: 'AWS ECS Fargate / Lambda', sub: 'Autonomous micro-services' },
  ]

  return (
    <section id={id} className="section-block bg-alt" ref={ref}>
      <div className="container-xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <div className="section-badge mb-4 mx-auto" style={{ display: 'inline-flex' }}>
            Section 11 — Phase 2 Cloud Scale
          </div>
          <h2 className="text-section-title mb-4" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            Zero Code Rewrites to Enterprise Cloud
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto', lineHeight: 1.75, fontSize: '1.05rem' }}>
            Every component in our Phase 1 demonstrator was designed to cleanly map into high-throughput, managed cloud infrastructure.
          </p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 860, margin: '0 auto' }}>
          {MIGRATION.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={visible ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.1 + i * 0.08 }}
              className="card"
              style={{
                padding: '14px 22px',
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 1fr) 40px minmax(220px, 1.2fr)',
                alignItems: 'center',
                gap: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ color: 'var(--text-muted)' }}>{row.icon}</div>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{row.local}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ArrowRight size={16} color="var(--border-mid)" />
              </div>
              <div>
                <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 14, color: 'var(--blue)' }}>
                  {row.aws}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-faint)' }}>
                  {row.sub}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function IndustryApplicability({ id }: { id: string }) {
  const { ref, visible } = useIntersection()
  const DOMAINS = [
    {
      icon: <Landmark size={22} color="var(--blue)" />,
      title: 'Banking & Financial Services',
      color: 'var(--blue)',
      pale: 'var(--blue-pale)',
      problem: 'Fraud patterns pivot quickly; strict GDPR, CCPA, and PCI DSS compliance blocks financial data pooling.',
      practice: 'Centralized model updates blocked by legal counsel; standard FL is burdened by slow sync cycles.',
      fit: 'Operates as an event-driven speed and efficiency layer over existing infrastructure with instant drift synchronization.',
    },
    {
      icon: <Radio size={22} color="var(--emerald)" />,
      title: 'Telecom & Critical Infrastructure',
      color: 'var(--emerald)',
      pale: 'var(--emerald-pale)',
      problem: 'Base-station cell tower traffic patterns and anomalies shift rapidly with high volume.',
      practice: 'Heavy centralized NOC-level retraining models with latency measured in hours.',
      fit: 'Immediate edge anomaly dissemination across tower clusters without pooling sensitive subscriber telemetry.',
    },
    {
      icon: <Factory size={22} color="var(--amber)" />,
      title: 'Manufacturing & Industry 4.0',
      color: 'var(--amber)',
      pale: 'var(--amber-pale)',
      problem: 'Predictive maintenance sensor distributions drift as tooling wears down across distributed assembly plants.',
      practice: 'Isolated per-plant models or high-overhead scheduled retraining rounds.',
      fit: 'A vibration signature indicating mechanical wear at Plant 3 is pushed immediately to identical pumps at Plants 1, 2, and 4.',
    },
    {
      icon: <ShieldCheck size={22} color="var(--violet)" />,
      title: 'Cybersecurity & Threat Detection',
      color: 'var(--violet)',
      pale: 'var(--violet-pale)',
      problem: 'Intrusion techniques mutate dynamically; raw packet logs cannot be shared between competitive enterprises.',
      practice: 'Manual threat intelligence feeds requiring slow human review and curation.',
      fit: 'Automated dissemination of signed delta updates the second a novel attack vector is classified by any peer.',
    },
  ]

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
            Section 12 — Industry Applicability
          </div>
          <h2 className="text-section-title mb-4" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            Cross-Domain Production Impact
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto', lineHeight: 1.75, fontSize: '1.05rem' }}>
            Any sector where data privacy is legally mandated and operating realities constantly drift is a direct candidate.
          </p>
        </motion.div>

        <div className="grid-2">
          {DOMAINS.map((d, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              animate={visible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.15 + i * 0.1 }}
              className="card-elevated"
              style={{ padding: 28 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: d.pale,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {d.icon}
                </div>
                <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 17, color: 'var(--navy)' }}>
                  {d.title}
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface-3)' }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: 'var(--crimson)', marginBottom: 2 }}>
                    The Problem
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{d.problem}</p>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface-3)' }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 2 }}>
                    Current Practice
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{d.practice}</p>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 8, background: d.pale, border: `1px solid ${d.color}25` }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: d.color, marginBottom: 2 }}>
                    The Drifting Swarm Solution
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.55, fontWeight: 500 }}>{d.fit}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function TheAsk({ id }: { id: string }) {
  const { ref, visible } = useIntersection()

  return (
    <section id={id} className="section-block bg-alt" ref={ref}>
      <div className="container-xl w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <div className="section-badge mb-4 mx-auto" style={{ display: 'inline-flex', background: 'var(--amber-pale)', borderColor: 'var(--amber-pale)', color: 'var(--amber)' }}>
            Section 13 — The Ask
          </div>
          <h2 className="text-section-title mb-4" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            Partnership & Resource Requirements
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.75, fontSize: '1.05rem' }}>
            What we are seeking from industry sponsors and enterprise development partners to execute Phase 2.
          </p>
        </motion.div>

        <div className="grid-2">
          {[
            {
              icon: <FolderGit2 size={22} color="var(--blue)" />,
              title: 'Domain Data & Pilot Cohorts',
              desc: 'Access to realistic, anonymized multi-institution partner datasets for sector-specific production pilots.',
              accent: 'var(--blue)', pale: 'var(--blue-pale)'
            },
            {
              icon: <Cloud size={22} color="var(--emerald)" />,
              title: 'Cloud Infrastructure Credits',
              desc: 'Operational infrastructure budget for AWS IoT Core, Amazon DynamoDB, and GPU training clusters.',
              accent: 'var(--emerald)', pale: 'var(--emerald-pale)'
            },
            {
              icon: <Cpu size={22} color="var(--amber)" />,
              title: 'Engineering Integration',
              desc: 'Dedicated engineering alignment to integrate The Drifting Swarm into your enterprise workflow.',
              accent: 'var(--amber)', pale: 'var(--amber-pale)'
            },
            {
              icon: <FileCheck size={22} color="var(--violet)" />,
              title: 'Patent & IP Legal Prosecution',
              desc: 'Intellectual property filing support for The Drifting Swarm ledger arbitration and delta distribution protocol.',
              accent: 'var(--violet)', pale: 'var(--violet-pale)'
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={visible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
              className="card-elevated"
              style={{ padding: 26, textAlign: 'left' }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: item.pale,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16
              }}>
                {item.icon}
              </div>
              <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 17, color: 'var(--navy)', marginBottom: 8 }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ROI({ id }: { id: string }) {
  const { ref, visible } = useIntersection()

  return (
    <section id={id} className="section-block bg-white" ref={ref}>
      <div className="container-xl w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <div className="section-badge mb-4 mx-auto" style={{ display: 'inline-flex', background: 'var(--emerald-pale)', borderColor: 'var(--emerald-pale)', color: 'var(--emerald)' }}>
            Section 14 — Deliverables & ROI
          </div>
          <h2 className="text-section-title mb-4" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            What Enterprise Sponsors Receive
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.75, fontSize: '1.05rem' }}>
            Tangible IP, production pilots, and direct compute efficiency gains.
          </p>
        </motion.div>

        <div className="grid-2">
          {[
            {
              icon: <Award size={22} color="var(--emerald)" />,
              title: 'Proprietary IP Positioning',
              desc: 'Favorable licensing and early-access commercial rights to The Drifting Swarm protocol IP portfolio.',
              accent: 'var(--emerald)', pale: 'var(--emerald-pale)'
            },
            {
              icon: <Target size={22} color="var(--blue)" />,
              title: 'Tailored Production Pilot',
              desc: 'The architecture validated on your live data infrastructure — not an isolated synthetic sandbox.',
              accent: 'var(--blue)', pale: 'var(--blue-pale)'
            },
            {
              icon: <TrendingUp size={22} color="var(--violet)" />,
              title: 'Empirical Cost Benchmarks',
              desc: 'Documented 80%+ compute savings and adaptation latency reductions compared against scheduled FL baselines.',
              accent: 'var(--violet)', pale: 'var(--violet-pale)'
            },
            {
              icon: <Zap size={22} color="var(--amber)" />,
              title: 'First-Mover Competitive Advantage',
              desc: 'Pioneer the transition to decentralized, drift-triggered intelligence ahead of industry peers.',
              accent: 'var(--amber)', pale: 'var(--amber-pale)'
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={visible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
              className="card-elevated"
              style={{ padding: 26, textAlign: 'left', border: `1px solid var(--border)` }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: item.pale,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16
              }}>
                {item.icon}
              </div>
              <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 17, color: 'var(--navy)', marginBottom: 8 }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function AboutUs({ id }: { id: string }) {
  const { ref, visible } = useIntersection()

  return (
    <section id={id} className="section-block bg-alt" ref={ref}>
      <div className="container-lg w-full text-center">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <div className="section-badge mb-4 mx-auto" style={{ display: 'inline-flex' }}>
            Section 15 — Engineering Team
          </div>
          <h2 className="text-section-title mb-8" style={{ fontSize: 'clamp(2rem, 3.8vw, 3.2rem)' }}>
            The Team Behind The Drifting Swarm
          </h2>
        </motion.div>

        {/* 4 Team Member Cards */}
        <div className="grid-4 mb-10">
          {[
            { name: 'Shaktisingh Suryawanshi', email: 'shaktisinghsuryawanshi3@gmail.com', phone: '+91 8767195922' },
            { name: 'Sanat Sanjeev', email: null, phone: null },
            { name: 'Rishabh Pundir', email: null, phone: null },
            { name: 'Sarvesh Wakchaure', email: null, phone: null },
          ].map((member, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={visible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.1 + i * 0.08 }}
              className="card-elevated"
              style={{ padding: '24px 20px', textAlign: 'center' }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--blue-pale)', color: 'var(--blue)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
                fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 20,
                border: '2px solid rgba(37, 99, 235, 0.2)'
              }}>
                {member.name.charAt(0)}
              </div>
              <div style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 15, color: 'var(--navy)', marginBottom: 6 }}>
                {member.name}
              </div>
              {member.email && (
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10.5, color: 'var(--blue)', wordBreak: 'break-all', marginTop: 4 }}>
                  {member.email}
                </div>
              )}
              {member.phone && (
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {member.phone}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Clean Terminal Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="terminal"
          style={{ maxWidth: 680, margin: '0 auto 28px', textAlign: 'left' }}
        >
          <div className="terminal-bar">
            <div className="terminal-dot" style={{ background: '#ef4444' }} />
            <div className="terminal-dot" style={{ background: '#f59e0b' }} />
            <div className="terminal-dot" style={{ background: '#10b981' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
              bash — Quickstart
            </span>
          </div>
          <div className="terminal-body">
            <div><span className="prompt">$</span> <span className="cmd">git clone https://github.com/finishedsarevsh/Drifting-Swarm.git</span></div>
            <div><span className="prompt">$</span> <span className="cmd">cd Drifting-Swarm</span></div>
            <div><span className="prompt">$</span> <span className="cmd">docker compose up -d</span></div>
            <div style={{ color: '#38bdf8', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="status-dot status-idle" style={{ width: 6, height: 6 }} />
              <span>Cluster live on localhost:3001 (UI), 9090 (Prometheus), 8000 (Ledger)</span>
            </div>
          </div>
        </motion.div>

        {/* GitHub link button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={visible ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <a
            href="https://github.com/finishedsarevsh/Drifting-Swarm"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: 13, fontFamily: 'JetBrains Mono' }}
          >
            <Terminal size={14} />
            github.com/finishedsarevsh/Drifting-Swarm
            <ExternalLink size={13} />
          </a>
        </motion.div>
      </div>
    </section>
  )
}
