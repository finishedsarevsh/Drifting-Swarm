import { useEffect, useRef, useState, useCallback } from 'react'
import type { NodeMetrics, NodeId, PrometheusResult } from '../data/nodes'
import { NODES, extractLatestValue } from '../data/nodes'

const POLL_MS = 3000
const PROM = '/api/prometheus'
const LEDGER = '/api/ledger'

export interface LedgerEpoch {
  epoch_id: string
  winner: string
  granted_at: number
}

async function promQuery(metric: string): Promise<PrometheusResult[]> {
  try {
    const res = await fetch(`${PROM}/api/v1/query?query=${encodeURIComponent(metric)}`, {
      signal: AbortSignal.timeout(3500),
    })
    if (!res.ok) return []
    const json = await res.json()
    return json?.data?.result ?? []
  } catch {
    return []
  }
}

async function fetchLedgerEpochs(): Promise<LedgerEpoch[]> {
  try {
    const res = await fetch(`${LEDGER}/epochs`, {
      signal: AbortSignal.timeout(3500),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function fetchLedgerVersion(nodeId: string): Promise<number> {
  try {
    const res = await fetch(`${LEDGER}/version/${nodeId}`, {
      signal: AbortSignal.timeout(3500),
    })
    if (!res.ok) return 0
    const data = await res.json()
    return typeof data?.version === 'number' ? data.version : 0
  } catch {
    return 0
  }
}

const INIT_METRICS = (): Record<NodeId, NodeMetrics> =>
  Object.fromEntries(
    NODES.map(n => [n.id, {
      nodeId: n.id, driftScore: 0, retrainTotal: 0,
      deltaBytes: 0, applyLatency: 0, modelVersion: 0,
      status: 'idle' as const, up: false, lastUpdated: 0,
    }])
  ) as Record<NodeId, NodeMetrics>

export function useSwarmMetrics() {
  const [metrics, setMetrics] = useState<Record<NodeId, NodeMetrics>>(INIT_METRICS)
  const [connected, setConnected] = useState(false)
  const [ledgerEpochs, setLedgerEpochs] = useState<LedgerEpoch[]>([])
  const [mqttEvents, setMqttEvents] = useState<
    { topic: string; from: string; bytes: number; ts: number }[]
  >([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const pollMetrics = useCallback(async () => {
    try {
      const [
        driftInstant,
        retrainInstant,
        deltaInstant,
        latencyInstant,
        upR,
        driftHist,
        retrainHist,
        deltaHist,
        latencyHist,
        epochs,
        ...versions
      ] = await Promise.all([
        promQuery('dtass_drift_score'),
        promQuery('dtass_retrain_total'),
        promQuery('dtass_delta_bytes'),
        promQuery('dtass_apply_latency_s'),
        promQuery('up{job="dtass-nodes"}'),
        promQuery('last_over_time(dtass_drift_score[24h])'),
        promQuery('max_over_time(dtass_retrain_total[24h])'),
        promQuery('last_over_time(dtass_delta_bytes[24h])'),
        promQuery('last_over_time(dtass_apply_latency_s[24h])'),
        fetchLedgerEpochs(),
        ...NODES.map(n => fetchLedgerVersion(n.id)),
      ])

      const dInst = extractLatestValue(driftInstant)
      const rInst = extractLatestValue(retrainInstant)
      const bInst = extractLatestValue(deltaInstant)
      const lInst = extractLatestValue(latencyInstant)
      const upMap = extractLatestValue(upR)

      const dHist = extractLatestValue(driftHist)
      const rHist = extractLatestValue(retrainHist)
      const bHist = extractLatestValue(deltaHist)
      const lHist = extractLatestValue(latencyHist)

      if (epochs.length > 0) {
        setLedgerEpochs(epochs.slice(0, 30))
      }

      const hasPromData = Object.values(dHist).some(v => v > 0) ||
                          Object.values(rHist).some(v => v > 0) ||
                          Object.values(dInst).some(v => v > 0)
      const hasLedgerData = epochs.length > 0 || versions.some(v => (v as number) > 0)

      setConnected(hasPromData || hasLedgerData)

      setMetrics(prev => {
        const next = { ...prev }
        NODES.forEach((node, idx) => {
          const isUp = upMap[node.id] === 1
          const dScore = dInst[node.id] ?? dHist[node.id] ?? prev[node.id].driftScore
          const retrains = rInst[node.id] ?? rHist[node.id] ?? prev[node.id].retrainTotal
          const bytes = bInst[node.id] ?? bHist[node.id] ?? prev[node.id].deltaBytes
          const lat = lInst[node.id] ?? lHist[node.id] ?? prev[node.id].applyLatency
          const ver = (versions[idx] as number) || prev[node.id].modelVersion

          let nodeStatus: NodeMetrics['status'] = 'idle'
          if (prev[node.id].status === 'broadcasting') {
            nodeStatus = 'broadcasting'
          } else if (isUp && dScore > 0.05) {
            nodeStatus = 'drifting'
          }

          next[node.id] = {
            nodeId: node.id,
            driftScore: dScore,
            retrainTotal: retrains,
            deltaBytes: bytes,
            applyLatency: lat,
            modelVersion: ver,
            status: nodeStatus,
            up: isUp,
            lastUpdated: Date.now(),
          }
        })
        return next
      })
    } catch {
      // Keep previous state gracefully
    }
  }, [])

  const connectMqtt = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:9001', ['mqtt'])
      wsRef.current = ws

      ws.onopen = () => {
        // MQTT CONNECT packet
        const clientId = `swarm-ui-${Math.random().toString(36).slice(2, 8)}`
        const cid = new TextEncoder().encode(clientId)
        const pkt = new Uint8Array([
          0x10, 10 + cid.length,
          0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x3c,
          0x00, cid.length, ...cid,
        ])
        ws.send(pkt)

        // SUBSCRIBE to swarm/deltas/#
        const topic = new TextEncoder().encode('swarm/deltas/#')
        const sub = new Uint8Array([
          0x82, 2 + 2 + topic.length + 1,
          0x00, 0x01, 0x00, topic.length, ...topic, 0x00,
        ])
        ws.send(sub)
      }

      ws.onmessage = (e) => {
        if (!(e.data instanceof ArrayBuffer)) return
        const dv = new DataView(e.data)
        if ((dv.getUint8(0) >> 4) !== 3) return
        try {
          const tLen = dv.getUint16(1)
          const topicBytes = new Uint8Array(e.data, 3, tLen)
          const topic = new TextDecoder().decode(topicBytes)
          const payloadLen = e.data.byteLength - 3 - tLen

          const parts = topic.split('/')
          if (parts[0] === 'swarm' && parts[1] === 'deltas') {
            const seg = (parts[2] ?? '').split('-')
            const from = seg[1]?.toUpperCase() ?? '??'
            setMqttEvents(prev => [
              { topic, from, bytes: payloadLen, ts: Date.now() },
              ...prev.slice(0, 49),
            ])
            if (NODES.some(n => n.id === from)) {
              setMetrics(prev => ({
                ...prev,
                [from]: { ...prev[from as NodeId], status: 'broadcasting', lastUpdated: Date.now() },
              }))
              setTimeout(() => {
                setMetrics(prev => ({
                  ...prev,
                  [from]: { ...prev[from as NodeId], status: 'idle' },
                }))
              }, 4000)
            }
          }
        } catch { /* malformed packet */ }
      }
      ws.onerror = () => ws.close()
    } catch { /* MQTT unavailable */ }
  }, [])

  useEffect(() => {
    pollMetrics()
    connectMqtt()
    pollRef.current = setInterval(pollMetrics, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      wsRef.current?.close()
    }
  }, [pollMetrics, connectMqtt])

  return { metrics, connected, mqttEvents, ledgerEpochs, refetch: pollMetrics }
}
