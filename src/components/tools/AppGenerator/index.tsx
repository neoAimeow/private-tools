import React, { useState, useEffect, useRef } from 'react';
import styles from './style.module.scss';
import { db, storage, auth } from '../../../lib/firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, getDoc, where } from 'firebase/firestore';
import { ref, getDownloadURL, uploadString } from 'firebase/storage';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getGeminiConfig } from '../../../lib/config';

interface AppData {
  id?: string;
  ownerId?: string;
  name: string;
  localPath: string;
  supportUrl: string;
  marketingUrl: string;
  promoText: string;
  description: string;
  keywords: string;
  shortDescription: string;
  fullDescription: string;
  updatedAt?: string;
  createdAt?: string;
}

const INITIAL_DATA: AppData = {
    name: '', localPath: '', supportUrl: '', marketingUrl: '',
    promoText: '', description: '', keywords: '',
    shortDescription: '', fullDescription: ''
};

export default function AppGenerator() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [apps, setApps] = useState<AppData[]>([]);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Load apps with Snapshot (Realtime) - DEPENDS ON USER
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        setApps([]);
        return;
    }

    // Filter by ownerId
    const q = query(
        collection(db, "solvin-apps"), 
        where("ownerId", "==", user.uid)
        // orderBy("name") // Removed to avoid index issues for now
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
        const list: AppData[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppData));
        // Sort in memory
        list.sort((a, b) => {
            if (a.updatedAt && b.updatedAt) {
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            }
            return (a.name || '').localeCompare(b.name || '');
        });
        setApps(list);
    }, (error) => {
        console.error("Snapshot error:", error);
    });
    
    return () => unsub();
  }, [user, authLoading]);

  if (authLoading) return <div className={styles.loadingOverlay}><div className={styles.spinner}></div></div>;

  if (!user) {
      return (
          <div className={styles.emptyState} style={{height: '60vh'}}>
              <h3>Login Required</h3>
              <p>Please sign in from the top right corner to access your apps.</p>
          </div>
      );
  }

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
    if (!user) return;
    setLoading(true);
    try {
        // Create empty doc immediately
        const now = new Date().toISOString();
        const docRef = await addDoc(collection(db, "solvin-apps"), {
            ...INITIAL_DATA,
            ownerId: user.uid,
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

  // Helper to save data
  const saveDataToFirestore = async (newData: AppData) => {
      if (!selectedAppId) return;
      await updateDoc(doc(db, "solvin-apps", selectedAppId), { 
        ...newData,
        updatedAt: new Date().toISOString()
      });
  };

  const handleSave = async () => {
    try {
        setLoading(true);
        await saveDataToFirestore(data);
        alert('Saved!');
    } catch (e) {
        alert('Error saving: ' + (e as Error).message);
    } finally {
        setLoading(false);
    }
  };

  // 1. Analyze Project (Local or GitHub)
  const analyzeProject = async () => {
    if (!data.localPath) return alert('Please enter a GitHub Repo or Local Path first');
    setAnalyzing(true);
    
    // Get config for token
    const config = getGeminiConfig();

    try {
        const res = await fetch('/api/analyze-project', {
            method: 'POST',
            body: JSON.stringify({ 
                projectPath: data.localPath,
                githubToken: config.githubToken // Pass token if set
            })
        });
        const context = await res.json();
        
        if (context.error) throw new Error(context.error);
        
        // Auto-fill name if empty
        if (!data.name && context.packageJson?.name) {
            const newName = context.packageJson.name;
            setData(prev => ({ ...prev, name: newName }));
            // Also auto-save the name discovery
            saveDataToFirestore({ ...data, name: newName });
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
      - Play Store Full Description: Max 4000 chars. Markdown format.

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

        const finalData = {
            ...data,
            ...generated
        };

        // Update UI
        setData(finalData);
        
        // Auto Save
        await saveDataToFirestore(finalData);
        
    } catch (e) {
        alert('Generation failed: ' + (e as Error).message);
    } finally {
        setGenerating(false);
    }
  };

  // ... (previous code remains the same up to render) ...

  return (
    <div className={styles.splitLayout}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
                <h2>Apps</h2>
                <button onClick={handleCreate} className={styles.iconBtn} title="New App">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                </button>
            </div>
            
            <div className={styles.appList}>
                {apps.map(app => (
                    <div 
                        key={app.id} 
                        className={`${styles.navItem} ${selectedAppId === app.id ? styles.active : ''}`} 
                        onClick={() => handleSelect(app)}
                    >
                        <div className={styles.navIcon}>{app.name[0]?.toUpperCase()}</div>
                        <div className={styles.navInfo}>
                            <span className={styles.navTitle}>{app.name || 'Untitled'}</span>
                            <span className={styles.navSubtitle}>{app.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : 'No date'}</span>
                        </div>
                    </div>
                ))}
                {apps.length === 0 && <div className={styles.emptyNav}>No apps yet.</div>}
            </div>
        </div>

        {/* Main Content */}
        <div className={styles.mainContent}>
            {!selectedAppId ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📱</div>
                    <h3>Select an App</h3>
                    <p>Choose an app from the sidebar or create a new one to get started.</p>
                    <button onClick={handleCreate} className={styles.primary}>Create New App</button>
                </div>
            ) : (
                <>
                    <div className={styles.topBar}>
                        <div className={styles.breadcrumbs}>
                            <span>Apps</span>
                            <span className={styles.separator}>/</span>
                            <span className={styles.current}>{data.name || 'Untitled'}</span>
                        </div>
                        <div className={styles.actions}>
                             <button onClick={generateCopy} disabled={analyzing || generating} className={styles.magicBtn}>
                                {analyzing ? 'Analyzing...' : generating ? 'Generating...' : '✨ Auto-Generate'}
                            </button>
                            <button onClick={handleSave} disabled={loading} className={styles.primary}>
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>

                    <div className={styles.scrollArea}>
                        <div className={styles.formGrid}>
                            {/* Basic Info Card */}
                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <h3>Project Identity</h3>
                                </div>
                                <div className={styles.cardBody}>
                                    <div className={styles.row}>
                                        <div className={styles.fieldGroup}>
                                            <label>App Name</label>
                                            <input value={data.name} onChange={e => setData({...data, name: e.target.value})} placeholder="e.g. Super ToDo" />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>GitHub Repo / Local Path</label>
                                            <input value={data.localPath} onChange={e => setData({...data, localPath: e.target.value})} placeholder="owner/repo (e.g. facebook/react) or /local/path" />
                                        </div>
                                    </div>
                                    
                                    <div className={styles.row}>
                                        <div className={styles.fieldGroup}>
                                            <label>Support URL</label>
                                            <input value={data.supportUrl} onChange={e => setData({...data, supportUrl: e.target.value})} placeholder="https://..." />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Marketing URL</label>
                                            <input value={data.marketingUrl} onChange={e => setData({...data, marketingUrl: e.target.value})} placeholder="https://..." />
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Store Metadata Grid */}
                            <div className={styles.storeGrid}>
                                {/* Apple App Store */}
                                <div className={styles.card}>
                                    <div className={`${styles.cardHeader} ${styles.appleHeader}`}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.4 12.8c-.1-1.7 1.4-2.5 1.5-2.6-1.6-2.3-4-2.6-4.8-2.6-2-.2-3.9 1.2-4.9 1.2-1 0-2.6-1.1-4.3-1.1-2.2 0-4.2 1.3-5.3 3.3-2.3 3.9-.6 9.7 1.6 13 1.1 1.6 2.4 3.4 4.1 3.4 1.6 0 2.3-1.1 4.3-1.1 2 0 2.6 1.1 4.3 1.1 1.8 0 3-1.6 4.1-3.2 1.3-1.8 1.8-3.6 1.8-3.7 0 0-3.4-1.3-3.4-5.1zM14.8 5.7c.9-1.1 1.5-2.6 1.3-4.1-1.3.1-2.9.9-3.8 2-1 .9-1.6 2.6-1.4 4 1.4.1 2.9-.8 3.9-1.9z"/></svg>
                                        <h3>App Store</h3>
                                    </div>
                                    <div className={styles.cardBody}>
                                        <div className={styles.fieldGroup}>
                                            <div className={styles.labelRow}>
                                                <label>Promo Text</label>
                                                <span className={data.promoText?.length > 170 ? styles.error : ''}>{data.promoText?.length || 0}/170</span>
                                            </div>
                                            <textarea rows={3} value={data.promoText} onChange={e => setData({...data, promoText: e.target.value})} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <div className={styles.labelRow}>
                                                <label>Description</label>
                                                <span>{data.description?.length || 0}/4000</span>
                                            </div>
                                            <textarea rows={12} className={styles.codeFont} value={data.description} onChange={e => setData({...data, description: e.target.value})} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label>Keywords</label>
                                            <input value={data.keywords} onChange={e => setData({...data, keywords: e.target.value})} placeholder="productivity, task, ..." />
                                        </div>
                                    </div>
                                </div>

                                {/* Google Play Store */}
                                <div className={styles.card}>
                                    <div className={`${styles.cardHeader} ${styles.playHeader}`}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 2.8C4.1 3.2 3.9 3.8 3.9 4.6v14.8c0 .8.2 1.4.6 1.8l.2.2 8.6-8.6v-.4L4.7 2.6l-.2.2zm10.2 9.4l2.7 2.7-3.3 1.9L13 15.7l1.7-3.5zm1.1-1.1l-6-5.9-1.1 1.1 7.1 7.1 5.3-3-5.3.7zm-7.1 7.1l6-5.9 5.3 3-8.6 4.8-2.7-1.9z"/></svg>
                                        <h3>Google Play</h3>
                                    </div>
                                    <div className={styles.cardBody}>
                                        <div className={styles.fieldGroup}>
                                            <div className={styles.labelRow}>
                                                <label>Short Description</label>
                                                <span className={data.shortDescription?.length > 80 ? styles.error : ''}>{data.shortDescription?.length || 0}/80</span>
                                            </div>
                                            <textarea rows={3} value={data.shortDescription} onChange={e => setData({...data, shortDescription: e.target.value})} />
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <div className={styles.labelRow}>
                                                <label>Full Description</label>
                                                <span>{data.fullDescription?.length || 0}/4000</span>
                                            </div>
                                            <textarea rows={12} className={styles.codeFont} value={data.fullDescription} onChange={e => setData({...data, fullDescription: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>

        {(loading || analyzing || generating) && (
            <LoadingOverlay 
                text={loading ? 'Saving...' : analyzing ? 'Analyzing Project...' : 'Generating AI Content...'} 
            />
        )}
    </div>
  );
}
