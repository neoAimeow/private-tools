import React, { useState, useEffect } from 'react';
import { getGeminiConfig, saveGeminiConfig, type GeminiConfig } from '../../lib/config';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Github, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function GlobalSettings() {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isGithubOpen, setIsGithubOpen] = useState(false);
  
  const [config, setConfig] = useState<GeminiConfig>({
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta', textApiKey: '', imageApiKey: '', textModel: 'gemini-2.0-flash', imageModel: 'imagen-3.0-generate-002', githubToken: ''
  });
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  // Load config on mount or open
  const loadConfig = () => {
      setConfig(getGeminiConfig());
      setMsg('');
      setStatus('idle');
  };

  useEffect(() => {
    if (isAiOpen || isGithubOpen) {
        loadConfig();
    }
  }, [isAiOpen, isGithubOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const save = (modal: 'ai' | 'github') => {
    saveGeminiConfig(config);
    setMsg('Settings saved.');
    setTimeout(() => {
        setMsg('');
        if (modal === 'ai') setIsAiOpen(false);
        if (modal === 'github') setIsGithubOpen(false);
    }, 1000);
  };

  const testConnection = async () => {
    setStatus('testing');
    try {
        if (!config.textApiKey) throw new Error("Text API Key missing");
        
        let baseUrl = config.baseUrl.replace(/\/$/, '');
        if (!baseUrl.includes('/v1') && !baseUrl.includes('googleapis.com')) {
             baseUrl += '/v1beta';
        }

        const url = `${baseUrl}/models/${config.textModel}:streamGenerateContent?alt=sse`; 
        
        console.log('Testing connection to:', url);

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
                contents: [{ role: "user", parts: [{ text: "hi" }] }]
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        setStatus('success');
        setMsg('Connection Successful!');
    } catch (e) {
        setStatus('error');
        setMsg((e as Error).message);
    }
  };

  return (
    <div className="flex gap-2">
      <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
        <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" /> AI Config
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>AI Configuration</DialogTitle>
            <DialogDescription>
              Configure your Gemini / OpenAI compatible API endpoints here.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input id="baseUrl" name="baseUrl" value={config.baseUrl} onChange={handleChange} placeholder="https://generativelanguage.googleapis.com/v1beta" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="textModel">Text Model Name</Label>
              <Input id="textModel" name="textModel" value={config.textModel} onChange={handleChange} placeholder="gemini-2.0-flash" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="textApiKey">Text API Key</Label>
              <Input id="textApiKey" name="textApiKey" type="password" value={config.textApiKey} onChange={handleChange} placeholder="AIza..." />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="imageModel">Image Model Name</Label>
              <Input id="imageModel" name="imageModel" value={config.imageModel} onChange={handleChange} placeholder="imagen-3.0-generate-002" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="imageApiKey">Image API Key</Label>
              <Input id="imageApiKey" name="imageApiKey" type="password" value={config.imageApiKey} onChange={handleChange} placeholder="AIza... (Optional)" />
            </div>
          </div>
          
          {msg && (
            <div className={`flex items-center gap-2 text-sm p-2 rounded ${status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-green-50 text-green-600'}`}>
                {status === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
                {status === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {status === 'error' && <AlertCircle className="h-4 w-4" />}
                {msg}
            </div>
          )}

          <DialogFooter className="flex-col sm:justify-between sm:flex-row gap-2">
            <Button variant="secondary" onClick={testConnection} disabled={status === 'testing'}>
                Test Connection
            </Button>
            <Button onClick={() => save('ai')}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGithubOpen} onOpenChange={setIsGithubOpen}>
        <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
                <Github className="h-4 w-4" /> GitHub
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>GitHub Configuration</DialogTitle>
            <DialogDescription>
              Configure access to private repositories. <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-primary hover:underline">Generate a Token</a>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
                <Label htmlFor="githubToken">Personal Access Token (Classic)</Label>
                <Input id="githubToken" name="githubToken" type="password" value={config.githubToken || ''} onChange={handleChange} placeholder="ghp_..." />
                <p className="text-[0.8rem] text-muted-foreground">Requires 'repo' scope for private repositories.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => save('github')}>Save Token</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
