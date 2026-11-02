import {onRequest} from '../../functions/_middleware';

class MockHeaders {
  private readonly values: {[name: string]: string} = {};

  constructor(initial: {[name: string]: string} = {}) {
    Object.keys(initial).forEach((name) => {
      this.values[name.toLowerCase()] = initial[name];
    });
  }

  get(name: string): string | null {
    return this.values[name.toLowerCase()] || null;
  }

  set(name: string, value: string): void {
    this.values[name.toLowerCase()] = value;
  }
}

class MockResponse {
  readonly body: unknown;
  readonly status: number;
  readonly headers: MockHeaders;

  constructor(body: unknown, init: {status?: number, headers?: MockHeaders} = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.headers = init.headers || new MockHeaders();
  }
}

describe('hosted node proxy middleware', () => {
  const originalFetch = window.fetch;
  const originalHeaders = window.Headers;
  const originalResponse = window.Response;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    Object.defineProperty(window, 'Headers', {configurable: true, value: MockHeaders});
    Object.defineProperty(window, 'Response', {configurable: true, value: MockResponse});
    fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      headers: new MockHeaders({'content-type': 'application/json'}),
      body: null,
    });
    window.fetch = fetchMock as typeof window.fetch;
  });

  afterEach(() => {
    window.fetch = originalFetch;
    Object.defineProperty(window, 'Headers', {configurable: true, value: originalHeaders});
    Object.defineProperty(window, 'Response', {configurable: true, value: originalResponse});
  });

  it('forwards only to the selected curated upstream', async () => {
    const response = await onRequest({
      request: {
        url: 'https://bcn.money/_node-proxy/alternate/json_rpc',
        method: 'POST',
        headers: new MockHeaders({
          origin: 'https://bcn.money',
          'content-type': 'application/json',
        }),
        body: null,
      },
      next: jest.fn(),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://node.bytecoin.network/json_rpc',
      expect.objectContaining({method: 'POST', redirect: 'manual'}),
    );
  });

  it('rejects unknown node IDs instead of forwarding arbitrary destinations', async () => {
    const response = await onRequest({
      request: {
        url: 'https://bcn.money/_node-proxy/custom/json_rpc',
        method: 'POST',
        headers: new MockHeaders(),
        body: null,
      },
      next: jest.fn(),
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects cross-origin calls and passes unrelated static paths through', async () => {
    const crossOriginResponse = await onRequest({
      request: {
        url: 'https://bcn.money/_node-proxy/default/json_rpc',
        method: 'POST',
        headers: new MockHeaders({
          cookie: 'bytecoin-node=default',
          origin: 'https://attacker.example',
        }),
        body: null,
      },
      next: jest.fn(),
    });
    const next = jest.fn().mockResolvedValue('static');
    const staticResponse = await onRequest({
      request: {
        url: 'https://bcn.money/privacy-policy/',
        method: 'GET',
        headers: new MockHeaders(),
        body: null,
      },
      next,
    });

    expect(crossOriginResponse.status).toBe(403);
    expect(staticResponse).toBe('static');
    expect(next).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
