// Vercel Serverless Function - Telegram Proxy
// This receives requests from the HF backend and forwards to Telegram

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // Simple auth to prevent abuse (optional secret)
    const authHeader = req.headers['x-proxy-secret'];
    const expectedSecret = process.env.TELEGRAM_PROXY_SECRET;

    if (expectedSecret && authHeader !== expectedSecret) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { botToken, chatId, text } = req.body;

    if (!botToken || !chatId || !text) {
        return res.status(400).json({ ok: false, error: 'Missing botToken, chatId, or text' });
    }

    try {
        // Call Telegram API
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
            }),
        });

        const data = await response.json();

        if (data.ok) {
            return res.status(200).json({ ok: true, message: 'Sent successfully' });
        } else {
            return res.status(400).json({ ok: false, error: data.description || 'Telegram API error' });
        }
    } catch (error) {
        console.error('Telegram proxy error:', error);
        return res.status(500).json({ ok: false, error: error.message || 'Internal error' });
    }
}
