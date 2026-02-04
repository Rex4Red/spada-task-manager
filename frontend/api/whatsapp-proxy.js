// Vercel Serverless Function - WhatsApp Bot Proxy
// Forwards requests from HF backend to Koyeb WhatsApp bot
// Supports both text messages and image sending

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

    const { to, message, type, media, caption } = req.body;

    if (!to) {
        return res.status(400).json({ ok: false, error: 'Missing "to"' });
    }

    // WhatsApp bot config
    const botUrl = process.env.WHATSAPP_BOT_URL || 'https://very-ardith-bot-wa-absen-spada-69b791b2.koyeb.app';
    const apiKey = process.env.WHATSAPP_API_KEY || '123230161';

    try {
        let payload;

        // Check if it's an image or text message
        if (type === 'image' && media) {
            // Image message
            payload = {
                to,
                type: 'image',
                media,
                caption: caption || ''
            };
        } else if (message) {
            // Text message
            payload = { to, message };
        } else {
            return res.status(400).json({ ok: false, error: 'Missing "message" or "media"' });
        }

        const response = await fetch(`${botUrl}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            const data = await response.json().catch(() => ({}));
            return res.status(200).json({ ok: true, message: 'Sent to WhatsApp', data });
        } else {
            const errorText = await response.text();
            console.error('WhatsApp bot error:', response.status, errorText);
            return res.status(400).json({ ok: false, error: `WhatsApp API error: ${response.status} - ${errorText}` });
        }
    } catch (error) {
        console.error('WhatsApp proxy error:', error);
        return res.status(500).json({ ok: false, error: error.message || 'Internal error' });
    }
}
