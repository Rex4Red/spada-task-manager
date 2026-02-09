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
     * Initialize the browser instance
     */
    private async init() {
        if (!this.browser) {
            console.log('[Attendance] Launching Puppeteer...');
            this.browser = await puppeteer.launch({
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
            this.page = await this.browser.newPage();
            await this.page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );
        }
    }

    /**
     * Close browser instance
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    /**
     * Login to SPADA
     */
    private async login(username: string, password: string): Promise<boolean> {
        if (!this.page) await this.init();

        try {
            console.log('[Attendance] Navigating to login page...');
            await this.page!.goto(`${this.baseUrl}/login/index.php`, { waitUntil: 'networkidle2', timeout: 30000 });

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
                this.page!.waitForNavigation({ waitUntil: 'networkidle2' }),
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
     * Take screenshot and save to file
     */
    private async takeScreenshot(filename: string): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');

        const filepath = path.join(this.screenshotDir, `${filename}_${Date.now()}.png`);
        await this.page.screenshot({ path: filepath, fullPage: false });
        console.log(`[Attendance] Screenshot saved: ${filepath}`);
        return filepath;
    }

    /**
     * Find and click attendance link (Attendance/Presensi/Kehadiran)
     */
    private async findAttendanceLink(): Promise<boolean> {
        if (!this.page) return false;

        try {
            // Use page.evaluate for XPath instead of deprecated $x
            const attendanceLinks = await this.page.evaluate(() => {
                const xpath = "//li[contains(@class,'activity')]//a[contains(., 'Attendance') or contains(., 'Presensi') or contains(., 'Kehadiran')]";
                const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                const links: string[] = [];
                for (let i = 0; i < result.snapshotLength; i++) {
                    const el = result.snapshotItem(i) as HTMLAnchorElement;
                    if (el && el.href) links.push(el.href);
                }
                return links;
            });

            if (attendanceLinks.length > 0) {
                // Navigate to last attendance link
                const targetUrl = attendanceLinks[attendanceLinks.length - 1];
                console.log('[Attendance] Found attendance link, navigating...');
                await this.page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                console.log('[Attendance] Attendance page loaded!');
                return true;
            }

            return false;
        } catch (error) {
            console.error('[Attendance] Error finding attendance link:', error);
            return false;
        }
    }

    /**
     * Submit attendance (click Submit, select Hadir, save)
     */
    private async submitAttendance(): Promise<{ found: boolean; submitted: boolean; message: string }> {
        if (!this.page) return { found: false, submitted: false, message: 'Page not initialized' };

        try {
            // Wait for page to load
            await new Promise(r => setTimeout(r, 3000));

            // Find Submit/Ajukan button using XPath via evaluate
            const submitHref = await this.page.evaluate(() => {
                const xpath = "//a[contains(., 'Submit') or contains(., 'Ajukan') or contains(., 'Simpan')]";
                const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                const el = result.singleNodeValue as HTMLAnchorElement;
                return el ? el.href : null;
            });

            if (!submitHref) {
                return { found: false, submitted: false, message: 'Submit button not found (attendance not yet opened or already closed)' };
            }

            // Navigate to submit page
            console.log('[Attendance] Navigating to submit page...');
            await this.page.goto(submitHref, { waitUntil: 'networkidle2', timeout: 30000 });

            // Select "Hadir" (first radio button)
            const radioButtons = await this.page.$$('input[type="radio"]');
            if (radioButtons.length > 0) {
                await radioButtons[0].click();
                console.log('[Attendance] Selected Hadir (Present)');
            }

            // Click Save changes button
            const saveBtn = await this.page.$('#id_submitbutton');
            if (saveBtn) {
                await saveBtn.click();
                console.log('[Attendance] Clicked Save changes');
                await new Promise(r => setTimeout(r, 2000));
                return { found: true, submitted: true, message: 'Attendance submitted successfully!' };
            } else {
                return { found: true, submitted: false, message: 'Save button not found' };
            }

        } catch (error) {
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
            await this.page!.goto(courseUrl, { waitUntil: 'networkidle2', timeout: 30000 });

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

        // Send with screenshot if available
        if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
            try {
                const imageBuffer = fs.readFileSync(result.screenshotPath);
                const base64Image = imageBuffer.toString('base64');
                const mimetype = result.screenshotPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

                await whatsappService.sendImage(phoneNumber, base64Image, caption, mimetype);
            } catch (e) {
                console.error('Error reading screenshot for WhatsApp:', e);
                // Fallback to text message
                await whatsappService.sendMessage(phoneNumber, caption);
            }
        } else {
            // Send text only
            await whatsappService.sendMessage(phoneNumber, caption);
        }
    }
}

