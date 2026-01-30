// Vercel Serverless Function - Telegram Photo Proxy
// Receives base64 image from HF backend and forwards to Telegram

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // Simple auth to prevent abuse
    const authHeader = req.headers['x-proxy-secret'];
    const expectedSecret = process.env.TELEGRAM_PROXY_SECRET;

    if (expectedSecret && authHeader !== expectedSecret) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { botToken, chatId, photoBase64, caption, filename } = req.body;

    if (!botToken || !chatId || !photoBase64) {
        return res.status(400).json({ ok: false, error: 'Missing botToken, chatId, or photoBase64' });
    }

    try {
        // Convert base64 to buffer
        const imageBuffer = Buffer.from(photoBase64, 'base64');

        // Create form data manually for Telegram
        const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

        let body = '';

        // Add chat_id
        body += `--${boundary}\r\n`;
        body += 'Content-Disposition: form-data; name="chat_id"\r\n\r\n';
        body += `${chatId}\r\n`;

        // Add caption if provided
        if (caption) {
            body += `--${boundary}\r\n`;
            body += 'Content-Disposition: form-data; name="caption"\r\n\r\n';
            body += `${caption}\r\n`;
        }

        // Add photo
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="photo"; filename="${filename || 'screenshot.png'}"\r\n`;
        body += 'Content-Type: image/png\r\n\r\n';

        // Create final buffer
        const bodyStart = Buffer.from(body, 'utf-8');
        const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
        const fullBody = Buffer.concat([bodyStart, imageBuffer, bodyEnd]);

        // Call Telegram API
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;

        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': fullBody.length.toString(),
            },
            body: fullBody,
        });

        const data = await response.json();

        if (data.ok) {
            return res.status(200).json({ ok: true, message: 'Photo sent successfully' });
        } else {
            return res.status(400).json({ ok: false, error: data.description || 'Telegram API error' });
        }
    } catch (error) {
        console.error('Telegram photo proxy error:', error);
        return res.status(500).json({ ok: false, error: error.message || 'Internal error' });
    }
}
