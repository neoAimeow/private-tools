import type { APIRoute } from 'astro';
import { analyzeGithubProject } from '../../lib/github';
import { LANGUAGES } from '../../lib/constants';
import { callGeminiApi } from '../../lib/ai-client';

export const prerender = false;

// Helper to convert JSON to Firestore Value format
function toFirestoreValue(val: any): any {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
        if (Number.isInteger(val)) return { integerValue: val.toString() };
        return { doubleValue: val };
    }
    if (typeof val === 'string') return { stringValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
    if (typeof val === 'object') {
        const fields: any = {};
        for (const k in val) {
            if (val[k] !== undefined) fields[k] = toFirestoreValue(val[k]);
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
}

async function updateFirestore(projectId: string, collection: string, docId: string, data: any, token: string) {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
    
    // Convert flat data to Firestore fields
    const fields: any = {};
    const updateMask: string[] = [];
    
    for (const [key, value] of Object.entries(data)) {
        fields[key] = toFirestoreValue(value);
        updateMask.push(`updateMask.fieldPaths=${key}`);
    }

    const queryParams = updateMask.join('&');
    const finalUrl = `${url}?${queryParams}`;

    const res = await fetch(finalUrl, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Firestore Update Failed: ${txt}`);
    }
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { appId, token, geminiConfig, currentApp } = body;

        if (!appId || !token || !geminiConfig || !currentApp) {
            return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400 });
        }

        const projectId = 'cc-solvin-apps-tools'; // Hardcoded for this project

        // 1. Set isGenerating = true
        await updateFirestore(projectId, 'solvin-apps', appId, { isGenerating: true }, token);

        try {
            // 2. Analyze Project
            const ctx = await analyzeGithubProject(currentApp.localizations ? currentApp.localPath : currentApp.localPath, geminiConfig.githubToken); // Logic reuse

            // 3. Call Gemini
            const prompt = `You are an expert ASO Copywriter. Analyze this project: ${JSON.stringify(ctx)}. 
            Generate App Store optimization content for the following languages: 
            ${LANGUAGES.map(l => `${l.name} (${l.code})`).join(', ')}.
            
            App Name: ${currentApp.name}. 
            
            For EACH language, strictly adhere to these limits:
            - promoText: Max 170 chars.
            - keywords: Max 100 chars (Comma separated).
            - shortDescription: Max 80 chars.
            
            Return strictly a JSON object keyed by language code (e.g., "en-US", "zh-CN"):
            {
              "en-US": { "promoText": "...", "keywords": "...", "shortDescription": "...", "fullDescription": "..." },
              "zh-CN": { ... },
              ...
            }`;

            const geminiJson = await callGeminiApi(
                geminiConfig,
                geminiConfig.textModel,
                'streamGenerateContent',
                {
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: { response_mime_type: "application/json" }
                },
                { alt: 'sse' }
            );

            const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!rawText) throw new Error("No content generated");
            
            const genData = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());

            // 4. Merge Data
            const newLocalizations = { ...(currentApp.localizations || {}), ...genData };
            
            const updates: any = { 
                localizations: newLocalizations,
                isGenerating: false,
                updatedAt: new Date().toISOString()
            };

            // Sync en-US to root fields
            if (genData['en-US']) {
                const en = genData['en-US'];
                updates.promoText = en.promoText;
                updates.keywords = en.keywords;
                updates.shortDescription = en.shortDescription;
                updates.description = en.fullDescription;
                updates.fullDescription = en.fullDescription;
            }

            // 5. Update Firestore
            await updateFirestore(projectId, 'solvin-apps', appId, updates, token);

            return new Response(JSON.stringify({ success: true }), { status: 200 });

        } catch (error) {
            console.error(error);
            // Reset generating status on error
            await updateFirestore(projectId, 'solvin-apps', appId, { isGenerating: false }, token).catch(() => {});
            return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
        }

    } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
    }
};
