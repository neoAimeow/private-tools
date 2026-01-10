import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';

// Helper to fetch file content from GitHub
async function fetchGithubFile(repo: string, path: string, token?: string) {
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3.raw', // Get raw content directly
        'User-Agent': 'Solvin-App-Tools'
    };
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub API Error: ${res.status} ${res.statusText}`);
    return await res.text();
}

// Helper to fetch directory listing
async function fetchGithubDir(repo: string, path: string = '', token?: string) {
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Solvin-App-Tools'
    };
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) {
        return data.map((item: any) => item.name);
    }
    return [];
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { projectPath, githubToken } = await request.json();

    if (!projectPath) {
      return new Response(JSON.stringify({ error: 'Project path/repo is required' }), { status: 400 });
    }

    const context: any = {
        path: projectPath,
        files: {}
    };

    // Check if it looks like a GitHub Repo or URL
    // Supports: "owner/repo" OR "https://github.com/owner/repo"
    let repoSlug = projectPath;
    let isGithub = false;

    // 1. Try to parse as URL
    try {
        if (projectPath.startsWith('http')) {
            const url = new URL(projectPath);
            if (url.hostname === 'github.com') {
                // pathname is like "/owner/repo" or "/owner/repo/"
                const parts = url.pathname.split('/').filter(Boolean);
                if (parts.length >= 2) {
                    repoSlug = `${parts[0]}/${parts[1]}`;
                    isGithub = true;
                }
            }
        } else if (!projectPath.startsWith('/') && !projectPath.startsWith('.') && projectPath.split('/').length === 2) {
            // 2. Simple "owner/repo" check
            isGithub = true;
        }
    } catch (e) {}

    if (isGithub) {
        // --- GitHub Logic ---
        console.log(`Analyzing GitHub Repo: ${repoSlug}`);
        
        // 1. Get package.json
        try {
            const pkgRaw = await fetchGithubFile(repoSlug, 'package.json', githubToken);
            context.packageJson = JSON.parse(pkgRaw);
        } catch (e) { console.warn('No package.json found on GitHub'); }

        // 2. Get README
        const readmeVariants = ['README.md', 'readme.md', 'Readme.md'];
        for (const file of readmeVariants) {
            try {
                const content = await fetchGithubFile(repoSlug, file, githubToken);
                context.readme = content.slice(0, 15000); // Larger limit for AI
                break;
            } catch (e) { /* continue */ }
        }

        // 3. Get Structure
        try {
            context.structure = await fetchGithubDir(repoSlug, '', githubToken);
            // Try src if exists
            if (context.structure.includes('src')) {
                context.srcStructure = await fetchGithubDir(repoSlug, 'src', githubToken);
            }
        } catch(e) { console.warn('Failed to fetch structure'); }

    } else {
        // --- Local Logic (Legacy Support) ---
        // Safety check: ensure path exists and is a directory
        try {
            const stats = await fs.stat(projectPath);
            if (!stats.isDirectory()) {
                return new Response(JSON.stringify({ error: 'Local path is not a directory' }), { status: 400 });
            }
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Local path does not exist' }), { status: 404 });
        }

        // 1. Read package.json
        try {
            const pkgJson = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
            context.packageJson = JSON.parse(pkgJson);
        } catch (e) { /* ignore */ }

        // 2. Read README.md
        const readmeFiles = ['README.md', 'readme.md', 'Readme.md'];
        for (const file of readmeFiles) {
            try {
                const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
                context.readme = content.slice(0, 15000);
                break;
            } catch (e) { /* continue */ }
        }

        // 3. Simple scan
        try {
            const dirFiles = await fs.readdir(projectPath, { withFileTypes: true });
            context.structure = dirFiles.map(d => d.name);
            
            const srcPath = path.join(projectPath, 'src');
            try {
                const srcFiles = await fs.readdir(srcPath);
                context.srcStructure = srcFiles;
            } catch(e) {}
        } catch(e) {}
    }

    return new Response(JSON.stringify(context), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
};