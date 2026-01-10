import React, { useState, useEffect, useRef } from 'react';
import { db, storage, auth } from '../../../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getGeminiConfig } from '../../../lib/config';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, Lightbulb, Image as ImageIcon, Sparkles, Trash2, Save, MessageSquare, Wand2, Download, Copy } from "lucide-react";

// Types
interface IdeaProject {
  id?: string;
  ownerId: string;
  name: string;
  projectType: 'software' | 'game' | 'other';
  platform: string;
  category: string;
  description: string; // The core "context"
  targetAudience: string;
  features: string[]; // Key functional requirements / gameplay elements
  generatedContent: Array<{
    id: string;
    type: 'text' | 'image' | 'feature_list';
    prompt: string;
    result: string; // Text content, Image URL, or JSON string for feature list
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const INITIAL_PROJECT: IdeaProject = {
    ownerId: '', name: 'New Idea', projectType: 'software', platform: 'Web', category: '',
    description: '', targetAudience: '', features: [],
    generatedContent: [], createdAt: '', updatedAt: ''
};

export default function IdeaFactory() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [projects, setProjects] = useState<IdeaProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<IdeaProject>(INITIAL_PROJECT);
  
  const [createWizardOpen, setCreateWizardOpen] = useState(false);
  const [wizardData, setWizardData] = useState<{
      projectType: string;
      platforms: string[];
      category: string;
      name: string;
  }>({ projectType: 'software', platforms: [], category: '', name: '' });
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'brainstorm' | 'assets'>('brainstorm');
  const [promptInput, setPromptInput] = useState('');
  
  // Real-time sync setup
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) { setProjects([]); return; }
    const q = query(collection(db, "project-ideas"), where("ownerId", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as IdeaProject));
        list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        setProjects(list);
    });
    return () => unsub();
  }, [user]);

  // Sync selected project data
  useEffect(() => {
    if (selectedId) {
        const found = projects.find(p => p.id === selectedId);
        if (found) setData(found);
    }
  }, [selectedId, projects]);

  const handleCreate = () => {
      setWizardData({ projectType: 'software', platforms: [], category: '', name: '' });
      setCreateWizardOpen(true);
  };

  const handleFinishCreate = async () => {
      if (!user) return;
      setLoading(true);
      try {
          const now = new Date().toISOString();
          const platformStr = wizardData.platforms.length > 0 ? wizardData.platforms.join(', ') : 'General';
          
          const newDoc = {
              ...INITIAL_PROJECT,
              ownerId: user.uid,
              name: wizardData.name || `Untitled ${wizardData.projectType} Project`,
              projectType: wizardData.projectType as any,
              platform: platformStr,
              category: wizardData.category,
              createdAt: now,
              updatedAt: now
          };
          const ref = await addDoc(collection(db, "project-ideas"), newDoc);
          setCreateWizardOpen(false);
          setSelectedId(ref.id);
      } catch (e) { toast.error("Failed to create project"); } 
      finally { setLoading(false); }
  };

  const handleDelete = async () => {
      if (!selectedId) return;
      setLoading(true);
      try {
          await deleteDoc(doc(db, "project-ideas", selectedId));
          setSelectedId(null);
          setData(INITIAL_PROJECT);
          setDeleteDialogOpen(false);
          toast.success("Deleted");
      } catch(e) { 
          toast.error("Delete failed"); 
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleSave = async () => {
      if (!selectedId) return;
      try {
          await updateDoc(doc(db, "project-ideas", selectedId), {
              ...data,
              updatedAt: new Date().toISOString()
          });
          toast.success("Saved");
      } catch (e) { toast.error("Save failed"); }
  };

  const handleSetDescription = async (desc: string) => {
      if (!selectedId) return;
      setData({...data, description: desc});
      await updateDoc(doc(db, "project-ideas", selectedId), { description: desc });
      toast.success("Project description updated");
  };

  const handleAddFeature = async (feature: string) => {
      if (!selectedId || data.features?.includes(feature)) return;
      const newFeatures = [...(data.features || []), feature];
      // Optimistic update
      setData({...data, features: newFeatures});
      await updateDoc(doc(db, "project-ideas", selectedId), { features: newFeatures });
      toast.success("Feature added to project");
  };
  
  const handleRemoveFeature = async (feature: string) => {
      if (!selectedId) return;
      const newFeatures = (data.features || []).filter(f => f !== feature);
      setData({...data, features: newFeatures});
      await updateDoc(doc(db, "project-ideas", selectedId), { features: newFeatures });
  };

  // Auto-save debounced
  useEffect(() => {
      if (!selectedId) return;
      const timer = setTimeout(() => {
          if (data.id === selectedId) {
             updateDoc(doc(db, "project-ideas", selectedId), { 
                 name: data.name, 
                 description: data.description, 
                 targetAudience: data.targetAudience 
             }).catch(console.error);
          }
      }, 2000);
      return () => clearTimeout(timer);
  }, [data.name, data.description, data.targetAudience]);

    // Generators
    const handleGenerateText = async (customPrompt?: string) => {
        if (!selectedId) return;
        setGenerating(true);
        const promptToUse = customPrompt || promptInput;
        if (!promptToUse) { toast.error("Enter a prompt"); setGenerating(false); return; }
  
        const isFeatureList = promptToUse.toLowerCase().includes("feature list") || promptToUse.toLowerCase().includes("gameplay mechanics");
        
        const config = getGeminiConfig();
        let systemContext = `Project Name: ${data.name}
  Type: ${data.projectType}
  Platform: ${data.platform}
  Category: ${data.category}
  Description: ${data.description}
  Target Audience: ${data.targetAudience}
  Current Features/Key Elements: ${(data.features || []).join(', ')}`;
  
        if (isFeatureList) {
            systemContext += `\n\nIMPORTANT: Return a valid JSON ARRAY of strings only. Do not wrap in markdown code blocks. Example: ["Login System", "Map Editor"]`;
        }
  
        // Create a temporary ID for the streaming content
        const tempId = Date.now().toString();
        const newContentItem = {
            id: tempId,
            type: 'text' as const, // Start as text, convert later if needed
            prompt: promptToUse,
            result: '',
            createdAt: new Date().toISOString()
        };
  
        // Optimistic update to show the empty card immediately
        setData(prev => ({
            ...prev,
            generatedContent: [newContentItem, ...(prev.generatedContent || [])]
        }));
        setPromptInput(''); // Clear input early
  
        try {
            const res = await fetch('/api/idea/generate-text', {
                method: 'POST',
                body: JSON.stringify({ prompt: promptToUse, systemContext, config })
            });
  
            if (!res.ok) throw new Error(await res.text());
            if (!res.body) throw new Error("No response body");
  
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';
  
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                accumulatedText += chunk;
  
                // Update state in real-time
                setData(prev => {
                    const updatedContent = prev.generatedContent.map(c => 
                        c.id === tempId ? { ...c, result: accumulatedText } : c
                    );
                    return { ...prev, generatedContent: updatedContent };
                });
            }
  
            // Final processing after stream ends
            let finalType: 'text' | 'feature_list' = 'text';
            let finalContent = accumulatedText;
  
            if (isFeatureList) {
                try {
                    const cleaned = accumulatedText.replace(/```json/g, '').replace(/```/g, '').trim();
                    // Try to find array bracket start/end if there's noise
                    const start = cleaned.indexOf('[');
                    const end = cleaned.lastIndexOf(']');
                    if (start !== -1 && end !== -1) {
                        const jsonPart = cleaned.substring(start, end + 1);
                        const parsed = JSON.parse(jsonPart);
                        if (Array.isArray(parsed)) {
                            finalType = 'feature_list';
                            finalContent = JSON.stringify(parsed);
                        }
                    }
                } catch (e) { console.log("Failed to parse final JSON"); }
            }
  
            // Update final state locally
            setData(prev => {
                 const updatedContent = prev.generatedContent.map(c => 
                    c.id === tempId ? { ...c, type: finalType, result: finalContent } : c
                );
                return { ...prev, generatedContent: updatedContent };
            });
  
            // Save to Firestore
            const currentList = projects.find(p => p.id === selectedId)?.generatedContent || [];
            const finalItem = { ...newContentItem, type: finalType, result: finalContent };
            await updateDoc(doc(db, "project-ideas", selectedId), { 
                generatedContent: [finalItem, ...currentList] 
            });
  
        } catch (e) { 
            toast.error((e as Error).message);
            // Remove the temp item on error
            setData(prev => ({
                ...prev,
                generatedContent: prev.generatedContent.filter(c => c.id !== tempId)
            }));
        } 
        finally { setGenerating(false); }
    };

  const handleGenerateImage = async () => {
      if (!selectedId) return;
      setGenerating(true);
      if (!promptInput) { toast.error("Describe the image"); setGenerating(false); return; }

      const config = getGeminiConfig();
      // Enrich prompt with context
      const fullPrompt = `${promptInput}. Context: ${data.name} - ${data.description}`;

      try {
          const res = await fetch('/api/idea/generate-image', {
              method: 'POST',
              body: JSON.stringify({ prompt: fullPrompt, config })
          });
          const json = await res.json();
          if (json.error) throw new Error(json.error);
          
          // Upload to Storage to persist
          const imageRef = ref(storage, `ideas/${user?.uid}/${selectedId}/${Date.now()}.png`);
          await uploadString(imageRef, json.image, 'data_url');
          const url = await getDownloadURL(imageRef);

          const newContent = {
              id: Date.now().toString(),
              type: 'image' as const,
              prompt: promptInput,
              result: url,
              createdAt: new Date().toISOString()
          };

          const updatedList = [newContent, ...(data.generatedContent || [])];
          await updateDoc(doc(db, "project-ideas", selectedId), { generatedContent: updatedList });
          setPromptInput('');

      } catch (e) { toast.error((e as Error).message); }
      finally { setGenerating(false); }
  };

  if (authLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-zinc-300"/></div>;
  if (!user) return <div className="p-8 text-center text-zinc-500">Please sign in to access Idea Factory.</div>;

  return (
    <div className="flex h-full w-full bg-white rounded-xl shadow-2xl border border-zinc-200/50 overflow-hidden font-sans">
        {/* SIDEBAR */}
        <div className="w-64 bg-zinc-50/50 border-r border-zinc-100 flex flex-col shrink-0">
             <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">My Ideas</span>
                <Button variant="ghost" size="icon" onClick={handleCreate} disabled={loading} className="h-7 w-7">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {projects.map(p => (
                    <div key={p.id} onClick={() => setSelectedId(p.id!)}
                        className={`group px-3 py-2.5 rounded-md flex items-center justify-between cursor-pointer transition-all ${selectedId === p.id ? 'bg-white shadow-sm ring-1 ring-zinc-200' : 'hover:bg-zinc-100/50 text-zinc-500'}`}
                    >
                        <div className="min-w-0">
                            <div className={`text-sm font-medium truncate ${selectedId === p.id ? 'text-zinc-900' : ''}`}>{p.name}</div>
                            <div className="text-[10px] text-zinc-400 truncate">{new Date(p.updatedAt).toLocaleDateString()}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* MAIN */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
            {!selectedId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-300 space-y-4">
                    <Lightbulb className="w-16 h-16 opacity-20"/>
                    <p>Select or create an idea to start brainstorming</p>
                </div>
            ) : (
                <>
                {/* Header/Context Area */}
                <div className="border-b border-zinc-100 p-6 bg-zinc-50/30 space-y-4">
                    <div className="flex items-center justify-between">
                         <div className="flex-1 mr-4">
                             <input 
                                value={data.name} 
                                onChange={(e) => setData({...data, name: e.target.value})}
                                className="bg-transparent text-xl font-bold text-zinc-900 border-none focus:ring-0 p-0 placeholder:text-zinc-300 w-full mb-2"
                                placeholder="Project Name..."
                             />
                             <div className="flex flex-wrap items-center gap-2">
                                 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 capitalize">
                                     {data.projectType}
                                 </span>
                                 <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-600">
                                     {data.platform}
                                 </span>
                                 {data.category && (
                                     <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                                         {data.category}
                                     </span>
                                 )}
                             </div>
                         </div>
                         <Button variant="ghost" size="icon" onClick={() => setDeleteDialogOpen(true)} className="text-zinc-400 hover:text-red-500">
                             <Trash2 className="w-4 h-4"/>
                         </Button>
                    </div>

                    {/* Saved Features / Blueprint */}
                    {(data.features && data.features.length > 0) && (
                        <div className="animate-fade-in">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Project DNA (Saved Features)</div>
                            <div className="flex flex-wrap gap-2">
                                {data.features.map(f => (
                                    <div key={f} className="group inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-zinc-200 rounded-full text-xs text-zinc-700 shadow-sm">
                                        <span>{f}</span>
                                        <button onClick={() => handleRemoveFeature(f)} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-opacity">
                                            <Trash2 className="w-3 h-3"/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex items-center border-b border-zinc-100 px-6">
                    <button 
                        onClick={() => setActiveTab('brainstorm')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'brainstorm' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                    >
                        <MessageSquare className="w-4 h-4"/> Brainstorming
                    </button>
                    <button 
                        onClick={() => setActiveTab('assets')}
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'assets' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
                    >
                        <ImageIcon className="w-4 h-4"/> Visual Assets
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/10">
                    
                    {/* Input Area */}
                    <div className="mb-8 max-w-3xl mx-auto space-y-4">
                        {/* ... (Input remains same) ... */}
                        <div className="flex gap-2">
                            <input 
                                value={promptInput}
                                onChange={(e) => setPromptInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (activeTab === 'brainstorm' ? handleGenerateText() : handleGenerateImage())}
                                className="flex-1 bg-white border border-zinc-200 rounded-full px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 shadow-sm"
                                placeholder={activeTab === 'brainstorm' ? "Ask for features, slogans, marketing angles..." : "Describe an image, logo, or icon..."}
                            />
                            <Button 
                                onClick={() => activeTab === 'brainstorm' ? handleGenerateText() : handleGenerateImage()} 
                                disabled={generating || !promptInput}
                                className="rounded-full px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"
                            >
                                {generating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                            </Button>
                        </div>
                        
                        {/* Quick Actions */}
                        {activeTab === 'brainstorm' && (
                            <div className="flex flex-wrap gap-2 justify-center">
                                {['Generate Feature List', 'Create Marketing Slogans', 'Identify Technical Stack', 'User Persona Analysis'].map(action => (
                                    <button 
                                        key={action}
                                        onClick={() => handleGenerateText(action)}
                                        disabled={generating}
                                        className="text-xs bg-white border border-zinc-200 px-3 py-1.5 rounded-full text-zinc-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                                    >
                                        {action}
                                    </button>
                                ))}
                            </div>
                        )}
                        {/* ... (Assets actions remain same) ... */}
                         {activeTab === 'assets' && (
                            <div className="flex flex-wrap gap-2 justify-center">
                                {['Minimalist App Icon', 'Modern Landing Page Banner', 'Abstract Logo Symbol', 'Social Media Promo'].map(action => (
                                    <button 
                                        key={action}
                                        onClick={() => { setPromptInput(action); }}
                                        className="text-xs bg-white border border-zinc-200 px-3 py-1.5 rounded-full text-zinc-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                                    >
                                        {action}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Results Stream */}
                    <div className="max-w-4xl mx-auto space-y-8 pb-10">
                        {(data.generatedContent || [])
                            .filter(c => c.type === (activeTab === 'brainstorm' ? 'text' : 'image') || (activeTab === 'brainstorm' && c.type === 'feature_list'))
                            .map((content) => (
                            <div key={content.id} className="group relative bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden animate-slide-up">
                                <div className="bg-zinc-50/50 px-4 py-2 border-b border-zinc-50 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{content.prompt}</span>
                                    <span className="text-[10px] text-zinc-300">{new Date(content.createdAt).toLocaleTimeString()}</span>
                                </div>
                                <div className="p-5">
                                    {content.type === 'text' ? (
                                        <div className="prose prose-sm prose-zinc max-w-none whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-600">
                                            {content.result}
                                        </div>
                                    ) : content.type === 'feature_list' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {JSON.parse(content.result).map((feature: string, idx: number) => {
                                                const isSaved = data.features?.includes(feature);
                                                return (
                                                    <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${isSaved ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-zinc-200 hover:border-zinc-300'}`}>
                                                        <div className="flex-1 text-sm text-zinc-700">{feature}</div>
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className={`h-6 w-6 shrink-0 ${isSaved ? 'text-indigo-600' : 'text-zinc-400 hover:text-indigo-600'}`}
                                                            onClick={() => isSaved ? handleRemoveFeature(feature) : handleAddFeature(feature)}
                                                        >
                                                            {isSaved ? <span className="font-bold">✓</span> : <Plus className="w-4 h-4"/>}
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex justify-center bg-zinc-50 rounded-lg p-2 border border-zinc-100">
                                            <img src={content.result} alt={content.prompt} className="max-h-96 object-contain rounded-md shadow-sm" />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    {content.type === 'text' && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6 bg-white border border-zinc-200 shadow-sm"
                                            onClick={() => {
                                                navigator.clipboard.writeText(content.result);
                                                toast.success("Copied!");
                                            }}
                                        >
                                            <Copy className="w-3 h-3 text-zinc-500"/>
                                        </Button>
                                    )}
                                    {content.type === 'image' && (
                                         <a href={content.result} download={`idea-asset-${content.id}.png`} target="_blank" rel="noopener noreferrer">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 bg-white border border-zinc-200 shadow-sm">
                                                <Download className="w-3 h-3 text-zinc-500"/>
                                            </Button>
                                         </a>
                                    )}
                                </div>
                            </div>
                        ))}
                         {data.generatedContent?.filter(c => c.type === (activeTab === 'brainstorm' ? 'text' : 'image')).length === 0 && (
                             <div className="text-center py-20 text-zinc-300">
                                 <Wand2 className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                                 <p>No generated content yet.</p>
                             </div>
                         )}
                    </div>

                </div>
                </>
            )}
        </div>

        {/* Create Wizard Dialog */}
        <Dialog open={createWizardOpen} onOpenChange={setCreateWizardOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Start New Project Idea</DialogTitle>
                    <DialogDescription>Define the core identity of your new project.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">Project Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['Software', 'Game'].map(type => (
                                <button key={type}
                                    onClick={() => setWizardData({...wizardData, projectType: type.toLowerCase()})}
                                    className={`px-3 py-2 text-sm rounded-md border text-center transition-all ${wizardData.projectType === type.toLowerCase() ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">Target Platforms (Multi-select)</label>
                        <div className="flex flex-wrap gap-2">
                            {['Web', 'iOS', 'Android', 'macOS', 'Windows', 'Linux', 'CLI'].map(p => {
                                const isSelected = wizardData.platforms.includes(p);
                                return (
                                    <button 
                                        key={p}
                                        onClick={() => {
                                            const newPlatforms = isSelected 
                                                ? wizardData.platforms.filter(x => x !== p)
                                                : [...wizardData.platforms, p];
                                            setWizardData({...wizardData, platforms: newPlatforms});
                                        }}
                                        className={`px-3 py-1.5 text-xs rounded-full border transition-all ${isSelected ? 'bg-zinc-800 border-zinc-800 text-white font-medium' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-500">Category / Genre (Optional)</label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                            {(wizardData.projectType === 'game' 
                                ? ['Action', 'Adventure', 'RPG', 'Puzzle', 'Strategy', 'Simulation', 'Arcade', 'Casual', 'Sports', 'Racing', 'Board', 'Card']
                                : ['Productivity', 'Utility', 'Social', 'Education', 'Health', 'Business', 'Finance', 'Lifestyle', 'Entertainment', 'DevTool', 'News', 'Photo & Video']
                            ).map(cat => (
                                <button 
                                    key={cat}
                                    onClick={() => setWizardData({...wizardData, category: wizardData.category === cat ? '' : cat})}
                                    className={`px-3 py-1.5 text-xs rounded-full border transition-all ${wizardData.category === cat ? 'bg-indigo-100 border-indigo-200 text-indigo-700 font-medium' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                         <label className="text-xs font-medium text-zinc-500">Project Name (Optional)</label>
                         <input 
                            value={wizardData.name}
                            onChange={(e) => setWizardData({...wizardData, name: e.target.value})}
                            placeholder="My Awesome Project"
                            className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-zinc-300"
                        />
                    </div>
                </div>
                <div className="flex justify-end pt-2">
                    <Button onClick={handleFinishCreate} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
                        Create Project
                    </Button>
                </div>
            </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Delete Project?</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete <span className="font-semibold text-zinc-900">{data.name}</span>? 
                        This cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={loading} className="bg-red-600 hover:bg-red-700">
                        {loading && <Loader2 className="w-3 h-3 mr-2 animate-spin"/>}
                        Delete
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}