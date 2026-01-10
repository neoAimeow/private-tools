import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.dart', '.go', '.rs', '.java', '.kt', '.swift', '.php', '.rb', '.c', '.cpp', '.h']);
const IGNORE_PATTERNS = ['node_modules', 'dist', 'build', 'out', '.git', '.github', 'test', 'tests', '__tests__', 'spec', 'assets', 'public', 'components/ui', '.d.ts'];
const MAX_CODE_FILES = 15;
const MAX_FILE_SIZE = 50000; // 50KB per file max
const TOTAL_CODE_LIMIT = 500000; // 500KB total code limit

// --- Helper: Check if file is interesting ---
function isInterestingFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) return false;
    
    // Check ignore patterns
    const lowerPath = filePath.toLowerCase();
    return !IGNORE_PATTERNS.some(pattern => lowerPath.includes(pattern));
}

// --- GitHub Helpers ---

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
    // Get recursive tree
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

// --- Local Helpers ---

async function walkLocalDir(dir: string, fileList: string[] = [], rootDir: string = '') {
    const files = await fs.readdir(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const relPath = path.join(rootDir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
            if (!IGNORE_PATTERNS.some(p => relPath.includes(p))) {
                 await walkLocalDir(filePath, fileList, relPath);
            }
        } else {
            if (isInterestingFile(relPath)) {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
}


export const POST: APIRoute = async ({ request }) => {
  try {
    const { projectPath, githubToken } = await request.json();
    if (!projectPath) return new Response(JSON.stringify({ error: 'Project path required' }), { status: 400 });

    const context: any = {
        path: projectPath,
        files: {}, // Will contain path: content
        structure: [] // Simplified structure
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

    // --- STRATEGY EXECUTION ---

    if (isGithub) {
        // 1. Fetch Metadata (Readme)
        const readme = await fetchGithubFile(repoSlug, 'README.md', githubToken)
            .catch(() => fetchGithubFile(repoSlug, 'readme.md', githubToken));
        
        if (readme) context.readme = readme.slice(0, 200000);

        // 2. Fetch File Structure (Recursive)
        const allFiles = await fetchGithubTree(repoSlug, githubToken);
        
        // 3. Select Interesting Files
        // Prioritize: src/pages, src/app, lib/main.dart, etc.
        const codeFiles = allFiles.filter(isInterestingFile);
        
        // Simple heuristic: shortest paths + specific keywords often denote entry points
        // But for now, just taking top N interesting files might be too random.
        // Let's sort by: "is it in src?" -> "is it index/main/app?" -> length
        codeFiles.sort((a: string, b: string) => {
            const scoreA = (a.includes('src/') ? -10 : 0) + (a.includes('pages') ? -5 : 0) + (a.includes('main') ? -5 : 0) + a.length;
            const scoreB = (b.includes('src/') ? -10 : 0) + (b.includes('pages') ? -5 : 0) + (b.includes('main') ? -5 : 0) + b.length;
            return scoreA - scoreB;
        });

        const selectedFiles = codeFiles.slice(0, MAX_CODE_FILES);
        context.structure = codeFiles.slice(0, 50); // Show top 50 files in structure hint

        // 4. Fetch Content (Parallel)
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

    } else {
        // --- Local Logic ---
        try {
            const stats = await fs.stat(projectPath);
            if (!stats.isDirectory()) throw new Error('Not a directory');

            // 1. Metadata
            for (const f of ['README.md', 'readme.md']) {
                try {
                    context.readme = (await fs.readFile(path.join(projectPath, f), 'utf-8')).slice(0, 200000);
                    break;
                } catch(e){}
            }

            // 2. Walk Directory
            const allFiles = await walkLocalDir(projectPath, [], '');
            
            // 3. Select Files (Relative paths)
            const relFiles = allFiles.map(f => path.relative(projectPath, f));
            
            relFiles.sort((a, b) => {
                const scoreA = (a.includes('src') ? -10 : 0) + a.length;
                const scoreB = (b.includes('src') ? -10 : 0) + b.length;
                return scoreA - scoreB;
            });

            const selectedFiles = relFiles.slice(0, MAX_CODE_FILES);
            context.structure = relFiles.slice(0, 50);

            // 4. Read Content
            let totalSize = 0;
            for (const f of selectedFiles) {
                if (totalSize >= TOTAL_CODE_LIMIT) break;
                try {
                    const content = await fs.readFile(path.join(projectPath, f), 'utf-8');
                    const truncated = content.slice(0, MAX_FILE_SIZE);
                    context.files[f] = truncated;
                    totalSize += truncated.length;
                } catch(e){}
            }

        } catch(e) {
            return new Response(JSON.stringify({ error: 'Local path invalid or inaccessible' }), { status: 404 });
        }
    }

    return new Response(JSON.stringify(context), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
};
