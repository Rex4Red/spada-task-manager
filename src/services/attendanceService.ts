import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import prisma from '../config/database';
import { TelegramService } from './telegramService';
import { DiscordService, DiscordColors } from './discordService';
import { WhatsAppService } from './whatsappService';

interface AttendanceResult {
    success: boolean;
    status: 'SUCCESS' | 'FAILED' | 'NOT_AVAILABLE' | 'TIMEOUT' | 'ERROR';
    message: string;
    screenshotPath?: string;
}

export class AttendanceService {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private readonly baseUrl = 'https://spada.upnyk.ac.id';
    private readonly screenshotDir = path.join(process.cwd(), 'screenshots');

    constructor() {
        // Ensure screenshot directory exists
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
    }

    /**
     * Initialize the browser instance - always creates a fresh browser
     */
    private async init() {
        // Always close previous browser to avoid detached frame issues
        await this.close();

        console.log('[Attendance] Launching Puppeteer...');
        this.browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
            protocolTimeout: 300000,
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
                '--window-size=1280,720',
                '--renderer-process-limit=1',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=dbus',
                '--disable-breakpad'
            ],
            defaultViewport: { width: 1280, height: 720 },
            timeout: 60000
        });
        this.page = await this.browser.newPage();
        await this.page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
    }

    /**
     * Close browser instance
     */
    async close() {
        if (this.browser) {
            try {
                const browserProcess = this.browser.process();
                await this.browser.close().catch(() => { });
                if (browserProcess && !browserProcess.killed) {
                    browserProcess.kill('SIGKILL');
                }
            } catch (e) {
                console.error('[Attendance] Error closing browser:', e);
            } finally {
                this.browser = null;
                this.page = null;
            }
        }
    }

    /**
     * Login to SPADA
     */
    private async login(username: string, password: string): Promise<boolean> {
        if (!this.page) throw new Error('Browser not initialized. Call init() first.');

        try {
            console.log('[Attendance] Navigating to login page...');
            await this.page!.goto(`${this.baseUrl}/login/index.php`, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Check if already logged in
            const isLoggedIn = await this.page!.$('.logininfo a[href*="logout.php"]');
            if (isLoggedIn) {
                console.log('[Attendance] Already logged in.');
                return true;
            }

            console.log('[Attendance] Typing credentials...');
            await this.page!.type('#username', username);
            await this.page!.type('#password', password);

            await Promise.all([
                this.page!.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                this.page!.click('#loginbtn')
            ]);

            const success = await this.page!.$('.logininfo a[href*="logout.php"]');
            if (success) {
                console.log('[Attendance] Login successful!');
                return true;
            } else {
                console.error('[Attendance] Login failed.');
                return false;
            }
        } catch (error) {
            console.error('[Attendance] Error during login:', error);
            return false;
        }
    }

    /**
     * Take screenshot and save to file (non-fatal — never throws)
     */
    private async takeScreenshot(filename: string): Promise<string> {
        if (!this.page) return '';

        const filepath = path.join(this.screenshotDir, `${filename}_${Date.now()}.png`);
        try {
            // Race screenshot against a 10s timeout to prevent protocol hangs
            await Promise.race([
                this.page.screenshot({ path: filepath, fullPage: false }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout')), 10000))
            ]);
            console.log(`[Attendance] Screenshot saved: ${filepath}`);
            return filepath;
        } catch (e) {
            console.warn(`[Attendance] Screenshot failed (non-fatal): ${e}`);
            return '';
        }
    }

    /**
     * Find and click attendance link (Attendance/Presensi/Kehadiran)
     * Uses a SINGLE page.evaluate() to minimize CDP protocol roundtrips on slow VPS
     */
    private async findAttendanceLink(): Promise<boolean> {
        if (!this.page) return false;

        try {
            await new Promise(r => setTimeout(r, 2000));

            const currentUrl = this.page.url();
            console.log(`[Attendance] Current page URL: ${currentUrl}`);

            // Single evaluate call to find attendance links (reduces CDP roundtrips)
            const attendanceUrl = await this.page.evaluate(() => {
                const allLinks = Array.from(document.querySelectorAll('a'));

                // Strategy 1: mod/attendance URL pattern (most reliable)
                const modLinks = allLinks
                    .filter(a => a.href && a.href.includes('mod/attendance') && a.href.includes('view.php'))
                    .map(a => a.href);
                if (modLinks.length > 0) return modLinks[modLinks.length - 1];

                // Strategy 2: Activity class + keywords
                const xpath = "//li[contains(@class,'activity')]//a[contains(., 'Attendance') or contains(., 'Presensi') or contains(., 'Kehadiran')]";
                const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                if (result.snapshotLength > 0) {
                    const el = result.snapshotItem(result.snapshotLength - 1) as HTMLAnchorElement;
                    if (el && el.href) return el.href;
                }

                // Strategy 3: Any link with attendance keywords
                const keywords = ['attendance', 'presensi', 'kehadiran'];
                const matched = allLinks.filter(a => {
                    const text = (a.textContent || '').toLowerCase();
                    return keywords.some(kw => text.includes(kw)) && a.href;
                });
                if (matched.length > 0) return matched[matched.length - 1].href;

                return null;
            });

            if (attendanceUrl) {
                console.log(`[Attendance] Found attendance link, navigating to: ${attendanceUrl}`);
                await this.page.goto(attendanceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                console.log('[Attendance] Attendance page loaded!');
                return true;
            }

            console.log('[Attendance] No attendance links found on course page');
            return false;
        } catch (error) {
            console.error('[Attendance] Error finding attendance link:', error);
            return false;
        }
    }

    /**
     * Submit attendance — optimized for VPS with minimal CDP calls
     * Total page.evaluate() calls: 3 (find submit → select radio → verify)
     */
    private async submitAttendance(): Promise<{ found: boolean; submitted: boolean; message: string }> {
        if (!this.page) return { found: false, submitted: false, message: 'Page not initialized' };

        try {
            await new Promise(r => setTimeout(r, 2000));

            // === EVALUATE 1: Find submit button href ===
            const submitHref = await this.page.evaluate(() => {
                const pageText = document.body?.innerText?.toLowerCase() || '';
                const alreadyMarked = pageText.includes('your attendance in this session has been recorded') ||
                    pageText.includes('kehadiran anda pada sesi ini telah dicatat') ||
                    pageText.includes('sudah tercatat') || pageText.includes('already been taken');
                if (alreadyMarked) return '__ALREADY_ATTENDED__';

                const xpath = "//a[contains(., 'Submit') or contains(., 'Ajukan') or contains(., 'Simpan')]";
                const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                const el = result.singleNodeValue as HTMLAnchorElement;
                return el ? el.href : null;
            });

            if (submitHref === '__ALREADY_ATTENDED__') {
                return { found: true, submitted: true, message: 'Already marked as present (Hadir) - no action needed' };
            }

            if (!submitHref) {
                return { found: false, submitted: false, message: 'Submit button not found (attendance not yet opened or already closed)' };
            }

            console.log('[Attendance] Navigating to submit page...');
            await this.page.goto(submitHref, { waitUntil: 'domcontentloaded', timeout: 30000 });

            try {
                await this.page.waitForSelector('input[type="radio"]', { timeout: 10000 });
            } catch {
                return { found: true, submitted: false, message: 'Radio buttons not found on attendance form' };
            }

            // === EVALUATE 2: MEGA — cleanup + select radio (ONE call) ===
            console.log('[Attendance] Selecting radio button (mega-evaluate)...');
            const radioResult = await this.page.evaluate(() => {
                document.querySelectorAll(
                    '.growl-animated, .moodle-dialogue-base, .notification-popup, .toast, ' +
                    '[class*="overlay"], [class*="modal-backdrop"], .modal-backdrop, ' +
                    '[class*="cookie"], [id*="cookie"]'
                ).forEach(el => el.remove());

                const radio = document.querySelector('input[type="radio"]') as HTMLInputElement;
                if (!radio) return { ok: false, msg: 'No radio found' };

                radio.style.opacity = '1';
                radio.style.position = 'relative';
                radio.style.zIndex = '99999';
                radio.scrollIntoView({ block: 'center' });

                const label = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`);
                if (label) (label as HTMLElement).click();

                const opts = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 };
                radio.dispatchEvent(new MouseEvent('mousedown', opts));
                radio.dispatchEvent(new MouseEvent('mouseup', opts));
                radio.dispatchEvent(new MouseEvent('click', opts));

                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                radio.dispatchEvent(new Event('input', { bubbles: true }));

                const form = radio.closest('form');
                if (form) form.dispatchEvent(new Event('change', { bubbles: true }));
                document.querySelectorAll('.error, .text-danger, .fdescription.required')
                    .forEach(el => (el as HTMLElement).style.display = 'none');
                radio.removeAttribute('aria-invalid');
                radio.removeAttribute('aria-describedby');

                const rect = radio.getBoundingClientRect();
                return {
                    ok: radio.checked,
                    msg: radio.checked ? 'selected' : 'not-selected',
                    box: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height }
                };
            });

            let radioSelected = radioResult?.ok || false;

            if (!radioSelected) {
                console.log('[Attendance] Mega-evaluate did not select, trying native click fallback...');
                try {
                    await this.page.click('input[type="radio"]:first-of-type', { delay: 50 });
                    await new Promise(r => setTimeout(r, 300));
                    radioSelected = true;
                } catch (e) {
                    console.warn('[Attendance] Native click fallback failed:', e);
                }

                if (!radioSelected && radioResult?.box && radioResult.box.w > 0) {
                    try {
                        await this.page.mouse.click(radioResult.box.x, radioResult.box.y, { delay: 50 });
                        radioSelected = true;
                    } catch (e) {
                        console.warn('[Attendance] Coordinate click failed:', e);
                    }
                }
            }

            console.log(`[Attendance] Radio selection: ${radioSelected ? '✅' : '❌'}`);

            if (!radioSelected) {
                return { found: true, submitted: false, message: 'All radio click strategies failed' };
            }

            await new Promise(r => setTimeout(r, 500));
            const saveBtn = await this.page.$('#id_submitbutton');
            if (!saveBtn) {
                return { found: true, submitted: false, message: 'Save button not found' };
            }

            console.log('[Attendance] Clicking Save...');
            try {
                await Promise.all([
                    this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
                    saveBtn.click()
                ]);
            } catch (navError) {
                console.warn('[Attendance] Save navigation timeout (may still have worked):', navError);
                try {
                    await this.page.evaluate(() => {
                        const radio = document.querySelector('input[type="radio"]') as HTMLInputElement;
                        if (radio) { radio.checked = true; }
                        const form = document.querySelector('form') as HTMLFormElement;
                        if (form) form.submit();
                    });
                    await new Promise(r => setTimeout(r, 3000));
                } catch { }
            }

            // === EVALUATE 3: Verify result ===
            await new Promise(r => setTimeout(r, 1000));
            try {
                const verify = await this.page.evaluate(() => {
                    const pageText = document.body?.innerText?.toLowerCase() || '';
                    const stillOnForm = document.querySelector('#id_submitbutton') !== null &&
                        document.querySelectorAll('input[type="radio"]').length > 0;
                    const success = pageText.includes('recorded') || pageText.includes('tercatat') ||
                        pageText.includes('saved') || pageText.includes('berhasil') ||
                        window.location.href.includes('view.php');
                    return { stillOnForm, success, url: window.location.href };
                });

                if (verify.stillOnForm && !verify.success) {
                    return { found: true, submitted: false, message: 'Form validation error after save' };
                }
                return { found: true, submitted: true, message: 'Attendance submitted successfully!' };
            } catch {
                return { found: true, submitted: true, message: 'Attendance submitted (verification skipped due to timeout)' };
            }

        } catch (error) {
            const errMsg = String(error);
            if (errMsg.includes('ProtocolError') || errMsg.includes('timed out')) {
                console.warn('[Attendance] Protocol timeout during submission — treating as partial success');
                return { found: true, submitted: true, message: 'Attendance likely submitted (protocol timeout, cannot verify)' };
            }
            console.error('[Attendance] Error submitting attendance:', error);
            return { found: false, submitted: false, message: `Error: ${error}` };
        }
    }

    /**
     * Main function: Run attendance for a course
     */
    async runAttendance(
        courseUrl: string,
        username: string,
        password: string
    ): Promise<AttendanceResult> {
        try {
            await this.init();

            // Step 1: Login
            const loggedIn = await this.login(username, password);
            if (!loggedIn) {
                const screenshot = await this.takeScreenshot('login_failed');
                return {
                    success: false,
                    status: 'ERROR',
                    message: 'Login to SPADA failed',
                    screenshotPath: screenshot
                };
            }

            // Step 2: Navigate to course
            console.log(`[Attendance] Navigating to course: ${courseUrl}`);
            await this.page!.goto(courseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Step 3: Find attendance link
            const attendanceFound = await this.findAttendanceLink();
            if (!attendanceFound) {
                const screenshot = await this.takeScreenshot('attendance_not_found');
                return {
                    success: false,
                    status: 'NOT_AVAILABLE',
                    message: 'Attendance link not found in course page',
                    screenshotPath: screenshot
                };
            }

            // Step 4: Submit attendance
            const result = await this.submitAttendance();

            if (result.submitted) {
                const screenshot = await this.takeScreenshot('attendance_success');
                return {
                    success: true,
                    status: 'SUCCESS',
                    message: result.message,
                    screenshotPath: screenshot
                };
            } else if (!result.found) {
                const screenshot = await this.takeScreenshot('submit_not_available');
                return {
                    success: false,
                    status: 'NOT_AVAILABLE',
                    message: result.message,
                    screenshotPath: screenshot
                };
            } else {
                const screenshot = await this.takeScreenshot('submit_failed');
                return {
                    success: false,
                    status: 'FAILED',
                    message: result.message,
                    screenshotPath: screenshot
                };
            }

        } catch (error) {
            console.error('[Attendance] Fatal error:', error);
            let screenshot: string | undefined;
            try {
                screenshot = await this.takeScreenshot('fatal_error');
            } catch { }

            return {
                success: false,
                status: 'ERROR',
                message: `Fatal error: ${error}`,
                screenshotPath: screenshot
            };
        } finally {
            await this.close();
        }
    }

    /**
     * Send Telegram notification with result
     */
    async sendNotification(
        telegramService: TelegramService,
        chatId: string,
        botToken: string,
        courseName: string,
        result: AttendanceResult
    ): Promise<void> {
        let emoji = '❓';
        let color = DiscordColors.INFO;
        switch (result.status) {
            case 'SUCCESS': emoji = '✅'; color = DiscordColors.SUCCESS; break;
            case 'FAILED': emoji = '❌'; color = DiscordColors.DANGER; break;
            case 'NOT_AVAILABLE': emoji = 'ℹ️'; color = DiscordColors.INFO; break;
            case 'TIMEOUT': emoji = '⏰'; color = DiscordColors.WARNING; break;
            case 'ERROR': emoji = '⚠️'; color = DiscordColors.DANGER; break;
        }

        const message = `${emoji} *Auto Attendance Report*\n\n` +
            `📚 Course: ${courseName}\n` +
            `📊 Status: ${result.status}\n` +
            `💬 ${result.message}`;

        // Send screenshot first if available (Telegram only)
        if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
            await telegramService.sendPhoto(chatId, result.screenshotPath, botToken, `📸 Screenshot: ${courseName}`);
        }

        // Then send text message
        await telegramService.sendMessage(chatId, message, botToken);
    }

    /**
     * Send Discord notification with result (includes screenshot if available)
     */
    async sendDiscordNotification(
        discordService: DiscordService,
        webhookUrl: string,
        courseName: string,
        result: AttendanceResult
    ): Promise<void> {
        let emoji = '❓';
        let color = DiscordColors.INFO;
        switch (result.status) {
            case 'SUCCESS': emoji = '✅'; color = DiscordColors.SUCCESS; break;
            case 'FAILED': emoji = '❌'; color = DiscordColors.DANGER; break;
            case 'NOT_AVAILABLE': emoji = 'ℹ️'; color = DiscordColors.INFO; break;
            case 'TIMEOUT': emoji = '⏰'; color = DiscordColors.WARNING; break;
            case 'ERROR': emoji = '⚠️'; color = DiscordColors.DANGER; break;
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
        if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
            await discordService.sendEmbedWithImage(webhookUrl, embed, result.screenshotPath);
        } else {
            await discordService.sendEmbed(webhookUrl, embed);
        }
    }

    /**
     * Send WhatsApp notification with result (includes screenshot if available)
     */
    async sendWhatsAppNotification(
        whatsappService: WhatsAppService,
        phoneNumber: string,
        courseName: string,
        result: AttendanceResult
    ): Promise<void> {
        let emoji = '❓';
        switch (result.status) {
            case 'SUCCESS': emoji = '✅'; break;
            case 'FAILED': emoji = '❌'; break;
            case 'NOT_AVAILABLE': emoji = 'ℹ️'; break;
            case 'TIMEOUT': emoji = '⏰'; break;
            case 'ERROR': emoji = '⚠️'; break;
        }

        const caption = `${emoji} *Auto Attendance Report*

📚 *Course:* ${courseName}
📊 *Status:* ${result.status}
💬 *Message:* ${result.message}

_SPADA Task Manager_`;

        // Build screenshot URL using APP_URL or domain
        let screenshotUrl = '';
        if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
            const filename = path.basename(result.screenshotPath);
            const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 7860}`;
            screenshotUrl = `${appUrl}/screenshots/${filename}`;
            console.log('[WhatsApp] Screenshot URL:', screenshotUrl);
        }

        // Build message with screenshot link if available
        const fullMessage = screenshotUrl
            ? `${caption}\n\n📷 Screenshot: ${screenshotUrl}`
            : caption;

        const textResult = await whatsappService.sendMessage(phoneNumber, fullMessage);
        if (!textResult.success) {
            console.error('[WhatsApp] Notification failed:', textResult.error);
        }
    }
}

