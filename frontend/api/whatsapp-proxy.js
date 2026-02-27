// Vercel Serverless Function - WhatsApp Proxy via custom Bot API
// Forwards requests from HF backend to bot-whatsapp.podnet.space

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

    const { phone, target, message } = req.body;
    const phoneNumber = phone || target;

    if (!phoneNumber) {
        return res.status(400).json({ ok: false, error: 'Missing "phone" or "target"' });
    }

    // Bot API configuration
    const botUrl = process.env.WHATSAPP_BOT_URL || 'https://bot-whatsapp.podnet.space';
    const apiKey = process.env.WHATSAPP_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ ok: false, error: 'WHATSAPP_API_KEY not configured in Vercel env' });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${botUrl}/api/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
            },
            body: JSON.stringify({ phone: phoneNumber, message: message || '' }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (data.success) {
            return res.status(200).json({ ok: true, success: true, message: 'Sent via Bot API', detail: data });
        } else {
            console.error('Bot API error:', data);
            return res.status(400).json({
                ok: false,
                error: data.error || 'Bot API error',
                detail: data,
            });
        }
    } catch (error) {
        console.error('WhatsApp proxy error:', error);
        return res.status(500).json({ ok: false, error: error.message || 'Internal error' });
    }
}
