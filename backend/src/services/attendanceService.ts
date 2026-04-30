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
                protocolTimeout: 120000,
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
            try {
                const browserProcess = this.browser.process();
                await this.browser.close().catch(() => { });
                // Force kill if still running
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
        if (!this.page) await this.init();

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
     */
    private async findAttendanceLink(): Promise<boolean> {
        if (!this.page) return false;

        try {
            // Wait for page content to load
            await new Promise(r => setTimeout(r, 3000));

            // Debug: log page URL and all activity links
            const currentUrl = this.page.url();
            console.log(`[Attendance] Current page URL: ${currentUrl}`);

            const debugInfo = await this.page.evaluate(() => {
                // Get all links on the page for debugging
                const allLinks = Array.from(document.querySelectorAll('a'));
                const attendanceKeywords = ['attendance', 'presensi', 'kehadiran', 'hadir'];
                const matchingLinks: { text: string; href: string }[] = [];

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
            let attendanceLinks = await this.page.evaluate(() => {
                const xpath = "//li[contains(@class,'activity')]//a[contains(., 'Attendance') or contains(., 'Presensi') or contains(., 'Kehadiran')]";
                const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                const links: string[] = [];
                for (let i = 0; i < result.snapshotLength; i++) {
                    const el = result.snapshotItem(i) as HTMLAnchorElement;
                    if (el && el.href) links.push(el.href);
                }
                return links;
            });

            // Strategy 2: Find by mod/attendance URL pattern (more reliable)
            if (attendanceLinks.length === 0) {
                console.log('[Attendance] Strategy 1 failed, trying URL pattern match...');
                attendanceLinks = await this.page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a[href*="mod/attendance"]'));
                    return links.map(a => (a as HTMLAnchorElement).href).filter(href => href.includes('view.php'));
                });
            }

            // Strategy 3: Find any link with attendance keywords (broadest)
            if (attendanceLinks.length === 0) {
                console.log('[Attendance] Strategy 2 failed, trying broad text search...');
                attendanceLinks = await this.page.evaluate(() => {
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
                await this.page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
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
     * Submit attendance (click Submit, select Hadir, save)
     * Uses multi-strategy radio click: native click → coordinate click → full MouseEvent dispatch
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
            await this.page.goto(submitHref, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for radio buttons to be present in DOM
            try {
                await this.page.waitForSelector('input[type="radio"]', { timeout: 10000 });
                console.log('[Attendance] Radio buttons found in DOM');
            } catch {
                console.error('[Attendance] Radio buttons not found after waiting');
                return { found: true, submitted: false, message: 'Radio buttons not found on attendance form' };
            }

            // Pre-click: Dismiss any overlays, popups, or blocking elements
            await this.page.evaluate(() => {
                // Remove Moodle notification popups
                document.querySelectorAll('.growl-animated, .moodle-dialogue-base, .notification-popup, .toast')
                    .forEach(el => (el as HTMLElement).remove());
                // Remove any overlays or modal backdrops
                document.querySelectorAll('[class*="overlay"], [class*="modal-backdrop"], .modal-backdrop')
                    .forEach(el => (el as HTMLElement).remove());
                // Remove cookie consent banners that might block
                document.querySelectorAll('[class*="cookie"], [id*="cookie"]')
                    .forEach(el => (el as HTMLElement).remove());
            });
            console.log('[Attendance] Cleared overlays/popups');

            // Get radio button info for logging
            const radioInfo = await this.page.evaluate(() => {
                const radios = document.querySelectorAll('input[type="radio"]');
                if (radios.length === 0) return null;
                const first = radios[0] as HTMLInputElement;
                return {
                    id: first.id,
                    name: first.name,
                    value: first.value,
                    totalRadios: radios.length,
                    hasLabel: !!(first.closest('label') || document.querySelector(`label[for="${first.id}"]`))
                };
            });

            if (!radioInfo) {
                return { found: true, submitted: false, message: 'No radio buttons found after overlay cleanup' };
            }
            console.log('[Attendance] Radio info:', JSON.stringify(radioInfo));

            // ===== MULTI-STRATEGY RADIO CLICK =====
            let radioSelected = false;

            // Strategy 1: Puppeteer native page.click() — sends REAL CDP mouse events
            // This triggers mousedown → mouseup → click at the browser level
            console.log('[Attendance] Strategy 1: Puppeteer native page.click()');
            try {
                // Scroll radio into view first
                await this.page.evaluate(() => {
                    const radio = document.querySelector('input[type="radio"]');
                    if (radio) radio.scrollIntoView({ block: 'center' });
                });
                await new Promise(r => setTimeout(r, 300));

                // Try clicking the radio directly with Puppeteer
                await this.page.click('input[type="radio"]:first-of-type', { delay: 50 });
                await new Promise(r => setTimeout(r, 500));

                // Verify
                radioSelected = await this.page.evaluate(() => {
                    const radio = document.querySelector('input[type="radio"]') as HTMLInputElement;
                    return radio ? radio.checked : false;
                });
                console.log(`[Attendance] Strategy 1 result: ${radioSelected ? '✅ selected' : '❌ not selected'}`);
            } catch (e) {
                console.warn('[Attendance] Strategy 1 failed:', e);
            }

            // Strategy 2: Click by coordinates (bypasses element interception)
            if (!radioSelected) {
                console.log('[Attendance] Strategy 2: Click by coordinates');
                try {
                    const box = await this.page.evaluate(() => {
                        const radio = document.querySelector('input[type="radio"]');
                        if (!radio) return null;
                        // Make sure it's visible
                        (radio as HTMLElement).style.opacity = '1';
                        (radio as HTMLElement).style.position = 'relative';
                        (radio as HTMLElement).style.zIndex = '99999';
                        const rect = radio.getBoundingClientRect();
                        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, w: rect.width, h: rect.height };
                    });

                    if (box && box.w > 0 && box.h > 0) {
                        await this.page.mouse.click(box.x, box.y, { delay: 50 });
                        await new Promise(r => setTimeout(r, 500));

                        radioSelected = await this.page.evaluate(() => {
                            const radio = document.querySelector('input[type="radio"]') as HTMLInputElement;
                            return radio ? radio.checked : false;
                        });
                        console.log(`[Attendance] Strategy 2 result: ${radioSelected ? '✅ selected' : '❌ not selected'}`);
                    }
                } catch (e) {
                    console.warn('[Attendance] Strategy 2 failed:', e);
                }
            }

            // Strategy 3: Click the label element (if it exists)
            if (!radioSelected) {
                console.log('[Attendance] Strategy 3: Click label element');
                try {
                    const labelSelector = radioInfo.id
                        ? `label[for="${radioInfo.id}"]`
                        : null;

                    if (labelSelector) {
                        await this.page.click(labelSelector, { delay: 50 });
                        await new Promise(r => setTimeout(r, 500));
                    }

                    // Also try clicking the closest label
                    await this.page.evaluate(() => {
                        const radio = document.querySelector('input[type="radio"]') as HTMLInputElement;
                        if (!radio) return;
                        const label = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`);
                        if (label) (label as HTMLElement).click();
                    });
                    await new Promise(r => setTimeout(r, 500));

                    radioSelected = await this.page.evaluate(() => {
                        const radio = document.querySelector('input[type="radio"]') as HTMLInputElement;
                        return radio ? radio.checked : false;
                    });
                    console.log(`[Attendance] Strategy 3 result: ${radioSelected ? '✅ selected' : '❌ not selected'}`);
                } catch (e) {
                    console.warn('[Attendance] Strategy 3 failed:', e);
                }
            }

            // Strategy 4: Full MouseEvent dispatch + forced checked + form manipulation
            if (!radioSelected) {
                console.log('[Attendance] Strategy 4: Full MouseEvent dispatch + force check');
                try {
                    await this.page.evaluate(() => {
                        const radio = document.querySelector('input[type="radio"]') as HTMLInputElement;
                        if (!radio) return;

                        // Dispatch full mouse event sequence (what a real click does)
                        const eventOptions = { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 };
                        radio.dispatchEvent(new MouseEvent('mousedown', eventOptions));
                        radio.dispatchEvent(new MouseEvent('mouseup', eventOptions));
                        radio.dispatchEvent(new MouseEvent('click', eventOptions));

                        // Force checked state
                        radio.checked = true;

                        // Dispatch all possible change/input events
                        radio.dispatchEvent(new Event('change', { bubbles: true }));
                        radio.dispatchEvent(new Event('input', { bubbles: true }));

                        // Also trigger on the form element
                        const form = radio.closest('form');
                        if (form) {
                            form.dispatchEvent(new Event('change', { bubbles: true }));
                        }

                        // Try to clear Moodle's form validation error state
                        const errorElements = document.querySelectorAll('.error, .text-danger, .fdescription.required');
                        errorElements.forEach(el => (el as HTMLElement).style.display = 'none');

                        // Remove aria-invalid if present
                        radio.removeAttribute('aria-invalid');
                        radio.removeAttribute('aria-describedby');
                    });
                    await new Promise(r => setTimeout(r, 500));

                    radioSelected = await this.page.evaluate(() => {
                        const radio = document.querySelector('input[type="radio"]') as HTMLInputElement;
                        return radio ? radio.checked : false;
                    });
                    console.log(`[Attendance] Strategy 4 result: ${radioSelected ? '✅ selected' : '❌ not selected'}`);
                } catch (e) {
                    console.warn('[Attendance] Strategy 4 failed:', e);
                }
            }

            if (!radioSelected) {
                console.error('[Attendance] ❌ All strategies failed to select radio button!');
                return { found: true, submitted: false, message: 'All radio click strategies failed' };
            }

            console.log('[Attendance] ✅ Radio button is checked, proceeding to save');

            // Extra delay to ensure Moodle's form state is synced
            await new Promise(r => setTimeout(r, 1000));

            // Click Save changes button with navigation wait
            const saveBtn = await this.page.$('#id_submitbutton');
            if (saveBtn) {
                console.log('[Attendance] Clicking Save changes and waiting for navigation...');

                // Use Promise.all to wait for navigation after click
                try {
                    await Promise.all([
                        this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
                        saveBtn.click()
                    ]);
                    console.log('[Attendance] Page navigated after Save click');
                } catch (navError) {
                    console.warn('[Attendance] Navigation after save timed out or failed:', navError);

                    // Check if we're still on form with validation error — retry radio click + save
                    const stillOnForm = await this.page.evaluate(() => {
                        return document.querySelector('#id_submitbutton') !== null &&
                            document.querySelectorAll('input[type="radio"]').length > 0;
                    });

                    if (stillOnForm) {
                        console.log('[Attendance] Still on form after save — retrying with forced submit');

                        // Force the radio again and submit via JavaScript
                        await this.page.evaluate(() => {
                            const radio = document.querySelector('input[type="radio"]') as HTMLInputElement;
                            if (radio) {
                                radio.checked = true;
                                radio.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                                radio.dispatchEvent(new Event('change', { bubbles: true }));
                            }

                            // Clear validation errors
                            document.querySelectorAll('.error, .text-danger, .fdescription.required, [aria-invalid]').forEach(el => {
                                (el as HTMLElement).style.display = 'none';
                                el.removeAttribute('aria-invalid');
                            });
                        });
                        await new Promise(r => setTimeout(r, 500));

                        // Try submitting the form directly via JavaScript
                        try {
                            await Promise.all([
                                this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
                                this.page.evaluate(() => {
                                    const form = document.querySelector('form') as HTMLFormElement;
                                    if (form) form.submit();
                                })
                            ]);
                            console.log('[Attendance] Form submitted via JavaScript');
                        } catch (e2) {
                            console.warn('[Attendance] JS form submit also failed:', e2);
                        }
                    }
                }

                // Wait a moment for the page to settle
                await new Promise(r => setTimeout(r, 2000));

                // Verify submission by checking the result page
                const verifyResult = await this.page.evaluate(() => {
                    const pageText = document.body.innerText.toLowerCase();
                    const currentUrl = window.location.href;

                    // Check if we're still on the form page (submission failed)
                    const stillOnForm = document.querySelector('#id_submitbutton') !== null;
                    const hasRadios = document.querySelectorAll('input[type="radio"]').length > 0;
                    const hasValidationError = pageText.includes('required') ||
                        document.querySelector('.error, .alert-danger, .text-danger, .fdescription.required') !== null;

                    // Check for success indicators
                    const hasSuccessIndicator =
                        pageText.includes('your attendance in this session has been recorded') ||
                        pageText.includes('kehadiran anda pada sesi ini telah dicatat') ||
                        pageText.includes('sudah tercatat') ||
                        pageText.includes('changes saved') ||
                        pageText.includes('berhasil disimpan') ||
                        currentUrl.includes('view.php'); // Redirected back to attendance view

                    return {
                        stillOnForm: stillOnForm && hasRadios,
                        hasValidationError,
                        hasSuccessIndicator,
                        currentUrl,
                        pageTitle: document.title
                    };
                });

                console.log('[Attendance] Verification result:', JSON.stringify(verifyResult));

                if (verifyResult.stillOnForm && verifyResult.hasValidationError) {
                    return { found: true, submitted: false, message: 'Form validation error - radio button may not have been selected properly' };
                }

                if (verifyResult.stillOnForm && !verifyResult.hasSuccessIndicator) {
                    return { found: true, submitted: false, message: 'Still on form page after save - submission may have failed' };
                }

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

            // Step 1: Login with retry (frame detachment can happen under resource pressure)
            let loggedIn = false;
            for (let attempt = 1; attempt <= 2; attempt++) {
                loggedIn = await this.login(username, password);
                if (loggedIn) break;
                if (attempt < 2) {
                    console.log(`[Attendance] Login attempt ${attempt} failed, retrying...`);
                    await this.close();
                    await new Promise(r => setTimeout(r, 3000));
                    await this.init();
                }
            }
            if (!loggedIn) {
                let screenshot: string | undefined;
                try { screenshot = await this.takeScreenshot('login_failed'); } catch { }
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
                let screenshot: string | undefined;
                try { screenshot = await this.takeScreenshot('attendance_not_found'); } catch { }
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

        // Build screenshot URL from HF Space public host
        let screenshotUrl = '';
        if (result.screenshotPath && fs.existsSync(result.screenshotPath)) {
            const filename = path.basename(result.screenshotPath);
            // HF Spaces sets SPACE_HOST env var (e.g. "username-spacename.hf.space")
            const spaceHost = process.env.SPACE_HOST;
            if (spaceHost) {
                screenshotUrl = `https://${spaceHost}/screenshots/${filename}`;
            } else {
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

        const textResult = await whatsappService.sendMessage(phoneNumber, fullMessage);
        if (!textResult.success) {
            console.error('[WhatsApp] Notification failed:', textResult.error);
        }
    }
}

