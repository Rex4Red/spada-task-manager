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
    imageUrl?: string;
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
     * Get all enrolled courses
     */
    async getCourses(): Promise<SpadaCourse[]> {
        if (!this.token) throw new Error('Not logged in');

        const res = await fetch(`${SPADA_API_BASE}/api/courses?classification=inprogress`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        const data = await res.json();
        console.log(`[SPADA-API] getCourses response keys: ${Object.keys(data)}, success: ${data.success}, data type: ${typeof data.data}, isArray: ${Array.isArray(data.data)}`);

        if (data.success) {
            // Handle both { data: [...] } and { data: { courses: [...] } }
            if (Array.isArray(data.data)) return data.data;
            if (Array.isArray(data.data?.courses)) return data.data.courses;
            console.error('[SPADA-API] Unexpected courses format:', JSON.stringify(data).substring(0, 500));
            return [];
        }
        throw new Error(data.message || 'Failed to get courses');
    }

    /**
     * Get assignments for a specific course
     * Returns data in the format expected by saveCoursesToDb
     */
    async getAssignments(courseId: string): Promise<any[]> {
        if (!this.token) throw new Error('Not logged in');

        try {
            const res = await fetch(`${SPADA_API_BASE}/api/courses/${courseId}/contents`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await res.json();

            if (!data.success) {
                console.error(`[SPADA-API] Failed to get contents for course ${courseId}`);
                return [];
            }

            // Filter only assignment-type activities and map to expected format
            const activities = data.data?.activities || [];
            const assignments = activities
                .filter((a: any) => a.type === 'assign')
                .map((a: any) => ({
                    name: a.name?.replace(/ Assignment$/, '').trim() || a.name,
                    url: a.url || `https://spada.upnyk.ac.id/mod/assign/view.php?id=${a.cmid}`,
                    dueDate: a.dueDate || 'Unknown',
                    status: a.submissionStatus || 'Unknown',
                    timeRemaining: 'Unknown'
                }));

            // If no assignments found via contents, try dedicated assignments endpoint
            // (some courses don't list assigns in contents)
            if (assignments.length === 0) {
                return await this.getAssignmentsDedicated(courseId);
            }

            return assignments;
        } catch (error: any) {
            console.error(`[SPADA-API] Error getting assignments for course ${courseId}: ${error.message}`);
            // Fallback to dedicated endpoint
            return await this.getAssignmentsDedicated(courseId);
        }
    }

    /**
     * Fallback: Get assignments using the dedicated assignments endpoint
     */
    private async getAssignmentsDedicated(courseId: string): Promise<any[]> {
        if (!this.token) return [];

        try {
            // Try fetching from a dedicated assignments path if available
            const res = await fetch(`${SPADA_API_BASE}/api/courses/${courseId}/assignments`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!res.ok) return [];

            const data = await res.json();
            if (!data.success) return [];

            const assignments = data.data?.assignments || [];
            return assignments.map((a: SpadaAssignment) => ({
                name: a.name,
                url: a.url || `https://spada.upnyk.ac.id/mod/assign/view.php?id=${a.cmid}`,
                dueDate: a.dueDate || 'Unknown',
                status: a.submissionStatus || 'Unknown',
                timeRemaining: 'Unknown'
            }));
        } catch {
            return [];
        }
    }
}
