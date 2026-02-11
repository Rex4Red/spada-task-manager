import { Router, Request, Response } from 'express';
import { whatsappService } from '../app';

const router = Router();

/**
 * GET /api/whatsapp/status
 * Returns WhatsApp connection status and QR code if available
 */
router.get('/status', (req: Request, res: Response) => {
    const info = whatsappService.getConnectionInfo();
    res.json(info);
});

/**
 * POST /api/whatsapp/connect
 * Initialize WhatsApp client connection
 */
router.post('/connect', async (req: Request, res: Response) => {
    try {
        await whatsappService.initClient();
        // Wait a moment for QR to generate
        await new Promise(r => setTimeout(r, 2000));
        const info = whatsappService.getConnectionInfo();
        res.json({ message: 'WhatsApp client connecting...', ...info });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/whatsapp/logout
 * Disconnect WhatsApp and clear session
 */
router.post('/logout', async (req: Request, res: Response) => {
    try {
        await whatsappService.logout();
        res.json({ message: 'WhatsApp disconnected and session cleared' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
