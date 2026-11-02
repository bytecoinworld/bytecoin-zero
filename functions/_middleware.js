import hostedNodeProxyNodes from '../src/lib/hostedNodeProxyNodes.json';

const NODE_PROXY_COOKIE = 'bytecoin-node';
const MAX_RPC_BODY_BYTES = 2 * 1024 * 1024;
const RESPONSE_HEADERS = ['accept-ranges', 'content-range', 'content-type'];

function jsonResponse(status, message) {
  return new Response(JSON.stringify({error: message}), {
    status,
    headers: {'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8'},
  });
}

function allowedMethod(pathname, method) {
  if (pathname === '/json_rpc' || pathname === '/binary_rpc') {
    return method === 'POST';
  }

  if (!pathname.startsWith('/sync_blocks/')) {
    return false;
  }

  const segments = pathname.slice('/sync_blocks/'.length).split('/');
  return (method === 'GET' || method === 'HEAD') &&
    pathname.length <= 1024 &&
    segments.length > 0 &&
    segments.every((segment) => /^[A-Za-z0-9._~-]+$/.test(segment));
}

function readProxyNodeId(request) {
  const cookie = request.headers.get('cookie') || '';
  const entry = cookie.split(';').map((item) => item.trim())
    .find((item) => item.startsWith(`${NODE_PROXY_COOKIE}=`));
  return entry ? entry.substring(NODE_PROXY_COOKIE.length + 1) : '';
}

function relayRoute(pathname, request) {
  const prefix = '/_node-proxy/';
  if (pathname.startsWith(prefix)) {
    const match = pathname.slice(prefix.length).match(/^([a-z0-9_-]+)(\/.*)$/);
    return match ? {nodeId: match[1], pathname: match[2]} : {invalid: true};
  }

  if (pathname === '/json_rpc' || pathname === '/binary_rpc' || pathname.startsWith('/sync_blocks/')) {
    return {nodeId: readProxyNodeId(request), pathname};
  }
  return null;
}

async function readLimitedBody(request) {
  if (!request.body) {
    return new Uint8Array(0);
  }

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }

    total += result.value.byteLength;
    if (total > MAX_RPC_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(result.value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return body;
}

export async function onRequest(context) {
  const {request} = context;
  const requestUrl = new URL(request.url);
  const route = relayRoute(requestUrl.pathname, request);
  if (!route) {
    return context.next();
  }
  if (route.invalid) {
    return jsonResponse(404, 'Unknown node relay route.');
  }
  if (!allowedMethod(route.pathname, request.method)) {
    return jsonResponse(405, 'Method not allowed for this node endpoint.');
  }

  const origin = request.headers.get('origin');
  if (origin && origin !== requestUrl.origin) {
    return jsonResponse(403, 'Cross-origin requests are not allowed.');
  }

  const nodeId = route.nodeId;
  const nodeAddress = hostedNodeProxyNodes[nodeId];
  if (!nodeAddress) {
    return jsonResponse(400, 'Select a node supported by the bcn.money relay.');
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RPC_BODY_BYTES) {
    return jsonResponse(413, 'Node request body exceeds the allowed size.');
  }

  const body = request.method === 'GET' || request.method === 'HEAD' ?
    undefined : await readLimitedBody(request);
  if (body === null) {
    return jsonResponse(413, 'Node request body exceeds the allowed size.');
  }

  const upstreamUrl = new URL(`${route.pathname}${requestUrl.search}`, nodeAddress);
  const upstreamHeaders = new Headers();
  ['accept', 'content-type', 'range'].forEach((name) => {
    const value = request.headers.get(name);
    if (value) {
      upstreamHeaders.set(name, value);
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestUrl.pathname.startsWith('/sync_blocks/') ? 90000 : 30000);
  try {
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body,
      redirect: 'manual',
      signal: controller.signal,
    });
    const responseHeaders = new Headers({'cache-control': 'no-store'});
    RESPONSE_HEADERS.forEach((name) => {
      const value = upstreamResponse.headers.get(name);
      if (value) {
        responseHeaders.set(name, value);
      }
    });
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`bcn.money relay failed for ${nodeId} ${requestUrl.pathname}.`, error);
    return jsonResponse(502, 'The selected public node could not be reached.');
  } finally {
    clearTimeout(timeout);
  }
}
