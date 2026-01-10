import type { APIRoute } from 'astro';
import { streamGeminiApi } from '../../../lib/ai-client';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { prompt, systemContext, config } = body; 

    if (!config?.textApiKey) {
      return new Response(JSON.stringify({ error: 'API Key missing in settings' }), { status: 401 });
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: `System Context: ${systemContext}\n\nTask: ${prompt}` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      }
    };

    // Create a streaming response
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            try {
                const generator = streamGeminiApi(
                    config, 
                    config.textModel, 
                    payload
                );

                for await (const chunk of generator) {
                    // Send raw text chunk
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            } catch (e) {
                console.error("Stream Error:", e);
                controller.enqueue(encoder.encode(`[ERROR] ${(e as Error).message}`));
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked'
        }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
};