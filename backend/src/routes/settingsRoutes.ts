import express from 'express';
import { protect } from '../middlewares/authMiddleware';
import { updateTelegramSettings, getSettings, testTelegramNotification, updateSpadaSettings } from '../controllers/settingsController';

const router = express.Router();

router.get('/', protect, getSettings);
router.put('/telegram', protect, updateTelegramSettings);
router.post('/telegram/test', protect, testTelegramNotification);
router.put('/spada', protect, updateSpadaSettings);

export default router;
