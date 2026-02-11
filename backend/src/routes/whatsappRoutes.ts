import { Router, Request, Response } from 'express';
import { whatsappService } from '../app';

const router = Router();

/**
 * GET /api/whatsapp/status
 * Returns WhatsApp service status (Fonnte configuration status)
 */
router.get('/status', async (req: Request, res: Response) => {
    const info = await whatsappService.checkStatus();
    res.json(info);
});

/**
 * POST /api/whatsapp/test
 * Send a test message
 */
router.post('/test', async (req: Request, res: Response) => {
    const { to, message } = req.body;
    if (!to || !message) {
        return res.status(400).json({ ok: false, error: 'Missing "to" or "message"' });
    }
    try {
        const result = await whatsappService.sendMessage(to, message);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

export default router;
