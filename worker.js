export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const workerDomain = url.host; // e.g. player.mydomain.com

    // 1. Check if we are proxying a specific sub-resource (image, video chunk, etc.)
    const targetParam = url.searchParams.get('target');

    if (targetParam) {
      return handleProxyRequest(request, targetParam, workerDomain);
    }

    // 2. If no target, we are loading the Main Player
    return handleMainPlayer(request, workerDomain);
  },
};

// --- HANDLER: The Main Player Page ---
async function handleMainPlayer(request, workerDomain) {
  const url = new URL(request.url);
  
  // Construct the real Vimeo URL (preserve video ID and params like ?autoplay=1)
  const vimeoUrl = new URL(`https://player.vimeo.com${url.pathname}${url.search}`);

  const proxyReq = new Request(vimeoUrl, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers),
      'Host': 'player.vimeo.com',
      'Referer': 'https://vimeo.com/', // Tricks Vimeo into thinking it's valid
    }
  });

  const response = await fetch(proxyReq);
  
  // Rewrite the HTML to force it to use our proxy for sub-resources
  let body = await response.text();
  body = rewriteBody(body, workerDomain);

  // Clean headers to allow embedding
  const newHeaders = new Headers(response.headers);
  newHeaders.delete('x-frame-options');
  newHeaders.delete('content-security-policy');
  newHeaders.set('Access-Control-Allow-Origin', '*');

  return new Response(body, {
    status: response.status,
    headers: newHeaders
  });
}

// --- HANDLER: Sub-Resources (Video files, JS, CSS, Images) ---
async function handleProxyRequest(request, targetUrl, workerDomain) {
  // Validate target to prevent open relay abuse
  // We only allow traffic to Vimeo-owned domains
  const allowedDomains = ['vimeo.com', 'vimeocdn.com', 'akamaized.net', 'google-analytics.com'];
  try {
    const targetObj = new URL(targetUrl);
    const isAllowed = allowedDomains.some(d => targetObj.hostname.endsWith(d));
    if (!isAllowed) return new Response('Forbidden Domain', { status: 403 });
  } catch (e) {
    return new Response('Invalid URL', { status: 400 });
  }

  const proxyReq = new Request(targetUrl, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers),
      'Host': new URL(targetUrl).hostname,
      'Referer': 'https://player.vimeo.com/', // Maintain the illusion
    }
  });

  let response = await fetch(proxyReq);

  // If the sub-resource is a Playlist (m3u8) or JSON config, we MUST rewrite URLs inside it too
  const contentType = response.headers.get('content-type') || '';
  const needsRewrite = contentType.includes('text') || 
                       contentType.includes('json') || 
                       contentType.includes('mpegurl') || 
                       contentType.includes('javascript');

  if (needsRewrite) {
    let body = await response.text();
    body = rewriteBody(body, workerDomain);
    
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    
    return new Response(body, {
      status: response.status,
      headers: newHeaders
    });
  }

  // If it's binary data (video chunks, images), just stream it
  return new Response(response.body, response);
}

// --- HELPER: The Magic Rewriter ---
function rewriteBody(text, workerDomain) {
  // Regex Explanation:
  // Matches http/https URLs that contain vimeocdn, vimeo, or akamaized
  const regex = /(https?:\\\/\\\/|https?:\/\/)(?:[a-zA-Z0-9-]+\\.)+(vimeocdn\.com|vimeo\.com|akamaized\.net)([^"'\s\\]*)/g;

  return text.replace(regex, (match) => {
    // If the match was escaped (JSON), unescape it first to make a valid URL
    let cleanUrl = match.replace(/\\\//g, '/'); 
    
    // Create the proxy URL
    return `https://${workerDomain}/?target=${encodeURIComponent(cleanUrl)}`;
  });
}
