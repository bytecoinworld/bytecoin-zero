const proxy = require('http-proxy-middleware');

function allowedLocalOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) {
    return '';
  }

  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:') {
      return '';
    }

    const hostHeader = (req.headers.host || '').toLowerCase();
    const portMatch = hostHeader.match(/:(\d+)$/);
    const requestPort = portMatch ? portMatch[1] : '80';
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname);
    if ((isLoopback && (url.port || '80') === requestPort) ||
        (isIpv4 && url.host.toLowerCase() === hostHeader)) {
      return origin;
    }
  } catch (error) {
    return '';
  }

  return '';
}

function setCorsHeaders(req, res) {
  const origin = allowedLocalOrigin(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function allowedNodeMethods(pathname) {
  if (pathname === '/json_rpc' || pathname === '/binary_rpc') {
    return ['POST'];
  }
  if (pathname.startsWith('/sync_blocks/')) {
    return ['GET', 'HEAD'];
  }
  return [];
}

module.exports = (app) => {
  app.use((req, res, next) => {
    const pathname = (req.url || '').split('?')[0];
    const methods = allowedNodeMethods(pathname);
    if (methods.length === 0) {
      next();
      return;
    }

    const origin = allowedLocalOrigin(req);
    if (req.headers.origin && !origin) {
      res.statusCode = 403;
      res.end('Origin not allowed');
      return;
    }

    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      const requestedMethod = (req.headers['access-control-request-method'] || '').toUpperCase();
      if (!methods.includes(requestedMethod)) {
        res.statusCode = 405;
        res.end('Method not allowed');
        return;
      }
      res.setHeader('Access-Control-Allow-Methods', `${methods.join(', ')}, OPTIONS`);
      res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'content-type');
      res.setHeader('Access-Control-Max-Age', '600');
      if (req.headers['access-control-request-private-network'] === 'true') {
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
      }
      res.statusCode = 204;
      res.end();
      return;
    }

    if (!methods.includes(req.method)) {
      res.statusCode = 405;
      res.end('Method not allowed');
      return;
    }
    next();
  });

  app.use(proxy((pathname, req) => allowedNodeMethods(pathname).includes(req.method), {
    target: 'https://node.bytecoin.network',
    changeOrigin: true,
    secure: true,
    onProxyReq: (proxyReq) => proxyReq.removeHeader('origin'),
    onProxyRes: (proxyRes, req, res) => setCorsHeaders(req, res),
  }));
};
