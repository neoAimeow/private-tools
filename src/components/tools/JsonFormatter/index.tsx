import React, { useState } from 'react';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { ArrowRight, Trash2, FileJson, Minimize2, Copy, Check, Braces, AlignLeft } from 'lucide-react';

export default function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const format = () => {
    try {
      if (!input.trim()) return;
      const obj = JSON.parse(input);
      setOutput(JSON.stringify(obj, null, 2));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const minify = () => {
    try {
      if (!input.trim()) return;
      const obj = JSON.parse(input);
      setOutput(JSON.stringify(obj));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const clear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  const copyToClipboard = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] min-h-[600px] w-full gap-4 md:gap-6 animate-slide-up">
      
      {/* Input Pane */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden group focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
        <div className="h-10 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <AlignLeft className="w-3.5 h-3.5" /> Input
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-mono text-zinc-400">{input.length} chars</span>
             <button onClick={clear} className="p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-red-500 transition-colors" title="Clear All">
                <Trash2 className="w-3.5 h-3.5" />
             </button>
          </div>
        </div>
        <div className="flex-1 relative bg-white">
          <Textarea 
            className="absolute inset-0 w-full h-full resize-none border-0 focus-visible:ring-0 p-4 font-mono text-sm leading-relaxed text-zinc-700 placeholder:text-zinc-300"
            placeholder='Paste JSON here... {"key": "value"}'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Actions Toolbar (Vertical on Desktop) */}
      <div className="flex flex-row md:flex-col justify-center gap-2 shrink-0">
        <Button onClick={format} className="shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white h-10 md:w-12 md:h-12 rounded-xl" title="Format">
          <Braces className="w-5 h-5" />
        </Button>
        <Button onClick={minify} variant="secondary" className="shadow-sm bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 h-10 md:w-12 md:h-12 rounded-xl" title="Minify">
           <Minimize2 className="w-5 h-5" />
        </Button>
      </div>

      {/* Output Pane */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden relative group">
        <div className="h-10 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <FileJson className="w-3.5 h-3.5" /> Output
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-7 px-2 text-xs gap-1.5 ${copied ? 'text-emerald-600 bg-emerald-50' : 'text-zinc-500 hover:text-zinc-900'}`}
            onClick={copyToClipboard}
            disabled={!output}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <div className={`flex-1 relative ${error ? 'bg-red-50/50' : 'bg-zinc-50/30'}`}>
          <Textarea 
            readOnly
            className={`absolute inset-0 w-full h-full resize-none border-0 focus-visible:ring-0 p-4 font-mono text-sm leading-relaxed ${
              error ? 'text-red-600' : 'text-zinc-700'
            }`}
            value={error ? `Error: ${error}` : output}
            placeholder="Result..."
          />
        </div>
      </div>
    </div>
  );
}