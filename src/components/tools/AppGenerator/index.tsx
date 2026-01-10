import React, { useState, useEffect, useRef } from 'react';
import { db, storage, auth } from '../../../lib/firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, getDoc, where } from 'firebase/firestore';
import { ref, getDownloadURL, uploadString } from 'firebase/storage';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getGeminiConfig } from '../../../lib/config';

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Save, Apple, Play, Plus, Loader2, Smartphone } from 'lucide-react';

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

  if (authLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  if (!user) {
      return (
          <div className="flex h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/50 text-center p-8">
              <h3 className="text-xl font-semibold">Login Required</h3>
              <p className="text-muted-foreground mt-2 mb-6">Please sign in from the top right corner to access your apps.</p>
          </div>
      );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 h-[calc(100vh-8rem)]">
        {/* Hidden File Input */}
        <input 
            type="file" 
            ref={fileInputRef} 
            // onChange={handleFileUpload} 
            accept="image/*" 
            style={{ display: 'none' }} 
        />
        
        {/* Sidebar */}
        <Card className="flex flex-col h-full overflow-hidden border-border/50 bg-background/50 backdrop-blur-xl">
            <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">My Apps</h2>
                <Button variant="ghost" size="icon" onClick={handleCreate} title="New App" className="h-8 w-8">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {apps.map(app => (
                    <div 
                        key={app.id} 
                        className={`
                            flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border
                            ${selectedAppId === app.id 
                                ? 'bg-background border-border shadow-sm ring-1 ring-ring/10' 
                                : 'border-transparent hover:bg-muted/50 hover:border-border/30 text-muted-foreground'}
                        `}
                        onClick={() => handleSelect(app)}
                    >
                        <div className={`
                            flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold
                            ${selectedAppId === app.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                        `}>
                            {app.name[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className={`text-sm font-medium truncate ${selectedAppId === app.id ? 'text-foreground' : ''}`}>
                                {app.name || 'Untitled App'}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                                {app.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : 'No date'}
                            </span>
                        </div>
                    </div>
                ))}
                {apps.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground p-4">
                        <Smartphone className="h-8 w-8 mb-2 opacity-20" />
                        <span className="text-xs">No apps yet. Click + to create one.</span>
                    </div>
                )}
            </div>
        </Card>

        {/* Main Content */}
        <div className="flex flex-col h-full overflow-hidden">
            {!selectedAppId ? (
                <Card className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-muted/10 border-dashed">
                    <Smartphone className="h-16 w-16 text-muted-foreground/20 mb-4" />
                    <h3 className="text-lg font-semibold">Select an App</h3>
                    <p className="text-muted-foreground max-w-xs mt-2 mb-6">Choose an app from the sidebar or create a new one to get started.</p>
                    <Button onClick={handleCreate}>Create New App</Button>
                </Card>
            ) : (
                <>
                    {/* Top Bar */}
                    <div className="flex items-center justify-between mb-6 px-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Apps</span>
                            <span className="text-border">/</span>
                            <span className="font-semibold text-foreground bg-background px-2 py-0.5 rounded border shadow-sm">
                                {data.name || 'Untitled'}
                            </span>
                        </div>
                        <div className="flex gap-3">
                             <Button 
                                variant="outline" 
                                onClick={generateCopy} 
                                disabled={analyzing || generating} 
                                className="gap-2 bg-background/50 backdrop-blur-sm border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-indigo-600 dark:text-indigo-300"
                            >
                                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                                 generating ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                                 <Sparkles className="h-4 w-4" />}
                                {analyzing ? 'Analyzing...' : generating ? 'Writing...' : 'Auto-Generate'}
                            </Button>
                            <Button onClick={handleSave} disabled={loading} className="gap-2">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {loading ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>

                    {/* Scrollable Form Area */}
                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 pb-20">
                        <div className="grid gap-6">
                            
                            {/* Project Identity */}
                            <Card>
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-base">Project Identity</CardTitle>
                                    <CardDescription>Core details about your application.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-6">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>App Name</Label>
                                            <Input 
                                                value={data.name} 
                                                onChange={e => setData({...data, name: e.target.value})} 
                                                placeholder="e.g. Super ToDo" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>GitHub Repo / Local Path</Label>
                                            <Input 
                                                value={data.localPath} 
                                                onChange={e => setData({...data, localPath: e.target.value})} 
                                                placeholder="owner/repo (e.g. facebook/react)" 
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>Support URL</Label>
                                            <Input 
                                                value={data.supportUrl} 
                                                onChange={e => setData({...data, supportUrl: e.target.value})} 
                                                placeholder="https://..." 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Marketing URL</Label>
                                            <Input 
                                                value={data.marketingUrl} 
                                                onChange={e => setData({...data, marketingUrl: e.target.value})} 
                                                placeholder="https://..." 
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Store Grid */}
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Apple App Store */}
                                <Card className="border-t-4 border-t-zinc-800">
                                    <CardHeader className="pb-4 flex flex-row items-center gap-2 space-y-0">
                                        <Apple className="h-5 w-5 mb-1" />
                                        <div className="flex flex-col">
                                            <CardTitle className="text-base">App Store</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="grid gap-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <Label>Promo Text</Label>
                                                <span className={data.promoText?.length > 170 ? "text-destructive font-bold" : "text-muted-foreground"}>
                                                    {data.promoText?.length || 0}/170
                                                </span>
                                            </div>
                                            <Textarea 
                                                rows={3} 
                                                value={data.promoText} 
                                                onChange={e => setData({...data, promoText: e.target.value})} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <Label>Description</Label>
                                                <span className="text-muted-foreground">{data.description?.length || 0}/4000</span>
                                            </div>
                                            <Textarea 
                                                rows={12} 
                                                className="font-mono text-xs" 
                                                value={data.description} 
                                                onChange={e => setData({...data, description: e.target.value})} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Keywords</Label>
                                            <Input 
                                                value={data.keywords} 
                                                onChange={e => setData({...data, keywords: e.target.value})} 
                                                placeholder="productivity, task, ..." 
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Google Play Store */}
                                <Card className="border-t-4 border-t-emerald-600">
                                    <CardHeader className="pb-4 flex flex-row items-center gap-2 space-y-0">
                                        <Play className="h-5 w-5 mb-1 text-emerald-600" />
                                        <div className="flex flex-col">
                                            <CardTitle className="text-base">Google Play</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="grid gap-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <Label>Short Description</Label>
                                                <span className={data.shortDescription?.length > 80 ? "text-destructive font-bold" : "text-muted-foreground"}>
                                                    {data.shortDescription?.length || 0}/80
                                                </span>
                                            </div>
                                            <Textarea 
                                                rows={3} 
                                                value={data.shortDescription} 
                                                onChange={e => setData({...data, shortDescription: e.target.value})} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <Label>Full Description</Label>
                                                <span className="text-muted-foreground">{data.fullDescription?.length || 0}/4000</span>
                                            </div>
                                            <Textarea 
                                                rows={12} 
                                                className="font-mono text-xs" 
                                                value={data.fullDescription} 
                                                onChange={e => setData({...data, fullDescription: e.target.value})} 
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>

        {(loading || analyzing || generating) && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium text-foreground animate-pulse">
                    {loading ? 'Saving Changes...' : analyzing ? 'Analyzing Project Structure...' : 'Generating Marketing Copy...'}
                </p>
            </div>
        )}
    </div>
  );
}
