import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { token } = await request.json();

    if (!token) {
      return new Response(JSON.stringify({ error: 'GitHub Token is required' }), { status: 400 });
    }

    const url = `https://api.github.com/user/repos?sort=updated&per_page=100&type=all`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${token}`,
      'User-Agent': 'Solvin-App-Tools'
    };

    const res = await fetch(url, { headers });
    
    if (!res.ok) {
        const errText = await res.text();
        return new Response(JSON.stringify({ error: `GitHub API Error: ${res.status} ${errText}` }), { status: res.status });
    }

    const data = await res.json();
    const repos = data.map((r: any) => ({
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        description: r.description,
        updated_at: r.updated_at,
        private: r.private,
        stargazers_count: r.stargazers_count
    }));

    return new Response(JSON.stringify({ repos }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
};
