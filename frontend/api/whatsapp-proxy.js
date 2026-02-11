// Vercel Serverless Function - WhatsApp Proxy via Fonnte.com API
// Forwards requests from HF backend to Fonnte API
// Same pattern as telegram-proxy.js and discord-proxy.js

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

    const { target, message, type, url } = req.body;

    if (!target) {
        return res.status(400).json({ ok: false, error: 'Missing "target"' });
    }

    // Fonnte API token (set in Vercel env vars)
    const fonnteToken = process.env.FONNTE_TOKEN;

    if (!fonnteToken) {
        return res.status(500).json({ ok: false, error: 'FONNTE_TOKEN not configured in Vercel env' });
    }

    try {
        // Build Fonnte API payload
        const payload = { target, message: message || '' };

        // Add media URL if sending image
        if (type === 'image' && url) {
            payload.url = url;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                'Authorization': fonnteToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

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
