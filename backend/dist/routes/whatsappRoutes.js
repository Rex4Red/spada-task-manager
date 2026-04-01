"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const app_1 = require("../app");
const router = (0, express_1.Router)();
/**
 * GET /api/whatsapp/status
 * Returns WhatsApp service status (Fonnte configuration status)
 */
router.get('/status', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const info = yield app_1.whatsappService.checkStatus();
    res.json(info);
}));
/**
 * POST /api/whatsapp/test
 * Send a test message
 */
router.post('/test', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { to, message } = req.body;
    if (!to || !message) {
        return res.status(400).json({ ok: false, error: 'Missing "to" or "message"' });
    }
    try {
        const result = yield app_1.whatsappService.sendMessage(to, message);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
}));
exports.default = router;
