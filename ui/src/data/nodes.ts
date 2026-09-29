// Shared node metadata used across components
export const NODES = [
  { id: 'CA', name: 'California',  lat: 36.7,  lng: -119.4, rows: 241191, color: '#2563eb', bgColor: '#dbeafe' },
  { id: 'TX', name: 'Texas',       lat: 31.0,  lng: -100.0, rows: 178420, color: '#059669', bgColor: '#d1fae5' },
  { id: 'OH', name: 'Ohio',        lat: 40.4,  lng: -82.9,  rows: 163820, color: '#7c3aed', bgColor: '#ede9fe' },
  { id: 'WY', name: 'Wyoming',     lat: 43.0,  lng: -107.5, rows:  44392, color: '#d97706', bgColor: '#fef3c7' },
  { id: 'NY', name: 'New York',    lat: 43.0,  lng: -75.0,  rows: 210660, color: '#0ea5e9', bgColor: '#e0f2fe' },
  { id: 'NJ', name: 'New Jersey',  lat: 40.1,  lng: -74.5,  rows: 155020, color: '#dc2626', bgColor: '#fee2e2' },
] as const

export type NodeId = typeof NODES[number]['id']

export interface NodeMetrics {
  nodeId: NodeId
  driftScore: number
  retrainTotal: number
  deltaBytes: number
  applyLatency: number
  modelVersion: number
  status: 'idle' | 'drifting' | 'retraining' | 'broadcasting' | 'applying'
  up: boolean
  lastUpdated: number
}

// Parses a Prometheus query_range result into a per-node map
export type PrometheusResult = {
  metric: { node_id?: string; instance?: string; [k: string]: string | undefined }
  value?: [number, string]
  values?: [number, string][]
}

export function extractLatestValue(results: PrometheusResult[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const r of results) {
    const nodeId = r.metric.node_id ?? r.metric.instance?.split(':')[0].replace('node-', '').toUpperCase()
    if (!nodeId) continue
    if (r.value) {
      map[nodeId] = parseFloat(r.value[1]) || 0
    } else if (r.values && r.values.length > 0) {
      map[nodeId] = parseFloat(r.values[r.values.length - 1][1]) || 0
    }
  }
  return map
}
