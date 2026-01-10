import type { GeminiConfig } from './config';

export async function callGeminiApi(
    config: GeminiConfig,
    modelName: string | undefined, 
    method: 'generateContent' | 'predict' | 'streamGenerateContent',
    payload: any,
    queryParams?: Record<string, string>
) {
    // ... existing implementation for non-streaming (or aggregated streaming) ...
    // Re-using the logic, but I will overwrite the file to include the new streaming function.
    if (!config.baseUrl) throw new Error("Gemini Base URL is missing");
    
    const model = modelName || config.textModel || 'gemini-2.0-flash';
    
    let apiKey = config.textApiKey;
    if (method === 'predict' && config.imageApiKey) {
        apiKey = config.imageApiKey;
    }
    if (!apiKey) throw new Error("API Key is missing for the requested operation");

    const cleanBaseUrl = config.baseUrl.replace(/\/$/, '');
    
    let url = `${cleanBaseUrl}/models/${model}:${method}`;
    if (queryParams) {
        const params = new URLSearchParams(queryParams);
        url += `?${params.toString()}`;
    }
    
    console.log(`[GeminiClient] Calling: ${url}`);

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'x-title': 'Solvin Tools',
        'http-referer': 'http://localhost:4321',
        'User-Agent': 'SolvinTools/1.0 (Astro)'
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        const responseText = await res.text();

        if (!res.ok) {
            try {
                const jsonErr = JSON.parse(responseText);
                const msg = jsonErr.error?.message || jsonErr.message || JSON.stringify(jsonErr);
                throw new Error(`Gemini API Error (${res.status}): ${msg}`);
            } catch (e) {
                throw new Error(`Gemini API Error (${res.status}): ${responseText.slice(0, 500)}`);
            }
        }

        if (responseText.startsWith('data: ')) {
             const lines = responseText.split('\n');
             const chunks = [];
             for (const line of lines) {
                 if (line.startsWith('data: ')) {
                     const jsonStr = line.substring(6).trim();
                     if (jsonStr === '[DONE]') break;
                     try {
                         chunks.push(JSON.parse(jsonStr));
                     } catch (e) { console.error('Failed to parse SSE line', e); }
                 }
             }
             return mergeChunks(chunks);
        }

        const data = JSON.parse(responseText);
        if (Array.isArray(data)) {
            return mergeChunks(data);
        }
        return data;

    } catch (error) {
        console.error("[GeminiClient] Request Failed:", error);
        throw error;
    }
}

// New Streaming Function
export async function* streamGeminiApi(
    config: GeminiConfig,
    modelName: string | undefined, 
    payload: any,
    queryParams?: Record<string, string>
) {
    if (!config.baseUrl) throw new Error("Gemini Base URL is missing");
    const model = modelName || config.textModel || 'gemini-2.0-flash';
    const apiKey = config.textApiKey;
    if (!apiKey) throw new Error("API Key is missing");

    const cleanBaseUrl = config.baseUrl.replace(/\/$/, '');
    
    // Always force streamGenerateContent and sse for this helper
    let url = `${cleanBaseUrl}/models/${model}:streamGenerateContent`;
    const params = new URLSearchParams(queryParams || {});
    params.set('alt', 'sse'); // Force SSE
    url += `?${params.toString()}`;
    
    console.log(`[GeminiClient] Streaming: ${url}`);

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'x-title': 'Solvin Tools',
        'http-referer': 'http://localhost:4321',
        'User-Agent': 'SolvinTools/1.0 (Astro)'
    };

    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Gemini Stream Error (${res.status}): ${txt}`);
    }

    if (!res.body) throw new Error("Response body is empty");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6).trim();
                if (jsonStr === '[DONE]') return;
                try {
                    const data = JSON.parse(jsonStr);
                    // Extract text immediately
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) yield text;
                } catch (e) {
                    console.error("Parse Error in stream:", e);
                }
            }
        }
    }
}


function mergeChunks(chunks: any[]) {
    let fullText = '';
    let lastCandidate = null;

    for (const chunk of chunks) {
        const candidate = chunk.candidates?.[0];
        if (candidate) {
            lastCandidate = candidate;
            const text = candidate.content?.parts?.[0]?.text || '';
            fullText += text;
        }
    }
    return {
        candidates: [
            {
                ...lastCandidate,
                content: {
                    role: 'model',
                    parts: [{ text: fullText }]
                }
            }
        ]
    };
}