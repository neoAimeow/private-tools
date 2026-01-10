import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { ArrowRight, Copy, Check, RotateCcw, Type, Settings2 } from 'lucide-react';

export default function TextReflower() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [options, setOptions] = useState({
    mergeLines: true,     // Merge broken lines (PDF style)
    cleanSpaces: true,    // Fix multiple spaces
    smartSpacing: true,   // Pangu (Chinese-English spacing)
    fixPunctuation: false, // Convert en punctuation to cn
    splitCamelCase: false  // Fix "controlsWhether" -> "controls Whether"
  });
  const [copied, setCopied] = useState(false);

  // Auto-process when input or options change
  useEffect(() => {
    processText();
  }, [input, options]);

  const processText = () => {
    if (!input) {
      setOutput('');
      return;
    }

    let text = input;

    // 1.5 Fix Sticky Punctuation (Always Safe)
    text = text.replace(/([a-z0-9])([\.?!])([A-Z])/g, '$1$2 $3');
    
    // 1.6 Fix CamelCase Sticky Words (Optional)
    if (options.splitCamelCase) {
      text = text.replace(/([a-z])([A-Z])/g, '$1 $2');
    }

    // 1. Merge Lines (Sophisticated Logic)
    if (options.mergeLines) {
      text = text.replace(/[ \t]+$/gm, '');
      text = text.replace(/\n\s*\n/g, '___PARAGRAPH___');
      text = text.replace(/^([ \t]*[•●▪\-*].*?)\n/gm, '$1___KEEP_NEWLINE___');
      text = text.replace(/(\w)-\n(\w)/g, '$1$2');
      text = text.replace(/(?<![。！？\.\!\?])\n/g, ' '); 
      text = text.replace(/___KEEP_NEWLINE___/g, '\n');
      text = text.replace(/___PARAGRAPH___/g, '\n\n');
      text = text.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
    }

    // 2. Clean Spaces
    if (options.cleanSpaces) {
      text = text.replace(/[ \t]+/g, ' ');
      text = text.replace(/^\s+|\s+$/gm, '');
    }

    // NEW: Format Lists (Bullet Points)
    text = text.replace(/([^\n])\s*([•●▪])/g, '$1\n$2 ');
    text = text.replace(/([:：])\s*([•●▪])/g, '$1\n$2');

    // 3. Smart Spacing (Pangu - simplified)
    if (options.smartSpacing) {
      text = text.replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2');
      text = text.replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
    }

    // 4. Fix Punctuation (Optional)
    if (options.fixPunctuation) {
      text = text.replace(/,/g, '，')
                 .replace(/\./g, '。')
                 .replace(/\?/g, '？')
                 .replace(/!/g, '！')
                 .replace(/:/g, '：')
                 .replace(/;/g, '；')
                 .replace(/\(/g, '（')
                 .replace(/\)/g, '）');
    }

    setOutput(text);
  };

  const copyToClipboard = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clear = () => {
    setInput('');
    setOutput('');
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-[calc(100vh-250px)] min-h-[700px] w-full max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Input Pane */}
      <Card className="flex-1 flex flex-col shadow-md border-border/60 order-1 overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="py-3 px-4 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Type className="w-4 h-4 text-primary" />
            Input Text
          </CardTitle>
          <span className="text-[10px] font-mono text-muted-foreground">{input.length} chars</span>
        </CardHeader>
        <CardContent className="flex-1 p-0 relative">
          <Textarea 
            className="w-full h-full min-h-full resize-none border-0 focus-visible:ring-0 rounded-none p-4 font-sans text-sm leading-relaxed bg-transparent"
            placeholder="Paste your text here (e.g. from a PDF)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Controls & Options */}
      <div className="flex flex-col gap-4 w-full xl:w-72 shrink-0 order-2 xl:order-2 h-full">
        <Card className="shadow-sm border-border/60 bg-card/50 backdrop-blur-sm">
           <CardHeader className="py-3 px-4 border-b border-border/40 bg-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-col gap-3">
             <Button 
              onClick={copyToClipboard} 
              disabled={!output} 
              className="w-full shadow-sm"
              variant={copied ? "default" : "default"}
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied' : 'Copy Result'}
            </Button>
            <Button 
              onClick={clear} 
              variant="outline" 
              className="w-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 shadow-sm"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60 flex-1 bg-card/50 backdrop-blur-sm">
          <CardHeader className="py-3 px-4 border-b border-border/40 bg-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Options
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-col gap-4">
            <div className="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="mergeLines" 
                className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary shadow-sm"
                checked={options.mergeLines}
                onChange={e => setOptions({...options, mergeLines: e.target.checked})}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="mergeLines" className="cursor-pointer font-medium leading-none">Merge Broken Lines</Label>
                <p className="text-[10px] text-muted-foreground leading-snug">Fixes line breaks from PDF copies.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="smartSpacing" 
                className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary shadow-sm"
                checked={options.smartSpacing}
                onChange={e => setOptions({...options, smartSpacing: e.target.checked})}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="smartSpacing" className="cursor-pointer font-medium leading-none">Smart Spacing</Label>
                <p className="text-[10px] text-muted-foreground leading-snug">Add space between EN and 中文.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="cleanSpaces" 
                className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary shadow-sm"
                checked={options.cleanSpaces}
                onChange={e => setOptions({...options, cleanSpaces: e.target.checked})}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="cleanSpaces" className="cursor-pointer font-medium leading-none">Clean Whitespace</Label>
                <p className="text-[10px] text-muted-foreground leading-snug">Remove extra tabs and spaces.</p>
              </div>
            </div>

             <div className="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="splitCamelCase" 
                className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary shadow-sm"
                checked={options.splitCamelCase}
                onChange={e => setOptions({...options, splitCamelCase: e.target.checked})}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="splitCamelCase" className="cursor-pointer font-medium leading-none">Split Joined Words</Label>
                <p className="text-[10px] text-muted-foreground leading-snug">Fix "controlsWhether" errors.</p>
              </div>
            </div>

             <div className="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="fixPunctuation" 
                className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary shadow-sm"
                checked={options.fixPunctuation}
                onChange={e => setOptions({...options, fixPunctuation: e.target.checked})}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="fixPunctuation" className="cursor-pointer font-medium leading-none">Fix Punctuation</Label>
                <p className="text-[10px] text-muted-foreground leading-snug">Convert symbols to full-width.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Output Pane */}
      <Card className="flex-1 flex flex-col shadow-md border-border/60 order-3 overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="py-3 px-4 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Reflowed Output
          </CardTitle>
          <span className="text-[10px] font-mono text-muted-foreground">{output.length} chars</span>
        </CardHeader>
        <CardContent className="flex-1 p-0 relative bg-muted/5">
          <Textarea 
            readOnly
            className="w-full h-full min-h-full resize-none border-0 focus-visible:ring-0 rounded-none p-4 font-sans text-sm leading-relaxed bg-transparent"
            placeholder="Clean text will appear here..."
            value={output}
          />
        </CardContent>
      </Card>
    </div>
  );
}