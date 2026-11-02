export interface INodeSettings {
  readonly activeNode: string;
  readonly nodePool: string[];
  readonly disabledNodes: string[];
  readonly randomNode: boolean;
  readonly rotationMinutes: number;
}

export type INodeCheckResult =
  | {readonly node: string; readonly height: number}
  | {readonly node: string; readonly error: string};

export const DEFAULT_NODE = 'https://node01.bytecoin.org:8091';
export const ALTERNATE_NODE = 'https://node.bytecoin.network';
export const DEFAULT_NODE_SETTINGS: INodeSettings = {
  activeNode: DEFAULT_NODE,
  nodePool: [DEFAULT_NODE, ALTERNATE_NODE],
  disabledNodes: [],
  randomNode: false,
  rotationMinutes: 30,
};

const STORAGE_KEY = 'bytecoin-zero.nodes';

export function normalizeNodeAddress(value: string): string {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Use an HTTPS node URL without credentials, query parameters, or fragments.');
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '/json_rpc') {
    throw new Error('Enter the node base URL or its /json_rpc URL.');
  }
  return parsed.origin;
}

export function readNodeSettings(): INodeSettings {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return DEFAULT_NODE_SETTINGS;
  }

  try {
    const parsed = JSON.parse(saved);
    const activeNode = normalizeNodeAddress(parsed.activeNode);
    const nodePool: string[] = Array.isArray(parsed.nodePool) ?
      Array.from(new Set<string>(parsed.nodePool.map((node: string) => normalizeNodeAddress(node)))) :
      [activeNode];

    if (nodePool.length === 1 && nodePool[0] === DEFAULT_NODE) {
      nodePool.push(ALTERNATE_NODE);
    }
    if (!nodePool.includes(activeNode)) {
      nodePool.unshift(activeNode);
    }

    const disabledNodes: string[] = Array.isArray(parsed.disabledNodes) ?
      Array.from(new Set<string>(parsed.disabledNodes.map((node: string) => normalizeNodeAddress(node))))
        .filter((node) => nodePool.includes(node)) :
      [];
    const enabledNodeCount = nodePool.filter((node) => !disabledNodes.includes(node)).length;

    return {
      activeNode,
      nodePool,
      disabledNodes,
      randomNode: parsed.randomNode === true && enabledNodeCount > 1,
      rotationMinutes: [5, 15, 30, 60].includes(parsed.rotationMinutes) ? parsed.rotationMinutes : 30,
    };
  } catch (error) {
    console.warn('Saved Bytecoin node settings are invalid; using the default node.', error);
    return DEFAULT_NODE_SETTINGS;
  }
}

function localProxyHost(): string {
  const hostname = window.location.hostname;
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ? hostname : '127.0.0.1';
}

function localProxyPort(): string {
  return window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function usesLocalNodeProxy(): boolean {
  return process.env.NODE_ENV === 'development' ||
    process.env.REACT_APP_USE_LOCAL_NODE_PROXY === 'true' ||
    isLoopbackHost(window.location.hostname);
}

export function getNodeRpcAddress(node: string, useLocalProxy = usesLocalNodeProxy()): string {
  const normalized = normalizeNodeAddress(node);
  if (useLocalProxy && normalized === ALTERNATE_NODE) {
    return window.location.origin;
  }
  return normalized;
}

export function getNodeEngineAddress(node: string, useLocalProxy = usesLocalNodeProxy()): string {
  const normalized = normalizeNodeAddress(node);
  if (useLocalProxy && normalized === ALTERNATE_NODE) {
    return `${localProxyHost()}:${localProxyPort()}`;
  }
  return normalized;
}

export function saveNodeSettings(settings: INodeSettings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function checkNodeStatus(node: string): Promise<number> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${getNodeRpcAddress(node)}/json_rpc`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({jsonrpc: '2.0', id: 'node-check', method: 'get_status', params: {}}),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    if (payload.error || !payload.result || payload.result.top_known_block_height < 1) {
      throw new Error(payload.error ? payload.error.message : 'Node has not synced any blocks.');
    }
    return payload.result.top_known_block_height;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function checkNodePool(nodes: string[]): Promise<INodeCheckResult[]> {
  const results: INodeCheckResult[] = [];
  for (const node of nodes) {
    try {
      results.push({node, height: await checkNodeStatus(node)});
    } catch (error) {
      results.push({node, error: error instanceof Error ? error.message : String(error)});
    }
  }
  return results;
}

export function randomNodeFromPool(nodes: string[], currentNode: string): string {
  const alternatives = nodes.filter((node) => node !== currentNode);
  if (alternatives.length === 0) {
    return currentNode;
  }
  return alternatives[Math.floor(Math.random() * alternatives.length)];
}

export function enabledNodePool(settings: INodeSettings): string[] {
  return settings.nodePool.filter((node) => !settings.disabledNodes.includes(node));
}
