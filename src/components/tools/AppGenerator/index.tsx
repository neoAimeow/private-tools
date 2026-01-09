import React, { useState, useEffect } from 'react';
import styles from './style.module.scss';
import { db } from '../../../lib/firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { getGeminiConfig } from '../../../lib/config';

interface AppData {
  id?: string;
  name: string;
  localPath: string;
  supportUrl: string;
  marketingUrl: string;
  
  // App Store
  promoText: string;
  description: string;
  keywords: string;
  
  // Play Store
  shortDescription: string;
  fullDescription: string; // Often same as description, but separate field
  
  iconUrl?: string; // We might store base64 or firebase storage URL. For now, base64 for simplicity if small enough, or external URL.      
  updatedAt?: string;
  createdAt?: string;
}

const INITIAL_DATA: AppData = {
    name: '', localPath: '', supportUrl: '', marketingUrl: '',
    promoText: '', description: '', keywords: '',
    shortDescription: '', fullDescription: ''
};

export default function AppGenerator() {
  const [apps, setApps] = useState<AppData[]>([]);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');

  // Loading Overlay Component
  const LoadingOverlay = ({ text }: { text: string }) => (
    <div className={styles.loadingOverlay}>
        <div className={styles.spinner}></div>
        <p>{text}</p>
    </div>
  );

  // Load apps with Snapshot (Realtime)
  useEffect(() => {
    // Fallback to name ordering if updatedAt is missing in old docs, 
    // but ideally we want updatedAt. 
    // For now, let's use name to guarantee visibility of ALL docs including old ones.
    const q = query(collection(db, "solvin-apps"), orderBy("name"));
    
    const unsub = onSnapshot(q, (snapshot) => {
        const list: AppData[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppData));
        // Sort in memory to handle mixed data (some with updatedAt, some without)
        list.sort((a, b) => {
            if (a.updatedAt && b.updatedAt) {
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            }
            return 0; // Keep original order if no date
        });
        setApps(list);
    }, (error) => {
        console.error("Snapshot error:", error);
    });
    
    return () => unsub();
  }, []);

  // Handle URL ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
        setSelectedAppId(id);
        setView('detail');
        // Fetch specific doc
        getDoc(doc(db, "solvin-apps", id)).then(snap => {
            if (snap.exists()) {
                setData({ id: snap.id, ...snap.data() } as AppData);
            }
        });
    } else {
        setView('list');
        setSelectedAppId(null);
    }
  }, []);

  // Effect to sync selected app data when apps list updates or selection changes
  useEffect(() => {
    if (selectedAppId && apps.length > 0) {
        const app = apps.find(a => a.id === selectedAppId);
        if (app) {
            setData(app);
        }
    }
  }, [selectedAppId, apps]);

  const handleSelect = (app: AppData) => {
    // Update URL without reload
    const url = new URL(window.location.href);
    url.searchParams.set('id', app.id!);
    window.history.pushState({}, '', url);
    
    setSelectedAppId(app.id!);
    setView('detail');
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
        // Create empty doc immediately
        const now = new Date().toISOString();
        const docRef = await addDoc(collection(db, "solvin-apps"), {
            ...INITIAL_DATA,
            name: 'New Untitled App', // Give it a placeholder name so it's visible
            createdAt: now,
            updatedAt: now
        });
        
        const url = new URL(window.location.href);
        url.searchParams.set('id', docRef.id);
        window.history.pushState({}, '', url);

        setSelectedAppId(docRef.id);
        // Data will auto-update via snapshot listener -> useEffect
        setView('detail');
    } catch(e) {
        console.error("Create failed:", e);
        alert('Failed to create draft: ' + e);
    } finally {
        setLoading(false);
    }
  };

  const handleBack = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('id');
    window.history.pushState({}, '', url);
    setView('list');
    setSelectedAppId(null);
  };

  const handleSave = async () => {
    try {
        setLoading(true);
        if (selectedAppId) {
            await updateDoc(doc(db, "solvin-apps", selectedAppId), { 
                ...data,
                updatedAt: new Date().toISOString()
            });
            alert('Saved!');
        }
    } catch (e) {
        alert('Error saving: ' + (e as Error).message);
    } finally {
        setLoading(false);
    }
  };

  // 1. Analyze Local Project
  const analyzeProject = async () => {
    if (!data.localPath) return alert('Please enter a local path first');
    setAnalyzing(true);
    try {
        const res = await fetch('/api/analyze-project', {
            method: 'POST',
            body: JSON.stringify({ projectPath: data.localPath })
        });
        const context = await res.json();
        
        if (context.error) throw new Error(context.error);
        
        // Auto-fill name if empty
        if (!data.name && context.packageJson?.name) {
            setData(prev => ({ ...prev, name: context.packageJson.name }));
        }

        return context; // Return for generator to use
    } catch (e) {
        alert('Analysis failed: ' + (e as Error).message);
        return null;
    } finally {
        setAnalyzing(false);
    }
  };

  // 2. Generate Text (ASO)
  const generateCopy = async () => {
    const context = await analyzeProject();
    if (!context) return;

    setGenerating(true);
    const config = getGeminiConfig();
    
    const prompt = `
      You are an ASO (App Store Optimization) expert.
      Analyze this project context:
      ${JSON.stringify(context).slice(0, 10000)}
      
      Generate ASO copy for:
      1. Apple App Store
      2. Google Play Store

      Requirements:
      - App Name: ${data.name || context.packageJson?.name || 'Unknown'}
      - App Store Promo Text: Max 170 chars. Catchy.
      - App Store Description: Max 4000 chars. Markdown. Professional.
      - App Store Keywords: Max 100 chars, comma separated. High volume.
      - Play Store Short Description: Max 80 chars.
      - Play Store Full Description: Max 4000 chars. HTML compatible (simple tags).

      Return strictly valid JSON:
      {
        "promoText": "...",
        "description": "...",
        "keywords": "...",
        "shortDescription": "...",
        "fullDescription": "..."
      }
    `;

    try {
        let baseUrl = config.baseUrl.replace(/\/$/, '');
        if (!baseUrl.includes('/v1') && !baseUrl.includes('googleapis.com')) {
             baseUrl += '/v1beta';
        }
        
        // Use streamGenerateContent?alt=sse for better compatibility
        const url = `${baseUrl}/models/${config.textModel}:streamGenerateContent?alt=sse`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': config.textApiKey,
                'Accept': '*/*',
                'x-title': 'Cherry Studio',
                'http-referer': 'https://cherry-ai.com'
            },
            body: JSON.stringify({
                generationConfig: {},
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            })
        });
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        // Simple SSE parser for non-streaming UI (accumulate all text)
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        
        while (reader) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(line.substring(6));
                        const textPart = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (textPart) fullText += textPart;
                    } catch (e) { /* ignore keep-alive or malformed */ }
                }
            }
        }
        
        // Clean markdown code blocks if present
        const jsonStr = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
        const generated = JSON.parse(jsonStr);

        setData(prev => ({
            ...prev,
            ...generated
        }));

    } catch (e) {
        alert('Generation failed: ' + (e as Error).message);
    } finally {
        setGenerating(false);
    }
  };

  // 3. Generate Icon
  const generateIcon = async () => {
    const config = getGeminiConfig();
    if (!config.imageApiKey) return alert('Image API Key missing in Settings');
    
    const prompt = prompt("Describe the icon style (e.g., 'Minimalist neon cube, dark background, 3d render'):", "Modern app icon, high quality");
    if (!prompt) return;

    setGenerating(true);
    try {
        let baseUrl = config.baseUrl.replace(/\/$/, '');
        if (!baseUrl.includes('/v1') && !baseUrl.includes('googleapis.com')) {
             baseUrl += '/v1beta';
        }

        const url = `${baseUrl}/models/${config.imageModel}:predict`;
        alert("Note: Direct Image Generation via raw API Key often requires Vertex AI (OAuth) rather than simple API Key. If this fails, check console.");
    } catch (e) {
        alert('Icon Gen Error: ' + (e as Error).message);
    } finally {
        setGenerating(false);
    }
  };

  if (view === 'list') return (
    <div className={styles.container}>
        <div className={styles.header}>
            <h1>Solvin App Tools</h1>
            <div>
                <button onClick={handleCreate} className={styles.primary}>+ New App</button>
            </div>
        </div>
        <div className={styles.list}>
            {apps.map(app => (
                <div key={app.id} className={styles.card} onClick={() => handleSelect(app)}>
                    <div className={styles.iconPlaceholder}>{app.name[0]}</div>
                    <div className={styles.info}>
                        <h3>{app.name || 'Untitled'}</h3>
                        <p>{app.localPath}</p>
                    </div>
                </div>
            ))}
            {apps.length === 0 && <p className={styles.empty}>No apps configured.</p>}
        </div>
    </div>
  );

  return (
    <div className={styles.container}>
        <div className={styles.header}>
            <button onClick={handleBack}>&larr; Back</button>
            <div className={styles.actions}>
                <button onClick={generateCopy} disabled={analyzing || generating}>
                    {analyzing ? 'Analyzing...' : generating ? 'Generating Copy...' : '✨ Auto-Generate Copy'}
                </button>
                <button onClick={handleSave} disabled={loading} className={styles.primary}>
                    {loading ? 'Saving...' : 'Save App'}
                </button>
            </div>
        </div>

        <div className={styles.formGrid}>
            <div className={styles.section}>
                <h3>Basic Info</h3>
                <label>App Name</label>
                <input value={data.name} onChange={e => setData({...data, name: e.target.value})} />
                
                <label>Local Project Path (Absolute)</label>
                <input value={data.localPath} onChange={e => setData({...data, localPath: e.target.value})} placeholder="/Users/neo/Workspaces/..." />
                
                <label>Support URL</label>
                <input value={data.supportUrl} onChange={e => setData({...data, supportUrl: e.target.value})} />
                
                <label>Marketing URL</label>
                <input value={data.marketingUrl} onChange={e => setData({...data, marketingUrl: e.target.value})} />

                <div className={styles.iconSection}>
                     <label>App Icon (1024x1024)</label>
                     <div className={styles.iconPreview}>
                        {data.iconUrl ? <img src={data.iconUrl} /> : <div className={styles.placeholder}>No Icon</div>}
                     </div>
                     <button onClick={generateIcon} className={styles.smBtn} disabled>✨ Generate Icon (Coming Soon)</button>
                     <input type="text" placeholder="Or paste Image URL" value={data.iconUrl || ''} onChange={e => setData({...data, iconUrl: e.target.value})} />
                </div>
            </div>

            <div className={styles.section}>
                <h3>App Store</h3>
                <label>Promo Text ({data.promoText?.length || 0}/170)</label>
                <textarea rows={2} value={data.promoText} onChange={e => setData({...data, promoText: e.target.value})} />
                
                <label>Description ({data.description?.length || 0}/4000)</label>
                <textarea rows={10} value={data.description} onChange={e => setData({...data, description: e.target.value})} />

                <label>Keywords (100 chars)</label>
                <input value={data.keywords} onChange={e => setData({...data, keywords: e.target.value})} />
            </div>

            <div className={styles.section}>
                <h3>Google Play</h3>
                <label>Short Description ({data.shortDescription?.length || 0}/80)</label>
                <textarea rows={2} value={data.shortDescription} onChange={e => setData({...data, shortDescription: e.target.value})} />
                
                <label>Full Description ({data.fullDescription?.length || 0}/4000)</label>
                <textarea rows={10} value={data.fullDescription} onChange={e => setData({...data, fullDescription: e.target.value})} />
            </div>
        </div>

        {(loading || analyzing || generating) && (
            <LoadingOverlay 
                text={loading ? 'Saving...' : analyzing ? 'Analyzing Project...' : 'Generating AI Content...'} 
            />
        )}
    </div>
  );
}
