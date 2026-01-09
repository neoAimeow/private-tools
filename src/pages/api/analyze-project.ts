import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { projectPath } = await request.json();

    if (!projectPath) {
      return new Response(JSON.stringify({ error: 'Project path is required' }), { status: 400 });
    }

    // Safety check: ensure path exists and is a directory
    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
         return new Response(JSON.stringify({ error: 'Path is not a directory' }), { status: 400 });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Path does not exist' }), { status: 404 });
    }

    // Gather context
    const context: any = {
        path: projectPath,
        files: {}
    };

    // 1. Read package.json
    try {
      const pkgJson = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
      context.packageJson = JSON.parse(pkgJson);
    } catch (e) { /* ignore */ }

    // 2. Read README.md (try different cases)
    const readmeFiles = ['README.md', 'readme.md', 'Readme.md'];
    for (const file of readmeFiles) {
        try {
            const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
            context.readme = content.slice(0, 8000); // Limit size
            break;
        } catch (e) { /* continue */ }
    }

    // 3. Simple source scan (limit depth and file types)
    // This is a naive scan to find "main" files or structure
    const importantFiles = [];
    try {
        const dirFiles = await fs.readdir(projectPath, { withFileTypes: true });
        context.structure = dirFiles.map(d => d.name);
        
        // Try to find src/ if exists
        const srcPath = path.join(projectPath, 'src');
        try {
            const srcFiles = await fs.readdir(srcPath);
            context.srcStructure = srcFiles;
        } catch(e) {}

    } catch(e) {}

    return new Response(JSON.stringify(context), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
};
