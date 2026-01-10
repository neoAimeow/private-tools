import React, { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { ArrowRight, Copy, Check, RotateCcw, Type, Settings2, Sparkles, Pilcrow } from 'lucide-react';

export default function TextReflower() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [options, setOptions] = useState({
    mergeLines: true,
    cleanSpaces: true,
    smartSpacing: true,
    fixPunctuation: false,
    splitCamelCase: false
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => { processText(); }, [input, options]);

  const processText = () => {
    if (!input) { setOutput(''); return; }
    let text = input;
    // 1.5 Fix Sticky Punctuation
    text = text.replace(/([a-z0-9])([\.?!])([A-Z])/g, '$1$2 $3');
    // 1.6 Fix CamelCase
    if (options.splitCamelCase) text = text.replace(/([a-z])([A-Z])/g, '$1 $2');
    // 1. Merge Lines
    if (options.mergeLines) {
      text = text.replace(/[ 	]+$/gm, '');
      text = text.replace(/\n\s*\n/g, '___PARAGRAPH___');
      text = text.replace(/^([ 	]*[•●▪\-*].*?)\n/gm, '$1___KEEP_NEWLINE___');
      text = text.replace(/(\w)-\n(\w)/g, '$1$2');
      text = text.replace(/(?<![。！？\.\!\?])\n/g, ' '); 
      text = text.replace(/___KEEP_NEWLINE___/g, '\n');
      text = text.replace(/___PARAGRAPH___/g, '\n\n');
      text = text.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
    }
    // 2. Clean Spaces
    if (options.cleanSpaces) {
      text = text.replace(/[ 	]+/g, ' ');
      text = text.replace(/^\s+|\s+$/gm, '');
    }
    // List Formatting
    text = text.replace(/([^\n])\s*([•●▪])/g, '$1\n$2 ');
    text = text.replace(/([:：])\s*([•●▪])/g, '$1\n$2');
    // 3. Smart Spacing
    if (options.smartSpacing) {
      text = text.replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2');
      text = text.replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
    }
    // 4. Punctuation
    if (options.fixPunctuation) {
      text = text.replace(/,/g, '，').replace(/\./g, '。').replace(/\?/g, '？').replace(/!/g, '！').replace(/:/g, '：').replace(/;/g, '；').replace(/\(/g, '（').replace(/\)/g, '）');
    }
    setOutput(text);
  };

  const copyToClipboard = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clear = () => { setInput(''); setOutput(''); };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] min-h-[700px] w-full gap-6 animate-slide-up">
      
      {/* Input Column */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 flex-1 flex flex-col overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <div className="h-10 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between px-4 shrink-0">
             <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Pilcrow className="w-3.5 h-3.5"/> Source Text</span>
             <span className="text-[10px] font-mono text-zinc-400">{input.length} chars</span>
          </div>
          <Textarea 
            className="flex-1 border-0 focus-visible:ring-0 resize-none p-4 text-sm leading-relaxed text-zinc-700 placeholder:text-zinc-300"
            placeholder="Paste text from PDF or messy sources..."
            value={input} onChange={(e) => setInput(e.target.value)}
          />
        </div>
      </div>

      {/* Control Panel (Middle) */}
      <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
         <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-1">
            <Button onClick={copyToClipboard} disabled={!output} className={`w-full h-10 rounded-lg font-medium transition-all ${copied ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'} text-white shadow-sm`}>
               {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
               {copied ? 'Copied!' : 'Copy Result'}
            </Button>
            <div className="h-2"></div>
            <Button onClick={clear} variant="ghost" className="w-full h-9 text-zinc-500 hover:text-red-500 hover:bg-red-50">
               <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
         </div>

         <div className="bg-white rounded-xl shadow-sm border border-zinc-200 flex-1 flex flex-col overflow-hidden">
            <div className="h-10 bg-zinc-50 border-b border-zinc-100 flex items-center px-4 shrink-0">
               <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Settings2 className="w-3.5 h-3.5"/> Processing</span>
            </div>
            <div className="p-4 space-y-4">
               {[ 
                 {id: 'mergeLines', label: 'Merge Lines', sub: 'Fix PDF breaks'},
                 {id: 'smartSpacing', label: 'Smart Spacing', sub: 'En-Cn spaces'},
                 {id: 'cleanSpaces', label: 'Clean Whitespace', sub: 'Trim tabs/spaces'},
                 {id: 'splitCamelCase', label: 'Split CamelCase', sub: 'Fix "joinedWords"'},
                 {id: 'fixPunctuation', label: 'Fix Punctuation', sub: '.,? -> 。，？'},
               ].map(opt => (
                 <label key={opt.id} className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input type="checkbox" checked={options[opt.id as keyof typeof options]} 
                        onChange={e => setOptions({...options, [opt.id]: e.target.checked})}
                        className="peer h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500/20 transition-all" />
                    </div>
                    <div>
                       <div className="text-sm font-medium text-zinc-700 peer-checked:text-indigo-700 transition-colors">{opt.label}</div>
                       <div className="text-[10px] text-zinc-400">{opt.sub}</div>
                    </div>
                 </label>
               ))}
            </div>
         </div>
      </div>

      {/* Output Column */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 flex-1 flex flex-col overflow-hidden">
          <div className="h-10 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between px-4 shrink-0">
             <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-indigo-500"/> Clean Output</span>
             <span className="text-[10px] font-mono text-zinc-400">{output.length} chars</span>
          </div>
          <Textarea 
            readOnly
            className="flex-1 border-0 focus-visible:ring-0 resize-none p-4 text-sm leading-relaxed text-zinc-700 bg-zinc-50/20"
            placeholder="Result will appear here..."
            value={output}
          />
        </div>
      </div>

    </div>
  );
}