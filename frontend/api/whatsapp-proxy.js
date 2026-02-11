// Vercel Serverless Function - WhatsApp Proxy via Fonnte.com API
// Forwards requests from HF backend to Fonnte API
// Supports text messages and image uploads via multipart/form-data

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Proxy-Secret');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // Simple auth
    const authHeader = req.headers['x-proxy-secret'];
    const expectedSecret = process.env.WHATSAPP_PROXY_SECRET || process.env.TELEGRAM_PROXY_SECRET;

    if (expectedSecret && authHeader !== expectedSecret) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { target, message, imageBase64, filename } = req.body;

    if (!target) {
        return res.status(400).json({ ok: false, error: 'Missing "target"' });
    }

    // Fonnte API token (set in Vercel env vars)
    const fonnteToken = process.env.FONNTE_TOKEN;

    if (!fonnteToken) {
        return res.status(500).json({ ok: false, error: 'FONNTE_TOKEN not configured in Vercel env' });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        let response;

        if (imageBase64) {
            // Send image via multipart/form-data (Fonnte requires this for file uploads)
            const boundary = '----FonnteFormBoundary' + Date.now();
            const imageBuffer = Buffer.from(imageBase64, 'base64');
            const fname = filename || 'screenshot.png';

            // Build multipart body
            const parts = [];
            parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="target"\r\n\r\n${target}`);
            parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="message"\r\n\r\n${message || ''}`);
            parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fname}"\r\nContent-Type: image/png\r\n\r\n`);

            const beforeFile = Buffer.from(parts.join('\r\n') + '\r\n');
            const afterFile = Buffer.from(`\r\n--${boundary}--\r\n`);
            const body = Buffer.concat([beforeFile, imageBuffer, afterFile]);

            response = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: {
                    'Authorization': fonnteToken,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                },
                body: body,
                signal: controller.signal,
            });
        } else {
            // Send text-only message via JSON
            response = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: {
                    'Authorization': fonnteToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ target, message: message || '' }),
                signal: controller.signal,
            });
        }

        clearTimeout(timeoutId);

        const data = await response.json();

        if (data.status) {
            return res.status(200).json({ ok: true, status: true, message: 'Sent via Fonnte', detail: data });
        } else {
            console.error('Fonnte API error:', data);
            return res.status(400).json({
                ok: false,
                error: data.reason || data.detail || 'Fonnte API error',
                detail: data,
            });
        }
    } catch (error) {
        console.error('Fonnte proxy error:', error);
        return res.status(500).json({ ok: false, error: error.message || 'Internal error' });
    }
}
