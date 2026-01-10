import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { ArrowRight, Trash2, FileJson, Minimize2, Copy, Check } from 'lucide-react';

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
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px] w-full max-w-[1400px] mx-auto p-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Input Pane */}
      <Card className="flex-1 flex flex-col shadow-md border-border/60 overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="py-3 px-4 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <FileJson className="w-4 h-4 text-primary" />
            Input JSON
          </CardTitle>
          <div className="text-[10px] font-mono text-muted-foreground">
            {input.length} chars
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 relative">
          <Textarea 
            className="w-full h-full min-h-full resize-none border-0 focus-visible:ring-0 rounded-none p-4 font-mono text-sm leading-relaxed bg-transparent"
            placeholder='Paste your JSON here... {"key": "value"}'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-row md:flex-col justify-center gap-3 shrink-0 py-2">
        <Button onClick={format} variant="default" className="shadow-sm w-full md:w-auto" title="Format JSON">
          <span className="hidden md:inline mr-2">Format</span> <ArrowRight className="w-4 h-4" />
        </Button>
        <Button onClick={minify} variant="secondary" className="shadow-sm w-full md:w-auto" title="Minify JSON">
           <span className="hidden md:inline mr-2">Minify</span> <Minimize2 className="w-4 h-4" />
        </Button>
        <div className="h-px w-full bg-border/60 hidden md:block my-2" />
        <Button onClick={clear} variant="ghost" size="icon" className="shadow-sm hover:bg-destructive/10 hover:text-destructive transition-colors md:w-10 md:h-10 w-full" title="Clear All">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Output Pane */}
      <Card className="flex-1 flex flex-col shadow-md border-border/60 overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="py-3 px-4 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Output
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-2 text-xs"
            onClick={copyToClipboard}
            disabled={!output}
          >
            {copied ? (
                <>
                    <Check className="w-3 h-3 mr-1 text-green-500" /> Copied
                </>
            ) : (
                <>
                    <Copy className="w-3 h-3 mr-1" /> Copy
                </>
            )}
          </Button>
        </CardHeader>
        <CardContent className={`flex-1 p-0 relative ${error ? 'bg-destructive/5' : 'bg-muted/5'}`}>
          <Textarea 
            readOnly
            className={`w-full h-full min-h-full resize-none border-0 focus-visible:ring-0 rounded-none p-4 font-mono text-sm leading-relaxed bg-transparent ${
              error ? 'text-destructive' : 'text-foreground'
            }`}
            value={error ? `Error: ${error}` : output}
            placeholder="Result will appear here..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
