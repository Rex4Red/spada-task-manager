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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const discordService_1 = require("./discordService");
class AttendanceService {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'https://spada.upnyk.ac.id';
        this.screenshotDir = path_1.default.join(process.cwd(), 'screenshots');
        // Ensure screenshot directory exists
        if (!fs_1.default.existsSync(this.screenshotDir)) {
            fs_1.default.mkdirSync(this.screenshotDir, { recursive: true });
        }
    }
    /**
     * Initialize the browser instance
     */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.browser) {
                console.log('[Attendance] Launching Puppeteer...');
                this.browser = yield puppeteer_1.default.launch({
                    headless: true,
                    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-software-rasterizer',
                        '--disable-extensions',
                        '--disable-background-networking',
                        '--disable-default-apps',
                        '--disable-sync',
                        '--disable-translate',
                        '--hide-scrollbars',
                        '--metrics-recording-only',
                        '--mute-audio',
                        '--no-first-run',
                        '--safebrowsing-disable-auto-update',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--js-flags=--max-old-space-size=256',
                        '--window-size=1280,720'
                    ],
                    defaultViewport: { width: 1280, height: 720 },
                    timeout: 60000
                });
                this.page = yield this.browser.newPage();
                yield this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            }
        });
    }
    /**
     * Close browser instance
     */
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.browser) {
                try {
                    const browserProcess = this.browser.process();
                    yield this.browser.close().catch(() => { });
                    // Force kill if still running
                    if (browserProcess && !browserProcess.killed) {
                        browserProcess.kill('SIGKILL');
                    }
                }
                catch (e) {
                    console.error('[Attendance] Error closing browser:', e);
                }
                finally {
                    this.browser = null;
                    this.page = null;
                }
            }
        });
    }
    /**
     * Login to SPADA
     */
    login(username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.page)
                yield this.init();
            try {
                console.log('[Attendance] Navigating to login page...');
                yield this.page.goto(`${this.baseUrl}/login/index.php`, { waitUntil: 'networkidle2', timeout: 30000 });
                // Check if already logged in
                const isLoggedIn = yield this.page.$('.logininfo a[href*="logout.php"]');
                if (isLoggedIn) {
                    console.log('[Attendance] Already logged in.');
                    return true;
                }
                console.log('[Attendance] Typing credentials...');
                yield this.page.type('#username', username);
                yield this.page.type('#password', password);
                yield Promise.all([
                    this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                    this.page.click('#loginbtn')
                ]);
                const success = yield this.page.$('.logininfo a[href*="logout.php"]');
                if (success) {
                    console.log('[Attendance] Login successful!');
                    return true;
                }
                else {
                    console.error('[Attendance] Login failed.');
                    return false;
                }
            }
            catch (error) {
                console.error('[Attendance] Error during login:', error);
                return false;
            }
        });
    }
    /**
     * Take screenshot and save to file
     */
    takeScreenshot(filename) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.page)
                throw new Error('Page not initialized');
            const filepath = path_1.default.join(this.screenshotDir, `${filename}_${Date.now()}.png`);
            yield this.page.screenshot({ path: filepath, fullPage: false });
            console.log(`[Attendance] Screenshot saved: ${filepath}`);
            return filepath;
        });
    }
    /**
     * Find and click attendance link (Attendance/Presensi/Kehadiran)
     */
    findAttendanceLink() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.page)
                return false;
            try {
                // Wait for page content to load
                yield new Promise(r => setTimeout(r, 3000));
                // Debug: log page URL and all activity links
                const currentUrl = this.page.url();
                console.log(`[Attendance] Current page URL: ${currentUrl}`);
                const debugInfo = yield this.page.evaluate(() => {
                    // Get all links on the page for debugging
                    const allLinks = Array.from(document.querySelectorAll('a'));
                    const attendanceKeywords = ['attendance', 'presensi', 'kehadiran', 'hadir'];
                    const matchingLinks = [];
                    for (const link of allLinks) {
                        const text = (link.textContent || '').trim().toLowerCase();
                        if (attendanceKeywords.some(kw => text.includes(kw))) {
                            matchingLinks.push({ text: (link.textContent || '').trim(), href: link.href });
                        }
                    }
                    // Also check for mod/attendance URLs
                    const modAttendanceLinks = allLinks
                        .filter(a => a.href && a.href.includes('mod/attendance'))
                        .map(a => ({ text: (a.textContent || '').trim(), href: a.href }));
                    return { matchingLinks, modAttendanceLinks, totalLinks: allLinks.length };
                });
                console.log(`[Attendance] Total links on page: ${debugInfo.totalLinks}`);
                console.log(`[Attendance] Links matching attendance keywords: ${JSON.stringify(debugInfo.matchingLinks)}`);
                console.log(`[Attendance] Links with mod/attendance URL: ${JSON.stringify(debugInfo.modAttendanceLinks)}`);
                // Strategy 1: Find by activity class + text (original)
                let attendanceLinks = yield this.page.evaluate(() => {
                    const xpath = "//li[contains(@class,'activity')]//a[contains(., 'Attendance') or contains(., 'Presensi') or contains(., 'Kehadiran')]";
                    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    const links = [];
                    for (let i = 0; i < result.snapshotLength; i++) {
                        const el = result.snapshotItem(i);
                        if (el && el.href)
                            links.push(el.href);
                    }
                    return links;
                });
                // Strategy 2: Find by mod/attendance URL pattern (more reliable)
                if (attendanceLinks.length === 0) {
                    console.log('[Attendance] Strategy 1 failed, trying URL pattern match...');
                    attendanceLinks = yield this.page.evaluate(() => {
                        const links = Array.from(document.querySelectorAll('a[href*="mod/attendance"]'));
                        return links.map(a => a.href).filter(href => href.includes('view.php'));
                    });
                }
                // Strategy 3: Find any link with attendance keywords (broadest)
                if (attendanceLinks.length === 0) {
                    console.log('[Attendance] Strategy 2 failed, trying broad text search...');
                    attendanceLinks = yield this.page.evaluate(() => {
                        const allLinks = Array.from(document.querySelectorAll('a'));
                        const keywords = ['attendance', 'presensi', 'kehadiran'];
                        return allLinks
                            .filter(a => {
                            const text = (a.textContent || '').toLowerCase();
                            return keywords.some(kw => text.includes(kw)) && a.href;
                        })
                            .map(a => a.href);
                    });
                }
                if (attendanceLinks.length > 0) {
                    // Navigate to last attendance link (most recent)
                    const targetUrl = attendanceLinks[attendanceLinks.length - 1];
                    console.log(`[Attendance] Found ${attendanceLinks.length} attendance link(s), navigating to: ${targetUrl}`);
                    yield this.page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    console.log('[Attendance] Attendance page loaded!');
                    return true;
                }
                console.log('[Attendance] No attendance links found on course page');
                return false;
            }
            catch (error) {
                console.error('[Attendance] Error finding attendance link:', error);
                return false;
            }
        });
    }
    /**
     * Submit attendance (click Submit, select Hadir, save)
     */
    submitAttendance() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.page)
                return { found: false, submitted: false, message: 'Page not initialized' };
            try {
                // Wait for page to load
                yield new Promise(r => setTimeout(r, 3000));
                // Find Submit/Ajukan button using XPath via evaluate
                const submitHref = yield this.page.evaluate(() => {
                    const xpath = "//a[contains(., 'Submit') or contains(., 'Ajukan') or contains(., 'Simpan')]";
                    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    const el = result.singleNodeValue;
                    return el ? el.href : null;
                });
                if (!submitHref) {
                    return { found: false, submitted: false, message: 'Submit button not found (attendance not yet opened or already closed)' };
                }
                // Navigate to submit page
                console.log('[Attendance] Navigating to submit page...');
                yield this.page.goto(submitHref, { waitUntil: 'networkidle2', timeout: 30000 });
                // Select "Hadir" (first radio button)
                const radioButtons = yield this.page.$$('input[type="radio"]');
                if (radioButtons.length > 0) {
                    yield radioButtons[0].click();
                    console.log('[Attendance] Selected Hadir (Present)');
                }
                // Click Save changes button
                const saveBtn = yield this.page.$('#id_submitbutton');
                if (saveBtn) {
                    yield saveBtn.click();
                    console.log('[Attendance] Clicked Save changes');
                    yield new Promise(r => setTimeout(r, 2000));
                    return { found: true, submitted: true, message: 'Attendance submitted successfully!' };
                }
                else {
                    return { found: true, submitted: false, message: 'Save button not found' };
                }
            }
            catch (error) {
                console.error('[Attendance] Error submitting attendance:', error);
                return { found: false, submitted: false, message: `Error: ${error}` };
            }
        });
    }
    /**
     * Main function: Run attendance for a course
     */
    runAttendance(courseUrl, username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.init();
                // Step 1: Login with retry (frame detachment can happen under resource pressure)
                let loggedIn = false;
                for (let attempt = 1; attempt <= 2; attempt++) {
                    loggedIn = yield this.login(username, password);
                    if (loggedIn)
                        break;
                    if (attempt < 2) {
                        console.log(`[Attendance] Login attempt ${attempt} failed, retrying...`);
                        yield this.close();
                        yield new Promise(r => setTimeout(r, 3000));
                        yield this.init();
                    }
                }
                if (!loggedIn) {
                    let screenshot;
                    try {
                        screenshot = yield this.takeScreenshot('login_failed');
                    }
                    catch (_a) { }
                    return {
                        success: false,
                        status: 'ERROR',
                        message: 'Login to SPADA failed',
                        screenshotPath: screenshot
                    };
                }
                // Step 2: Navigate to course
                console.log(`[Attendance] Navigating to course: ${courseUrl}`);
                yield this.page.goto(courseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                // Step 3: Find attendance link
                const attendanceFound = yield this.findAttendanceLink();
                if (!attendanceFound) {
                    const screenshot = yield this.takeScreenshot('attendance_not_found');
                    return {
                        success: false,
                        status: 'NOT_AVAILABLE',
                        message: 'Attendance link not found in course page',
                        screenshotPath: screenshot
                    };
                }
                // Step 4: Submit attendance
                const result = yield this.submitAttendance();
                if (result.submitted) {
                    const screenshot = yield this.takeScreenshot('attendance_success');
                    return {
                        success: true,
                        status: 'SUCCESS',
                        message: result.message,
                        screenshotPath: screenshot
                    };
                }
                else if (!result.found) {
                    const screenshot = yield this.takeScreenshot('submit_not_available');
                    return {
                        success: false,
                        status: 'NOT_AVAILABLE',
                        message: result.message,
                        screenshotPath: screenshot
                    };
                }
                else {
                    const screenshot = yield this.takeScreenshot('submit_failed');
                    return {
                        success: false,
                        status: 'FAILED',
                        message: result.message,
                        screenshotPath: screenshot
                    };
                }
            }
            catch (error) {
                console.error('[Attendance] Fatal error:', error);
                let screenshot;
                try {
                    screenshot = yield this.takeScreenshot('fatal_error');
                }
                catch (_b) { }
                return {
                    success: false,
                    status: 'ERROR',
                    message: `Fatal error: ${error}`,
                    screenshotPath: screenshot
                };
            }
            finally {
                yield this.close();
            }
        });
    }
    /**
     * Send Telegram notification with result
     */
    sendNotification(telegramService, chatId, botToken, courseName, result) {
        return __awaiter(this, void 0, void 0, function* () {
            let emoji = '❓';
            let color = discordService_1.DiscordColors.INFO;
            switch (result.status) {
                case 'SUCCESS':
                    emoji = '✅';
                    color = discordService_1.DiscordColors.SUCCESS;
                    break;
                case 'FAILED':
                    emoji = '❌';
                    color = discordService_1.DiscordColors.DANGER;
                    break;
                case 'NOT_AVAILABLE':
                    emoji = 'ℹ️';
                    color = discordService_1.DiscordColors.INFO;
                    break;
                case 'TIMEOUT':
                    emoji = '⏰';
                    color = discordService_1.DiscordColors.WARNING;
                    break;
                case 'ERROR':
                    emoji = '⚠️';
                    color = discordService_1.DiscordColors.DANGER;
                    break;
            }
            const message = `${emoji} *Auto Attendance Report*\n\n` +
                `📚 Course: ${courseName}\n` +
                `📊 Status: ${result.status}\n` +
                `💬 ${result.message}`;
            // Send screenshot first if available (Telegram only)
            if (result.screenshotPath && fs_1.default.existsSync(result.screenshotPath)) {
                yield telegramService.sendPhoto(chatId, result.screenshotPath, botToken, `📸 Screenshot: ${courseName}`);
            }
            // Then send text message
            yield telegramService.sendMessage(chatId, message, botToken);
        });
    }
    /**
     * Send Discord notification with result (includes screenshot if available)
     */
    sendDiscordNotification(discordService, webhookUrl, courseName, result) {
        return __awaiter(this, void 0, void 0, function* () {
            let emoji = '❓';
            let color = discordService_1.DiscordColors.INFO;
            switch (result.status) {
                case 'SUCCESS':
                    emoji = '✅';
                    color = discordService_1.DiscordColors.SUCCESS;
                    break;
                case 'FAILED':
                    emoji = '❌';
                    color = discordService_1.DiscordColors.DANGER;
                    break;
                case 'NOT_AVAILABLE':
                    emoji = 'ℹ️';
                    color = discordService_1.DiscordColors.INFO;
                    break;
                case 'TIMEOUT':
                    emoji = '⏰';
                    color = discordService_1.DiscordColors.WARNING;
                    break;
                case 'ERROR':
                    emoji = '⚠️';
                    color = discordService_1.DiscordColors.DANGER;
                    break;
            }
            const embed = {
                title: `${emoji} Auto Attendance Report`,
                color,
                fields: [
                    { name: '📚 Course', value: courseName, inline: true },
                    { name: '📊 Status', value: result.status, inline: true },
                    { name: '💬 Message', value: result.message }
                ],
                timestamp: new Date().toISOString()
            };
            // Send with screenshot if available
            if (result.screenshotPath && fs_1.default.existsSync(result.screenshotPath)) {
                yield discordService.sendEmbedWithImage(webhookUrl, embed, result.screenshotPath);
            }
            else {
                yield discordService.sendEmbed(webhookUrl, embed);
            }
        });
    }
    /**
     * Send WhatsApp notification with result (includes screenshot if available)
     */
    sendWhatsAppNotification(whatsappService, phoneNumber, courseName, result) {
        return __awaiter(this, void 0, void 0, function* () {
            let emoji = '❓';
            switch (result.status) {
                case 'SUCCESS':
                    emoji = '✅';
                    break;
                case 'FAILED':
                    emoji = '❌';
                    break;
                case 'NOT_AVAILABLE':
                    emoji = 'ℹ️';
                    break;
                case 'TIMEOUT':
                    emoji = '⏰';
                    break;
                case 'ERROR':
                    emoji = '⚠️';
                    break;
            }
            const caption = `${emoji} *Auto Attendance Report*

📚 *Course:* ${courseName}
📊 *Status:* ${result.status}
💬 *Message:* ${result.message}

_SPADA Task Manager_`;
            // Build screenshot URL from HF Space public host
            let screenshotUrl = '';
            if (result.screenshotPath && fs_1.default.existsSync(result.screenshotPath)) {
                const filename = path_1.default.basename(result.screenshotPath);
                // HF Spaces sets SPACE_HOST env var (e.g. "username-spacename.hf.space")
                const spaceHost = process.env.SPACE_HOST;
                if (spaceHost) {
                    screenshotUrl = `https://${spaceHost}/screenshots/${filename}`;
                }
                else {
                    // Local dev fallback
                    const port = process.env.PORT || 7860;
                    screenshotUrl = `http://localhost:${port}/screenshots/${filename}`;
                }
                console.log('[WhatsApp] Screenshot URL:', screenshotUrl);
            }
            // Build message with screenshot link if available
            const fullMessage = screenshotUrl
                ? `${caption}\n\n📷 Screenshot: ${screenshotUrl}`
                : caption;
            const textResult = yield whatsappService.sendMessage(phoneNumber, fullMessage);
            if (!textResult.success) {
                console.error('[WhatsApp] Notification failed:', textResult.error);
            }
        });
    }
}
exports.AttendanceService = AttendanceService;
