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
import { Sparkles, Save, Apple, Play, Plus, Loader2, Smartphone, Search, AlertCircle, FileText } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [apps, setApps] = useState<AppData[]>([]);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  
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

    const q = query(
        collection(db, "solvin-apps"), 
        where("ownerId", "==", user.uid)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
        const list: AppData[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppData));
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

  // Handle URL ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
        setSelectedAppId(id);
        // Fetch specific doc if not in list yet (though list usually loads fast)
        getDoc(doc(db, "solvin-apps", id)).then(snap => {
            if (snap.exists()) {
                setData({ id: snap.id, ...snap.data() } as AppData);
            }
        });
    } else {
        setSelectedAppId(null);
    }
  }, []);

  // Sync selected app data
  useEffect(() => {
    if (selectedAppId && apps.length > 0) {
        const app = apps.find(a => a.id === selectedAppId);
        if (app) {
            setData(app);
        }
    }
  }, [selectedAppId, apps]);

  const handleSelect = (app: AppData) => {
    const url = new URL(window.location.href);
    url.searchParams.set('id', app.id!);
    window.history.pushState({}, '', url);
    setSelectedAppId(app.id!);
  };

  const handleCreate = async () => {
    if (!user) return;
    setLoading(true);
    try {
        const now = new Date().toISOString();
        const docRef = await addDoc(collection(db, "solvin-apps"), {
            ...INITIAL_DATA,
            ownerId: user.uid,
            name: 'New Untitled App', 
            createdAt: now,
            updatedAt: now
        });
        
        const url = new URL(window.location.href);
        url.searchParams.set('id', docRef.id);
        window.history.pushState({}, '', url);

        setSelectedAppId(docRef.id);
    } catch(e) {
        console.error("Create failed:", e);
        alert('Failed to create draft: ' + e);
    } finally {
        setLoading(false);
    }
  };

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
    } catch (e) {
        alert('Error saving: ' + (e as Error).message);
    } finally {
        setLoading(false);
    }
  };

  const analyzeProject = async () => {
    if (!data.localPath) return alert('Please enter a GitHub Repo or Local Path first');
    setAnalyzing(true);
    const config = getGeminiConfig();

    try {
        const res = await fetch('/api/analyze-project', {
            method: 'POST',
            body: JSON.stringify({
                projectPath: data.localPath,
                githubToken: config.githubToken
            })
        });
        const context = await res.json();
        
        if (context.error) throw new Error(context.error);
        
        if (!data.name && context.packageJson?.name) {
            const newName = context.packageJson.name;
            setData(prev => ({ ...prev, name: newName }));
            saveDataToFirestore({ ...data, name: newName });
        }

        return context;
    } catch (e) {
        alert('Analysis failed: ' + (e as Error).message);
        return null;
    } finally {
        setAnalyzing(false);
    }
  };

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
                    } catch (e) { } // ignore keep-alive or malformed
                }
            }
        }
        
        const jsonStr = fullText.replace(/```json/g, '').replace(/```/g, '').trim();
        const generated = JSON.parse(jsonStr);

        const finalData = { ...data, ...generated };
        setData(finalData);
        await saveDataToFirestore(finalData);
        
    } catch (e) {
        alert('Generation failed: ' + (e as Error).message);
    } finally {
        setGenerating(false);
    }
  };

  if (authLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  if (!user) {
      return (
          <div className="flex h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 text-center p-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Login Required</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">Please sign in from the top right corner to access your projects.</p>
          </div>
      );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Sidebar */}
        <Card className="flex flex-col h-full overflow-hidden border-border/60 bg-card/50 backdrop-blur-sm shadow-sm">
            <div className="p-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Apps</h2>
                <Button variant="ghost" size="icon" onClick={handleCreate} title="New App" className="h-7 w-7 hover:bg-primary/10 hover:text-primary">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {apps.map(app => (
                    <div 
                        key={app.id} 
                        className={`
                            group flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all border
                            ${selectedAppId === app.id 
                                ? 'bg-background border-border/60 shadow-sm ring-1 ring-primary/5' 
                                : 'border-transparent hover:bg-muted/50 hover:border-border/30 text-muted-foreground'}
                        `}
                        onClick={() => handleSelect(app)}
                    >
                        <div className={
                            `flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors
                            ${selectedAppId === app.id 
                                ? 'bg-primary text-primary-foreground shadow-sm' 
                                : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'}`
                        }>
                            {app.name ? app.name[0].toUpperCase() : '?'}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className={`text-sm font-medium truncate ${selectedAppId === app.id ? 'text-foreground' : ''}`}>
                                {app.name || 'Untitled App'}
                            </span>
                            <span className="text-[10px] text-muted-foreground/70 truncate">
                                {app.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : 'No date'}
                            </span>
                        </div>
                    </div>
                ))}
                {apps.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground p-4">
                        <Smartphone className="h-8 w-8 mb-2 opacity-20" />
                        <span className="text-xs">No apps found.</span>
                        <Button variant="link" size="sm" onClick={handleCreate} className="text-xs mt-1">Create one?</Button>
                    </div>
                )}
            </div>
        </Card>

        {/* Main Content */}
        <div className="flex flex-col h-full overflow-hidden">
            {!selectedAppId ? (
                <Card className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-muted/10 border-dashed border-2 shadow-none">
                    <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <Smartphone className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Select an App</h3>
                    <p className="text-muted-foreground max-w-xs mx-auto mb-8 text-sm">Choose an app from the sidebar to manage its metadata or create a new one to get started.</p>
                    <Button onClick={handleCreate} className="shadow-sm">Create New App</Button>
                </Card>
            ) : (
                <>
                    {/* Top Bar */}
                    <div className="flex items-center justify-between mb-4 px-1 shrink-0">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-border/40">
                                <FileText className="w-3.5 h-3.5" />
                                <span className="font-medium text-foreground">
                                    {data.name || 'Untitled'}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <Button 
                                variant="outline"
                                size="sm"
                                onClick={generateCopy} 
                                disabled={analyzing || generating} 
                                className="gap-2 bg-indigo-50/50 hover:bg-indigo-100/50 text-indigo-700 border-indigo-200 hover:border-indigo-300 shadow-sm"
                            >
                                {analyzing || generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                <span className="hidden sm:inline">{analyzing ? 'Analyzing...' : generating ? 'Writing...' : 'Auto-Generate'}</span>
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={loading} className="gap-2 shadow-sm min-w-[100px]">
                                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                {loading ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>

                    {/* Scrollable Form Area */}
                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 pb-6 space-y-6">
                        
                        {/* Project Identity */}
                        <Card className="border-border/60 bg-card/50 backdrop-blur-sm shadow-sm">
                            <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
                                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Project Identity</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-6 p-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase">App Name</Label>
                                        <Input 
                                            value={data.name} 
                                            onChange={e => setData({...data, name: e.target.value})} 
                                            placeholder="e.g. Super ToDo" 
                                            className="font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase">GitHub Repo / Local Path</Label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input 
                                                value={data.localPath} 
                                                onChange={e => setData({...data, localPath: e.target.value})} 
                                                placeholder="owner/repo" 
                                                className="pl-9 font-mono text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Support URL</Label>
                                        <Input 
                                            value={data.supportUrl} 
                                            onChange={e => setData({...data, supportUrl: e.target.value})} 
                                            placeholder="https://..." 
                                            className="font-mono text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-muted-foreground uppercase">Marketing URL</Label>
                                        <Input 
                                            value={data.marketingUrl} 
                                            onChange={e => setData({...data, marketingUrl: e.target.value})} 
                                            placeholder="https://..." 
                                            className="font-mono text-sm"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Store Grid */}
                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* Apple App Store */}
                            <Card className="border-t-4 border-t-zinc-800 shadow-md">
                                <CardHeader className="pb-4 flex flex-row items-center gap-2 border-b border-border/40 bg-muted/10">
                                    <Apple className="h-5 w-5" />
                                    <CardTitle className="text-base font-semibold">App Store</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-5 p-5">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <Label>Promo Text</Label>
                                            <span className={`font-mono ${data.promoText?.length > 170 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                                                {data.promoText?.length || 0}/170
                                            </span>
                                        </div>
                                        <Textarea 
                                            rows={3} 
                                            value={data.promoText} 
                                            onChange={e => setData({...data, promoText: e.target.value})}
                                            className="resize-none" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <Label>Description</Label>
                                            <span className="text-muted-foreground font-mono">{data.description?.length || 0}/4000</span>
                                        </div>
                                        <Textarea 
                                            rows={12} 
                                            className="font-mono text-xs leading-relaxed" 
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
                            <Card className="border-t-4 border-t-emerald-600 shadow-md">
                                <CardHeader className="pb-4 flex flex-row items-center gap-2 border-b border-border/40 bg-muted/10">
                                    <Play className="h-5 w-5 text-emerald-600" />
                                    <CardTitle className="text-base font-semibold">Google Play</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-5 p-5">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <Label>Short Description</Label>
                                            <span className={`font-mono ${data.shortDescription?.length > 80 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                                                {data.shortDescription?.length || 0}/80
                                            </span>
                                        </div>
                                        <Textarea 
                                            rows={3} 
                                            value={data.shortDescription} 
                                            onChange={e => setData({...data, shortDescription: e.target.value})} 
                                            className="resize-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <Label>Full Description</Label>
                                            <span className="text-muted-foreground font-mono">{data.fullDescription?.length || 0}/4000</span>
                                        </div>
                                        <Textarea 
                                            rows={12} 
                                            className="font-mono text-xs leading-relaxed" 
                                            value={data.fullDescription} 
                                            onChange={e => setData({...data, fullDescription: e.target.value})} 
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </>
            )}
        </div>

        {(loading || analyzing || generating) && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium text-foreground animate-pulse">
                    {loading ? 'Saving Changes...' : analyzing ? 'Analyzing Project Structure...' : 'Generating Marketing Copy...'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">This may take a moment</p>
            </div>
        )}
    </div>
  );
}