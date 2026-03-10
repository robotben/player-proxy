Vimeo Player Proxy Worker
A high-performance Cloudflare Worker designed to proxy the Vimeo embedded player. This script intercepts player requests, rewrites internal resource URLs (M3U8 playlists, JS, and CSS), and strips security headers to allow for flexible embedding and custom referer control.

🚀 Features
Header Spoofing: Automatically sets Referer and Host headers to trick Vimeo into serving content as if it were on a verified domain.

Dynamic URL Rewriting: Uses RegEx to scan HTML, JSON, and Manifest files, routing all .vimeocdn.com and .akamaized.net traffic through your worker.

CORS Bypass: Injects Access-Control-Allow-Origin: * headers and strips X-Frame-Options and Content-Security-Policy to prevent embed blocking.

Security: Includes a built-in domain allowlist to prevent the worker from being used as an open proxy for non-Vimeo traffic.

🛠️ How it Works
The worker operates in two modes based on the request parameters:

Main Player Mode: When you visit your-worker.com/VIDEO_ID, the worker fetches the official Vimeo player page and rewrites all internal links to point back to the worker.

Proxy Mode: When the worker sees a ?target= parameter, it acts as a relay for sub-resources (like video segments or player logic), ensuring the browser never has to connect directly to Vimeo's servers.

📦 Deployment
Create a New Worker: In your Cloudflare Dashboard, create a new HTTP Worker.

Paste the Code: Replace the default index.js content with the code from this repository.

Deploy: Click "Save and Deploy."

(Optional) Custom Domain: For the best results, attach a custom domain (e.g., player.yourdomain.com) in the "Triggers" tab.

📖 Usage
To load a video through your proxy, simply use your worker URL followed by the Vimeo Video ID:

Plaintext
https://your-worker-subdomain.workers.dev/123456789
You can also pass standard Vimeo player parameters:

Plaintext
https://your-worker-subdomain.workers.dev/123456789?autoplay=1&muted=1
⚠️ Disclaimer
This project is for educational and technical demonstration purposes. Ensure your use case complies with Vimeo's Terms of Service regarding third-party embedding and player modification.
