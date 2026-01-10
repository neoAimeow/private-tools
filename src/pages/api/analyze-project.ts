import type { APIRoute } from 'astro';

export const prerender = false;

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.dart', '.go', '.rs', '.java', '.kt', '.swift', '.php', '.rb', '.c', '.cpp', '.h']);
const IGNORE_PATTERNS = ['node_modules', 'dist', 'build', 'out', '.git', '.github', 'test', 'tests', '__tests__', 'spec', 'assets', 'public', 'components/ui', '.d.ts'];
const MAX_CODE_FILES = 15;
const MAX_FILE_SIZE = 50000; // 50KB per file max
const TOTAL_CODE_LIMIT = 500000; // 500KB total code limit

// Helper: Check if file is interesting
function isInterestingFile(filePath: string): boolean {
    const extMatch = filePath.match(/\.[0-9a-z]+$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.has(ext)) return false;
    
    const lowerPath = filePath.toLowerCase();
    return !IGNORE_PATTERNS.some(pattern => lowerPath.includes(pattern));
}

// GitHub Helpers
async function fetchGithubFile(repo: string, filePath: string, token?: string) {
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
    const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'Solvin-App-Tools'
    };
    if (token) headers['Authorization'] = `token ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return await res.text();
}

async function fetchGithubTree(repo: string, token?: string) {
    const url = `https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`;
    const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Solvin-App-Tools'
    };
    if (token) headers['Authorization'] = `token ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.tree || !Array.isArray(data.tree)) return [];
    
    return data.tree
        .filter((item: any) => item.type === 'blob')
        .map((item: any) => item.path);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { projectPath, githubToken } = body;
    
    if (!projectPath) return new Response(JSON.stringify({ error: 'Project path required' }), { status: 400 });

    const context: any = {
        path: projectPath,
        files: {},
        structure: []
    };

    let isGithub = false;
    let repoSlug = projectPath;

    // Detect GitHub
    try {
        if (projectPath.startsWith('http') && projectPath.includes('github.com')) {
            const parts = new URL(projectPath).pathname.split('/').filter(Boolean);
            if (parts.length >= 2) { repoSlug = `${parts[0]}/${parts[1]}`; isGithub = true; }
        } else if (!projectPath.startsWith('/') && projectPath.split('/').length === 2) {
            isGithub = true;
        }
    } catch (e) {}

    console.log(`Analyzing ${isGithub ? 'GitHub' : 'Local'}: ${repoSlug}`);

    if (isGithub) {
        // --- GitHub Logic ---
        
        // 1. Fetch Metadata (Readme)
        const readme = await fetchGithubFile(repoSlug, 'README.md', githubToken)
            .catch(() => fetchGithubFile(repoSlug, 'readme.md', githubToken));
        
        if (readme) context.readme = readme.slice(0, 200000);

        // 2. Fetch File Structure (Recursive)
        const allFiles = await fetchGithubTree(repoSlug, githubToken);
        
        // 3. Select Interesting Files
        const codeFiles = allFiles.filter(isInterestingFile);
        
        codeFiles.sort((a: string, b: string) => {
            const scoreA = (a.includes('src/') ? -10 : 0) + (a.includes('pages') ? -5 : 0) + (a.includes('main') ? -5 : 0) + a.length;
            const scoreB = (b.includes('src/') ? -10 : 0) + (b.includes('pages') ? -5 : 0) + (b.includes('main') ? -5 : 0) + b.length;
            return scoreA - scoreB;
        });

        const selectedFiles = codeFiles.slice(0, MAX_CODE_FILES);
        context.structure = codeFiles.slice(0, 50);

        // 4. Fetch Content
        let totalSize = 0;
        const fetchPromises = selectedFiles.map(async (f: string) => {
            if (totalSize >= TOTAL_CODE_LIMIT) return;
            const content = await fetchGithubFile(repoSlug, f, githubToken);
            if (content) {
                const truncated = content.slice(0, MAX_FILE_SIZE);
                context.files[f] = truncated;
                totalSize += truncated.length;
            }
        });
        await Promise.all(fetchPromises);

        return new Response(JSON.stringify(context), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } else {
        // --- Local Path Logic REMOVED ---
        // Cloudflare Workers / Pages functions do NOT support accessing the file system (fs).
        // To avoid "500 Internal Server Error" caused by bundling 'node:fs', we completely remove local analysis.
        
        return new Response(JSON.stringify({ 
            error: 'Local file analysis is not supported on this deployment. Please use a GitHub repository URL (e.g. "username/repo").' 
        }), { status: 400 });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: `Server Error: ${(error as Error).message}` }), { status: 500 });
  }
};