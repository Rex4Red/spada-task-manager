// Vercel Serverless Function - Discord Webhook Proxy
// This receives requests from the HF backend and forwards to Discord
// Supports both JSON payloads and image attachments

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

    // Simple auth to prevent abuse (optional secret)
    const authHeader = req.headers['x-proxy-secret'];
    const expectedSecret = process.env.DISCORD_PROXY_SECRET || process.env.TELEGRAM_PROXY_SECRET;

    if (expectedSecret && authHeader !== expectedSecret) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { webhookUrl, payload, image } = req.body;

    if (!webhookUrl || !payload) {
        return res.status(400).json({ ok: false, error: 'Missing webhookUrl or payload' });
    }

    // Validate webhook URL is actually Discord
    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        return res.status(400).json({ ok: false, error: 'Invalid Discord webhook URL' });
    }

    try {
        let response;

        // Check if we have an image to send
        if (image && image.base64 && image.fileName) {
            // Build multipart form-data manually
            const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

            // Convert base64 to buffer
            const imageBuffer = Buffer.from(image.base64, 'base64');

            // Build the multipart body
            let body = '';

            // Add payload_json part
            body += `--${boundary}\r\n`;
            body += `Content-Disposition: form-data; name="payload_json"\r\n`;
            body += `Content-Type: application/json\r\n\r\n`;
            body += JSON.stringify(payload) + '\r\n';

            // Add file part - we need to create a buffer for binary data
            const payloadPart = Buffer.from(body, 'utf8');

            const fileHeader = Buffer.from(
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="files[0]"; filename="${image.fileName}"\r\n` +
                `Content-Type: image/png\r\n\r\n`,
                'utf8'
            );

            const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

            // Combine all parts
            const fullBody = Buffer.concat([payloadPart, fileHeader, imageBuffer, fileFooter]);

            response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                },
                body: fullBody
            });
        } else {
            // Standard JSON payload (no image)
            response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
        }

        // Discord returns 204 No Content on success, 200 on success with response
        if (response.ok || response.status === 204) {
            return res.status(200).json({ ok: true, message: 'Sent to Discord successfully' });
        } else {
            const errorText = await response.text();
            console.error('Discord API error:', response.status, errorText);
            return res.status(400).json({ ok: false, error: `Discord API error: ${response.status} - ${errorText}` });
        }
    } catch (error) {
        console.error('Discord proxy error:', error);
        return res.status(500).json({ ok: false, error: error.message || 'Internal error' });
    }
}
