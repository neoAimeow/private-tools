import React, { useState, useEffect, useRef } from 'react';
import { db, storage, auth } from '../../../lib/firebase';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, getDoc, where } from 'firebase/firestore';
import { ref, getDownloadURL, uploadString } from 'firebase/storage';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getGeminiConfig } from '../../../lib/config';

// UI Components - Using standard HTML/Tailwind for cleaner custom layout
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Save, Plus, Search, Smartphone, Apple, Play, Github, Globe, ExternalLink, ChevronRight, LayoutTemplate } from 'lucide-react';

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
  
  // Auth & Data Loading (Same logic as before, cleaner implementation)
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
        const prompt = `You are an expert ASO Copywriter. Analyze this project: ${JSON.stringify(ctx).slice(0, 5000)}. 
        Generate JSON for Apple/Google stores. App Name: ${data.name}. 
        Return strictly JSON: { "promoText": "...", "description": "...", "keywords": "...", "shortDescription": "...", "fullDescription": "..." }`;
        
        let baseUrl = config.baseUrl.replace(/\/$/, '');
        if (!baseUrl.includes('/v1') && !baseUrl.includes('googleapis.com')) baseUrl += '/v1beta';

        const res = await fetch(`${baseUrl}/models/${config.textModel}:generateContent?key=${config.textApiKey}`, {
             method: 'POST', headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response");
        
        const genData = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
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
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-zinc-50/80 backdrop-blur z-10">
                <span className="font-semibold text-zinc-500 text-xs uppercase tracking-wider">Projects</span>
                <button onClick={handleCreate} className="p-1 hover:bg-zinc-200 rounded text-zinc-600 transition-colors"><Plus className="w-4 h-4"/></button>
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
                                    <div className="relative">
                                        <Github className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400"/>
                                        <input value={data.localPath} onChange={e=>setData({...data, localPath: e.target.value})} 
                                            className="w-full bg-zinc-50 border-0 rounded-lg pl-9 pr-3 py-2 text-zinc-700 font-mono text-xs focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-300" placeholder="username/repo"/>
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
    </div>
  );
}
