/**
 * SPADA API Service
 * Replaces Puppeteer scraping with direct API calls to api-spada.podnet.space
 */

const SPADA_API_BASE = process.env.SPADA_API_URL || 'https://api-spada.podnet.space';

interface SpadaLoginResponse {
    success: boolean;
    data?: {
        token: string;
        userId: number;
        fullname: string | null;
    };
    message?: string;
}

interface SpadaCourse {
    id: number;
    fullname: string;
    shortname?: string;
    progress: number;
    category?: string;
    viewurl?: string;
}

interface SpadaAssignment {
    section: string;
    cmid: number;
    url: string;
    name: string;
    dueDate: string;
    submissionStatus: string;
}

export class SpadaApiService {
    private token: string | null = null;

    /**
     * Login to SPADA via API and get a session token
     */
    async login(username: string, password: string): Promise<boolean> {
        try {
            console.log(`[SPADA-API] Logging in user: ${username}`);
            const res = await fetch(`${SPADA_API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data: SpadaLoginResponse = await res.json();

            if (data.success && data.data?.token) {
                this.token = data.data.token;
                console.log(`[SPADA-API] Login successful for ${username}`);
                return true;
            }

            console.error(`[SPADA-API] Login failed for ${username}: ${data.message}`);
            return false;
        } catch (error: any) {
            console.error(`[SPADA-API] Login error: ${error.message}`);
            return false;
        }
    }

    /**
     * Get all enrolled courses (in-progress only)
     */
    async getCourses(): Promise<SpadaCourse[]> {
        if (!this.token) throw new Error('Not logged in');

        const res = await fetch(`${SPADA_API_BASE}/api/courses?classification=inprogress`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        const data = await res.json();
        console.log(`[SPADA-API] getCourses response: success=${data.success}`);

        if (data.success && data.data) {
            // API returns { data: { total: N, courses: [...] } }
            if (Array.isArray(data.data.courses)) {
                console.log(`[SPADA-API] Found ${data.data.courses.length} courses`);
                return data.data.courses;
            }
            // Fallback: data is directly an array
            if (Array.isArray(data.data)) {
                console.log(`[SPADA-API] Found ${data.data.length} courses (direct array)`);
                return data.data;
            }
            console.error('[SPADA-API] Unexpected courses format');
            return [];
        }
        throw new Error(data.message || 'Failed to get courses');
    }

    /**
     * Get assignments for a specific course via the /assignments endpoint
     */
    async getAssignments(courseId: string): Promise<any[]> {
        if (!this.token) throw new Error('Not logged in');

        try {
            const res = await fetch(`${SPADA_API_BASE}/api/courses/${courseId}/assignments`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!res.ok) {
                console.error(`[SPADA-API] Assignments endpoint returned ${res.status} for course ${courseId}`);
                return [];
            }

            const data = await res.json();
            if (!data.success) {
                console.error(`[SPADA-API] Failed to get assignments for course ${courseId}`);
                return [];
            }

            const assignments = data.data?.assignments || [];
            console.log(`[SPADA-API] Course ${courseId}: found ${assignments.length} assignments`);

            return assignments.map((a: SpadaAssignment) => ({
                name: a.name,
                url: a.url || `https://spada.upnyk.ac.id/mod/assign/view.php?id=${a.cmid}`,
                dueDate: (a.dueDate && a.dueDate !== '-') ? a.dueDate : 'No due date',
                status: a.submissionStatus || 'Unknown',
                timeRemaining: 'Unknown'
            }));
        } catch (error: any) {
            console.error(`[SPADA-API] Error getting assignments for course ${courseId}: ${error.message}`);
            return [];
        }
    }
}
