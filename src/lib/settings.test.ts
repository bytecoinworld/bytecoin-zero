import {
  ALTERNATE_NODE,
  checkNodePool,
  DEFAULT_NODE,
  DEFAULT_NODE_SETTINGS,
  enabledNodePool,
  getHostedProxyNodeId,
  getNodeEngineAddress,
  getNodeRpcAddress,
  normalizeNodeAddress,
  randomNodeFromPool,
  readNodeSettings,
} from './settings';

describe('normalizeNodeAddress', () => {
  it('accepts a secure node base URL or JSON-RPC endpoint', () => {
    expect(normalizeNodeAddress('https://node.example.org:8091/')).toBe('https://node.example.org:8091');
    expect(normalizeNodeAddress('https://node.example.org:8091/json_rpc')).toBe('https://node.example.org:8091');
  });

  it('rejects insecure or unsupported node URLs', () => {
    expect(() => normalizeNodeAddress('http://node.example.org:8091')).toThrow();
    expect(() => normalizeNodeAddress('https://node.example.org/wallet')).toThrow();
    expect(() => normalizeNodeAddress('https://user:pass@node.example.org')).toThrow();
  });
});

describe('randomNodeFromPool', () => {
  it('returns a different configured node when one is available', () => {
    expect(randomNodeFromPool(['https://one.example', 'https://two.example'], 'https://one.example'))
      .toBe('https://two.example');
  });

  describe('enabledNodePool', () => {
    it('excludes disabled nodes from automatic failover and rotation', () => {
      expect(enabledNodePool({
        activeNode: 'https://one.example',
        nodePool: ['https://one.example', 'https://two.example'],
        disabledNodes: ['https://two.example'],
        randomNode: false,
        rotationMinutes: 30,
      })).toEqual(['https://one.example']);
    });
  });

  it('keeps the active node when there are no alternatives', () => {
    expect(randomNodeFromPool(['https://one.example'], 'https://one.example')).toBe('https://one.example');
  });
});

describe('getNodeRpcAddress', () => {
  it('identifies only the curated hosted proxy nodes', () => {
    expect(getHostedProxyNodeId(DEFAULT_NODE)).toBeNull();
    expect(getHostedProxyNodeId(ALTERNATE_NODE)).toBe('alternate');
    expect(getHostedProxyNodeId('https://custom.example')).toBeNull();
  });

  it('keeps the CORS-enabled official node connected directly', () => {
    expect(getNodeRpcAddress(DEFAULT_NODE, false)).toBe(DEFAULT_NODE);
    expect(getNodeEngineAddress(DEFAULT_NODE, false)).toBe(DEFAULT_NODE);
  });

  it('uses the same-origin proxy for the alternate node on loopback-hosted previews', () => {
    const port = window.location.port || '80';
    expect(getNodeRpcAddress(ALTERNATE_NODE)).toBe(window.location.origin);
    expect(getNodeEngineAddress(ALTERNATE_NODE)).toBe(`127.0.0.1:${port}`);
  });

  it('uses the local proxy for the alternate node while preserving its root JSON-RPC endpoint', () => {
    const port = window.location.port || '80';
    expect(getNodeRpcAddress(ALTERNATE_NODE, true)).toBe(window.location.origin);
    expect(getNodeEngineAddress(ALTERNATE_NODE, true)).toBe(`127.0.0.1:${port}`);
    expect(getNodeRpcAddress(ALTERNATE_NODE, false)).toBe(ALTERNATE_NODE);
    expect(getNodeEngineAddress(ALTERNATE_NODE, false)).toBe('https://node.bytecoin.network:443');
    expect(getNodeEngineAddress('https://custom.example:8443', false)).toBe('https://custom.example:8443');
  });
});

describe('readNodeSettings', () => {
  const storageKey = 'bytecoin-zero.nodes';

  afterEach(() => {
    window.localStorage.removeItem(storageKey);
  });

  it('adds the alternate node when migrating the previous default-only pool', () => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      activeNode: DEFAULT_NODE,
      nodePool: [DEFAULT_NODE],
      randomNode: false,
      rotationMinutes: 30,
    }));

    expect(readNodeSettings()).toEqual(DEFAULT_NODE_SETTINGS);
  });

  it('preserves disabled nodes and disables rotation when fewer than two nodes are enabled', () => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      activeNode: DEFAULT_NODE,
      nodePool: [DEFAULT_NODE, ALTERNATE_NODE],
      disabledNodes: [ALTERNATE_NODE],
      randomNode: true,
      rotationMinutes: 30,
    }));

    const settings = readNodeSettings();
    expect(settings.disabledNodes).toEqual([ALTERNATE_NODE]);
    expect(settings.randomNode).toBe(false);
    expect(enabledNodePool(settings)).toEqual([DEFAULT_NODE]);
  });

  it('inserts a missing active node before deriving enabled-node settings', () => {
    const activeNode = 'https://active.example';
    const otherNode = 'https://other.example';
    window.localStorage.setItem(storageKey, JSON.stringify({
      activeNode,
      nodePool: [otherNode],
      disabledNodes: [otherNode],
      randomNode: true,
      rotationMinutes: 30,
    }));

    const settings = readNodeSettings();
    expect(settings.nodePool).toEqual([activeNode, otherNode]);
    expect(settings.disabledNodes).toEqual([otherNode]);
    expect(settings.randomNode).toBe(false);
    expect(enabledNodePool(settings)).toEqual([activeNode]);
  });
});

describe('checkNodePool', () => {
  const originalFetch = window.fetch;

  afterEach(() => {
    window.fetch = originalFetch;
  });

  it('keeps successful node checks while reporting individual failures', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({result: {top_known_block_height: 42}}),
      } as Response)
      .mockRejectedValueOnce(new Error('Failed to fetch'));
    window.fetch = fetchMock;

    await expect(checkNodePool(['https://one.example', 'https://two.example'])).resolves.toEqual([
      {node: 'https://one.example', height: 42},
      {node: 'https://two.example', error: 'Failed to fetch'},
    ]);
  });
});
