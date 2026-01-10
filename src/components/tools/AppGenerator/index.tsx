import React, { useState, useEffect, useRef } from 'react';
import { db, storage, auth } from '../../../lib/firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, getDoc, where } from 'firebase/firestore';
import { ref, getDownloadURL, uploadString } from 'firebase/storage';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getGeminiConfig } from '../../../lib/config';

// UI Components - Using standard HTML/Tailwind for cleaner custom layout
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Sparkles, Save, Plus, Search, Smartphone, Apple, Play, Github, LayoutTemplate, Lock, BookOpen, Star } from "lucide-react";

// ... existing code ...

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

  // Repo Selection State
  const [repoModalOpen, setRepoModalOpen] = useState(false);
  const [repos, setRepos] = useState<any[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Auth & Data Loading
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authLoading || !user) { if(!authLoading) setApps([]); return; }
    const q = query(collection(db, "solvin-apps"), where("ownerId", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
        const list: AppData[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppData));
        list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        setApps(list);
    });
    return () => unsub();
  }, [user, authLoading]);

  // URL Sync
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
        setSelectedAppId(id);
        getDoc(doc(db, "solvin-apps", id)).then(snap => {
            if (snap.exists()) setData({ id: snap.id, ...snap.data() } as AppData);
        });
    } else { setSelectedAppId(null); }
  }, []);

  // Sync selection
  useEffect(() => {
    if (selectedAppId && apps.length > 0) {
        const app = apps.find(a => a.id === selectedAppId);
        if (app) setData(app);
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
            ...INITIAL_DATA, ownerId: user.uid, name: 'Untitled Project', createdAt: now, updatedAt: now
        });
        handleSelect({ id: docRef.id, ...INITIAL_DATA, name: 'Untitled Project' } as AppData);
    } catch(e) { alert(e); } finally { setLoading(false); }
  };

  const handleSave = async () => {
      if (!selectedAppId) return;
      setLoading(true);
      try {
          await updateDoc(doc(db, "solvin-apps", selectedAppId), { ...data, updatedAt: new Date().toISOString() });
      } catch (e) { alert(e); } finally { setLoading(false); }
  };


  const fetchRepos = async () => {
      const config = getGeminiConfig();
      if (!config.githubToken) {
          alert("Please set your GitHub Token in Settings first.");
          return;
      }
      setLoadingRepos(true);
      setRepoModalOpen(true);
      try {
          const res = await fetch('/api/list-repos', {
              method: 'POST',
              body: JSON.stringify({ token: config.githubToken })
          });
          const json = await res.json();
          if (json.error) throw new Error(json.error);
          setRepos(json.repos || []);
      } catch (e) {
          alert((e as Error).message);
          setRepoModalOpen(false);
      } finally {
          setLoadingRepos(false);
      }
  };

  const handleSelectRepo = (full_name: string) => {
      setData({ ...data, localPath: full_name });
      setRepoModalOpen(false);
  };


  // Logic functions (Analyze/Generate) remain largely same, just calling them cleaner
  const analyzeProject = async () => {
    if (!data.localPath) { alert('Please enter a Repo Path'); return null; }
    setAnalyzing(true);
    try {
        const config = getGeminiConfig();
        const res = await fetch('/api/analyze-project', {
            method: 'POST', body: JSON.stringify({ projectPath: data.localPath, githubToken: config.githubToken })
        });
        const ctx = await res.json();
        if (ctx.error) throw new Error(ctx.error);
        if (!data.name && ctx.packageJson?.name) {
             const newName = ctx.packageJson.name;
             setData(p => ({...p, name: newName}));
             updateDoc(doc(db, "solvin-apps", selectedAppId!), { name: newName });
        }
        return ctx;
    } catch(e) { alert(e); return null; } finally { setAnalyzing(false); }
  };

  const generateCopy = async () => {
    const ctx = await analyzeProject();
    if (!ctx) return;
    setGenerating(true);
    try {
        const config = getGeminiConfig();
        const prompt = `You are an expert ASO Copywriter. Analyze this project: ${JSON.stringify(ctx)}. 
        Generate JSON for Apple/Google stores. App Name: ${data.name}. 
        
        STRICTLY adhere to these character limits (count includes spaces, MUST be less than or equal to limit):
        - promoText: Max 170 characters (iOS Promotional Text).
        - keywords: Max 100 characters (Comma separated).
        - shortDescription: Max 80 characters (Android Short Description).
        
        Return strictly JSON: { "promoText": "...", "description": "...", "keywords": "...", "shortDescription": "...", "fullDescription": "..." }`;
        
        // Use custom proxy and headers as requested, dynamically built from config
        let baseUrl = config.baseUrl.replace(/\/$/, '');
        // If the user's config doesn't end in /v1beta (or similar), we might need to be careful.
        // But per instruction "splice from configured url", we trust the user's config.baseUrl 
        // matches the proxy root (e.g. http://127.0.0.1:8045/v1beta).
        
        const targetUrl = `${baseUrl}/models/${config.textModel}:streamGenerateContent?alt=sse`;
        const apiKey = config.textApiKey;

        const res = await fetch(targetUrl, {
             method: 'POST', 
             headers: {
                 'Content-Type': 'application/json',
                 'x-goog-api-key': apiKey,
                 'http-referer': 'https://cherry-ai.com',
                 'x-title': 'Cherry Studio',
             },
             body: JSON.stringify({ 
                 contents: [{ role: "user", parts: [{ text: prompt }] }],
                 generationConfig: {}
             })
        });

        if (!res.body) throw new Error("No response body");
        
        // Handle SSE Stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (dataStr === '[DONE]') continue;
                    try {
                        const json = JSON.parse(dataStr);
                        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) fullText += text;
                    } catch (e) { console.error('SSE Parse Error', e); }
                }
            }
        }
        
        if (!fullText) throw new Error("No content generated");
        
        const genData = JSON.parse(fullText.replace(/```json/g, '').replace(/```/g, '').trim());
        const final = { ...data, ...genData };
        setData(final);
        await updateDoc(doc(db, "solvin-apps", selectedAppId!), final);
    } catch(e) { alert(e); } finally { setGenerating(false); }
  };

  if (authLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin opacity-50" /></div>;
  if (!user) return (
    <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center"><Smartphone className="w-8 h-8 opacity-50"/></div>
        <p>Please sign in to manage apps</p>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-white rounded-xl shadow-2xl border border-zinc-200/50 overflow-hidden text-sm">
        {/* SIDEBAR */}
        <div className="w-64 bg-zinc-50/50 border-r border-zinc-100 flex flex-col shrink-0">
            <div className="p-4 border-b border-border/40 bg-muted/20 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Listing Studio</h2>
                <Button variant="ghost" size="icon" onClick={handleCreate} title="New App" className="h-7 w-7 hover:bg-primary/10 hover:text-primary">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {apps.map(app => (
                    <div key={app.id} onClick={() => handleSelect(app)}
                        className={`group px-3 py-2 rounded-md flex items-center gap-2.5 cursor-pointer transition-all ${selectedAppId === app.id ? 'bg-white shadow-sm ring-1 ring-zinc-200' : 'hover:bg-zinc-100/80 text-zinc-500'}`}
                    >
                        <div className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold ${selectedAppId === app.id ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-zinc-200 text-zinc-500 group-hover:bg-zinc-300'}`}>
                            {app.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className={`text-xs font-medium truncate ${selectedAppId === app.id ? 'text-zinc-900' : ''}`}>{app.name}</div>
                            <div className="text-[9px] text-zinc-400 truncate">{app.updatedAt ? new Date(app.updatedAt).toLocaleDateString() : 'New'}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col min-w-0 bg-white relative">
            {!selectedAppId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 space-y-4">
                    <LayoutTemplate className="w-12 h-12 opacity-20"/>
                    <p>Select a project to view details</p>
                </div>
            ) : (
                <>
                {/* Header */}
                <div className="h-14 border-b border-zinc-50 flex items-center justify-between px-6 shrink-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg text-zinc-800 tracking-tight">{data.name}</span>
                        {data.localPath && <a href={`https://github.com/${data.localPath}`} target="_blank" className="text-zinc-400 hover:text-zinc-600"><Github className="w-4 h-4"/></a>}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={generateCopy} disabled={analyzing||generating} className="h-8 text-xs gap-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50">
                            {analyzing||generating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                            {analyzing ? 'Scanning...' : generating ? 'Writing...' : 'AI Generate'}
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={loading} className="h-8 text-xs gap-2 bg-zinc-900 text-white hover:bg-zinc-800">
                            {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>}
                            Save
                        </Button>
                    </div>
                </div>

                {/* Content Scroll */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto p-8 space-y-10">
                        
                        {/* Section: Identity */}
                        <section className="space-y-4 animate-slide-up">
                            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                                <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                                Identity & Config
                            </h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-zinc-500 ml-1">Project Name</label>
                                    <input value={data.name} onChange={e=>setData({...data, name: e.target.value})} 
                                        className="w-full bg-zinc-50 border-0 rounded-lg px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium placeholder:text-zinc-300" placeholder="App Name"/>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-zinc-500 ml-1">GitHub Repo</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Github className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400"/>
                                            <input value={data.localPath} onChange={e=>setData({...data, localPath: e.target.value})} 
                                                className="w-full bg-zinc-50 border-0 rounded-lg pl-9 pr-3 py-2 text-zinc-700 font-mono text-xs focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-300" placeholder="username/repo"/>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={fetchRepos} className="h-[34px] px-3 bg-zinc-50 border-0 hover:bg-zinc-100 text-zinc-600">
                                            <Search className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-zinc-500 ml-1">Marketing URL</label>
                                    <input value={data.marketingUrl} onChange={e=>setData({...data, marketingUrl: e.target.value})} 
                                        className="w-full bg-zinc-50 border-0 rounded-lg px-3 py-2 text-zinc-700 text-xs focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="https://..."/>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-zinc-500 ml-1">Support URL</label>
                                    <input value={data.supportUrl} onChange={e=>setData({...data, supportUrl: e.target.value})} 
                                        className="w-full bg-zinc-50 border-0 rounded-lg px-3 py-2 text-zinc-700 text-xs focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="https://..."/>
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-zinc-100 w-full"></div>

                        {/* Section: App Store */}
                        <section className="space-y-4 animate-slide-up" style={{animationDelay: '0.1s'}}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                                    <Apple className="w-4 h-4 text-zinc-900"/> iOS App Store
                                </h3>
                                <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full font-mono">EN-US</span>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between px-1">
                                        <label className="text-xs font-medium text-zinc-500">Subtitle / Promo Text</label>
                                        <span className={`text-[10px] ${data.promoText.length > 170 ? 'text-red-500' : 'text-zinc-300'}`}>{data.promoText.length}/170</span>
                                    </div>
                                    <input value={data.promoText} onChange={e=>setData({...data, promoText: e.target.value})} 
                                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:border-indigo-500 focus:ring-0 transition-all shadow-sm placeholder:text-zinc-300" />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between px-1">
                                        <label className="text-xs font-medium text-zinc-500">Keywords</label>
                                        <span className={`text-[10px] ${data.keywords.length > 100 ? 'text-red-500' : 'text-zinc-300'}`}>{data.keywords.length}/100</span>
                                    </div>
                                    <input value={data.keywords} onChange={e=>setData({...data, keywords: e.target.value})} 
                                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:border-indigo-500 focus:ring-0 transition-all shadow-sm placeholder:text-zinc-300" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-zinc-500 ml-1">Description</label>
                                    <textarea value={data.description} onChange={e=>setData({...data, description: e.target.value})} rows={8}
                                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 text-xs leading-relaxed focus:border-indigo-500 focus:ring-0 transition-all shadow-sm resize-none placeholder:text-zinc-300" />
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-zinc-100 w-full"></div>

                        {/* Section: Google Play */}
                        <section className="space-y-4 animate-slide-up" style={{animationDelay: '0.2s'}}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                                    <Play className="w-4 h-4 text-emerald-600"/> Google Play
                                </h3>
                                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-mono">Main Store Listing</span>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between px-1">
                                        <label className="text-xs font-medium text-zinc-500">Short Description</label>
                                        <span className={`text-[10px] ${data.shortDescription.length > 80 ? 'text-red-500' : 'text-zinc-300'}`}>{data.shortDescription.length}/80</span>
                                    </div>
                                    <input value={data.shortDescription} onChange={e=>setData({...data, shortDescription: e.target.value})} 
                                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:border-emerald-500 focus:ring-0 transition-all shadow-sm placeholder:text-zinc-300" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-zinc-500 ml-1">Full Description</label>
                                    <textarea value={data.fullDescription} onChange={e=>setData({...data, fullDescription: e.target.value})} rows={8}
                                        className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 text-xs leading-relaxed focus:border-emerald-500 focus:ring-0 transition-all shadow-sm resize-none placeholder:text-zinc-300" />
                                </div>
                            </div>
                        </section>
                        
                        <div className="h-20"></div> {/* Bottom Spacer */}
                    </div>
                </div>
                </>
            )}
        </div>

        <Dialog open={repoModalOpen} onOpenChange={setRepoModalOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Select Repository</DialogTitle>
                    <DialogDescription>Choose a GitHub repository to analyze.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto min-h-[300px] -mx-6 px-6">
                    {loadingRepos ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-3">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500"/>
                            <p className="text-sm text-zinc-500">Fetching repositories...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 py-2">
                            {repos.map((repo) => (
                                <div key={repo.id} onClick={() => handleSelectRepo(repo.full_name)}
                                    className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 hover:bg-zinc-50 hover:border-indigo-200 cursor-pointer transition-all group">
                                    <div className="flex items-center gap-3">
                                        {repo.private ? <Lock className="w-4 h-4 text-zinc-400"/> : <BookOpen className="w-4 h-4 text-zinc-400"/>}
                                        <div>
                                            <div className="text-sm font-medium text-zinc-900 group-hover:text-indigo-600">{repo.full_name}</div>
                                            {repo.description && <div className="text-xs text-zinc-500 truncate max-w-md">{repo.description}</div>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-zinc-400">
                                        <Star className="w-3 h-3"/> {repo.stargazers_count}
                                    </div>
                                </div>
                            ))}
                            {repos.length === 0 && (
                                <div className="text-center py-10 text-zinc-500 text-sm">No repositories found.</div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}
