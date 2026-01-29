import puppeteer, { Browser, Page } from 'puppeteer';

export class ScraperService {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private readonly baseUrl = 'https://spada.upnyk.ac.id';

    /**
     * Initialize the browser instance
     */
    async init() {
        if (!this.browser) {
            console.log('Launching Puppeteer...');
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                defaultViewport: null
            });
            this.page = await this.browser.newPage();
            // Set user agent to avoid detection (basic)
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        }
    }

    /**
     * Login to SPADA
     */
    async login(username: string, passwordUnencrypted: string): Promise<boolean> {
        if (!this.browser || !this.page) {
            await this.init();
        }

        try {
            console.log(`Navigating to login page: ${this.baseUrl}/login/index.php`);
            await this.page!.goto(`${this.baseUrl}/login/index.php`, { waitUntil: 'networkidle2' });

            // Check if already logged in by looking for logout button or dashboard element
            const isLoggedIn = await this.page!.$('.logininfo a[href*="logout.php"]');
            if (isLoggedIn) {
                console.log('Already logged in.');
                return true;
            }

            console.log('Typing credentials...');
            await this.page!.type('#username', username);
            await this.page!.type('#password', passwordUnencrypted);

            console.log('Clicking login...');
            await Promise.all([
                this.page!.waitForNavigation({ waitUntil: 'networkidle2' }),
                this.page!.click('#loginbtn')
            ]);

            // Check for login success (e.g., redirect to dashboard or existence of logout link)
            const success = await this.page!.$('.logininfo a[href*="logout.php"]');
            if (success) {
                console.log('Login successful!');
                return true;
            } else {
                console.error('Login failed. Check credentials.');
                // Optional: Check for error message on page
                const errorMsg = await this.page!.$eval('.loginerrors', el => el.textContent).catch(() => null);
                if (errorMsg) console.error(`SPADA Error: ${errorMsg}`);
                return false;
            }

        } catch (error) {
            console.error('Error during login:', error);
            return false;
        }
    }

    /**
     * Scrape enrolled courses from the dashboard
     */
    async scrapeCourses() {
        if (!this.page) throw new Error('Browser not initialized or not logged in');

        try {
            console.log('Navigating to dashboard...');
            // Usually dashboard is the default page after login, but let's be safe
            if (!this.page.url().includes('my')) {
                await this.page.goto(`${this.baseUrl}/my/`, { waitUntil: 'networkidle2' });
            }

            console.log('Scraping courses...');
            // Selector for course cards (Adjust based on SPADA/Moodle theme)
            // Common Moodle selectors: .coursebox, .card-deck .card, .dashboard-card
            const courses = await this.page.evaluate(() => {
                const courseElements = document.querySelectorAll('.course-info-container'); // Example selector
                const relativeUrl = window.location.origin;

                // Fallback for different themes
                // Try to find any link that looks like a course link
                const allLinks = Array.from(document.querySelectorAll('a[href*="/course/view.php?id="]'));
                const uniqueCourses = new Map();

                allLinks.forEach(link => {
                    const href = (link as HTMLAnchorElement).href;
                    const idMatch = href.match(/id=(\d+)/);
                    if (idMatch) {
                        const id = idMatch[1];
                        // Try to find the closest text node or title
                        const name = (link as HTMLElement).innerText.trim() || 'Untitled Course';
                        if (name && !uniqueCourses.has(id)) {
                            uniqueCourses.set(id, { id, name, url: href });
                        }
                    }
                });

                return Array.from(uniqueCourses.values());
            });

            console.log(`Found ${courses.length} courses.`);
            return courses;
        } catch (error) {
            console.error('Error scraping courses:', error);
            return [];
        }
    }

    /**
     * Scrape assignments from a specific course
     */
    async scrapeAssignments(courseId: string) {
        if (!this.page) throw new Error('Browser not initialized');

        try {
            const courseUrl = `${this.baseUrl}/course/view.php?id=${courseId}`;
            console.log(`Navigating to course: ${courseUrl}`);
            await this.page.goto(courseUrl, { waitUntil: 'networkidle2' });

            // Find all assignment links
            // Assignments usually have 'mod/assign/view.php?id=' in the URL
            const assignmentLinks = await this.page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href*="/mod/assign/view.php?id="]'));
                return links.map(link => ({
                    url: (link as HTMLAnchorElement).href,
                    name: (link as HTMLElement).innerText.trim()
                }));
            });

            console.log(`Found ${assignmentLinks.length} assignments. Scraping details...`);
            const assignments = [];

            for (const link of assignmentLinks) {
                try {
                    console.log(`Scraping assignment: ${link.name}`);
                    await this.page.goto(link.url, { waitUntil: 'domcontentloaded' });

                    const details = await this.page.evaluate(() => {
                        // Default values
                        let status = 'Unknown';
                        let timeRemaining = 'Unknown';
                        let dueDate = 'Unknown';

                        // Try to parse the submission status table
                        const rows = Array.from(document.querySelectorAll('.generaltable tbody tr'));
                        rows.forEach(row => {
                            const header = row.querySelector('th')?.innerText.trim();
                            const cell = row.querySelector('td')?.innerText.trim();

                            if (header === 'Submission status') status = cell || status;
                            if (header === 'Time remaining') timeRemaining = cell || timeRemaining;
                            if (header === 'Due date') dueDate = cell || dueDate;
                        });

                        return { status, timeRemaining, dueDate };
                    });

                    assignments.push({
                        ...link,
                        ...details
                    });

                    // Wait a bit to be polite
                    await new Promise(r => setTimeout(r, 1000));

                } catch (e) {
                    console.error(`Failed to scrape assignment ${link.name}`, e);
                }
            }

            return assignments;

        } catch (error) {
            console.error(`Error scraping assignments for course ${courseId}:`, error);
            return [];
        }
    }

    /**
     * Scrape a specific course by URL
     */
    async scrapeCourseByUrl(courseUrl: string) {
        if (!this.page) throw new Error('Browser not initialized');

        try {
            console.log(`Navigating to specific course: ${courseUrl}`);
            await this.page.goto(courseUrl, { waitUntil: 'networkidle2' });

            // Extract Course ID from URL
            const idMatch = courseUrl.match(/id=(\d+)/);
            if (!idMatch) throw new Error('Invalid Course URL. Must contain "id="');
            const courseId = idMatch[1];

            // Extract Course Name
            const courseName = await this.page.$eval('h1', el => el.innerText.trim()).catch(() => 'Unknown Course');

            console.log(`Detected Course: ${courseName} (ID: ${courseId})`);

            // Reuse the existing assignment scraper
            const assignments = await this.scrapeAssignments(courseId);

            return {
                id: courseId,
                name: courseName,
                url: courseUrl,
                assignments
            };

        } catch (error) {
            console.error(`Error scraping course by URL ${courseUrl}:`, error);
            throw error;
        }
    }

    /**
     * Close the browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}
