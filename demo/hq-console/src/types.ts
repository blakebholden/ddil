/**
 * Type definitions for Elastic Cross-Cluster Demo
 */

export interface Cluster {
  id: string;
  name: string;
  region: string;
  type: 'cloud' | 'eck';
  intType?: 'HUMINT' | 'SIGINT' | 'FINTEL' | 'IMINT' | 'GEOINT' | 'MASINT' | 'OSINT' | 'CYBER' | 'CIP-FUSION';
  status: 'online' | 'offline' | 'connecting';
  endpoint: string;
  geo: GeoLocation;
  health?: ClusterHealth;
  stats?: ClusterStats;
}

export interface GeoLocation {
  lat: number;
  lon: number;
  regionName: string;
}

export interface ClusterHealth {
  status: 'green' | 'yellow' | 'red';
  numberOfNodes: number;
  numberOfDataNodes: number;
  activePrimaryShards: number;
  activeShards: number;
  relocatingShards: number;
  initializingShards: number;
  unassignedShards: number;
  pendingTasks: number;
}

export interface ClusterStats {
  indices: {
    count: number;
    docs: {
      count: number;
      deleted: number;
    };
    store: {
      sizeInBytes: number;
    };
  };
  nodes: {
    count: {
      total: number;
      data: number;
      master: number;
    };
  };
}

export interface LogEntry {
  '@timestamp': string;
  region: string;
  cluster: string;
  service: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  host: {
    name: string;
    ip: string;
  };
  pod: {
    name: string;
    namespace: string;
    uid: string;
  };
  geo: {
    location: {
      lat: number;
      lon: number;
    };
    region_name: string;
  };
  tags: string[];
  error?: {
    type: string;
    message: string;
    stack_trace?: string;
  };
  http?: {
    request: {
      method: string;
      path: string;
    };
    response: {
      status_code: number;
      body_bytes: number;
    };
  };
}

export interface MetricEntry {
  '@timestamp': string;
  region: string;
  cluster: string;
  service: string;
  metric_type: string;
  host: {
    name: string;
    ip: string;
  };
  geo: {
    location: {
      lat: number;
      lon: number;
    };
    region_name: string;
  };
  system: {
    cpu: {
      usage_percent: number;
      cores: number;
    };
    memory: {
      usage_percent: number;
      used_bytes: number;
      total_bytes: number;
    };
    disk: {
      usage_percent: number;
      used_bytes: number;
      total_bytes: number;
      iops: number;
    };
    network: {
      in_bytes: number;
      out_bytes: number;
      in_packets: number;
      out_packets: number;
    };
  };
  application: {
    response_time_ms: number;
    requests_per_second: number;
    error_rate: number;
    active_connections: number;
    queue_depth: number;
  };
}

export interface CrossClusterSearchQuery {
  clusters: string[];
  indices: string[];
  query: any;
  from?: number;
  size?: number;
  sort?: any[];
  aggs?: any;
}

export interface SearchResult<T = any> {
  took: number;
  timed_out: boolean;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: {
      value: number;
      relation: string;
    };
    max_score: number;
    hits: Array<{
      _index: string;
      _id: string;
      _score: number;
      _source: T;
    }>;
  };
  aggregations?: any;
  _clusters?: {
    total: number;
    successful: number;
    skipped: number;
  };
}

export interface RegionalInsight {
  region: string;
  cluster: string;
  errorRate: number;
  avgResponseTime: number;
  totalRequests: number;
  topErrors: Array<{
    type: string;
    count: number;
  }>;
  services: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'down';
    errorRate: number;
  }>;
}

export interface DemoStage {
  step: number;
  title: string;
  description: string;
  activeClusters: string[];
  actions: string[];
}
