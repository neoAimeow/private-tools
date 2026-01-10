import type { APIRoute } from 'astro';
import { callGeminiApi } from '../../../lib/ai-client';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { prompt, config } = body;

    if (!config?.textApiKey && !config?.imageApiKey) {
       return new Response(JSON.stringify({ error: 'API Key missing' }), { status: 401 });
    }
    
    const payload = {
        instances: [{ prompt: prompt }],
        parameters: {
            sampleCount: 1,
            aspectRatio: "1:1"
        }
    };

    const data = await callGeminiApi(
        config,
        config.imageModel || 'imagen-3.0-generate-002',
        'predict',
        payload
    );

    // Vertex/Imagen response structure usually: { predictions: [ { bytesBase64Encoded: "..." } ] }
    const b64 = data.predictions?.[0]?.bytesBase64Encoded || data.predictions?.[0]?.b64;
    
    if (!b64) throw new Error('No image data returned from API');

    return new Response(JSON.stringify({ image: `data:image/png;base64,${b64}` }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
};
