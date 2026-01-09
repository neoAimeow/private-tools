import React, { useState, useEffect } from 'react';
import styles from './style.module.scss';

export default function TextReflower() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [options, setOptions] = useState({
    mergeLines: true,     // Merge broken lines (PDF style)
    cleanSpaces: true,    // Fix multiple spaces
    smartSpacing: true,   // Pangu (Chinese-English spacing)
    fixPunctuation: false // Convert en punctuation to cn
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

    // 1.5 Fix Sticky Punctuation & CamelCase (Safe)
    // "word.Word" -> "word. Word"
    text = text.replace(/([a-z0-9])([\.?!])([A-Z])/g, '$1$2 $3');
    
    // Fix "controlsWhether" -> "controls Whether", but PROTECT brands like "NexBlock"
    // Strategy: Hide brands -> Split CamelCase -> Restore brands
    const brands = ['NexBlock', 'Nextris', 'YouTube', 'GitHub', 'PayPal', 'JavaScript', 'TypeScript', 'iPhone', 'iPad', 'Endless', 'Level'];
    // 1. Placeholder
    brands.forEach((brand, index) => {
      text = text.replace(new RegExp(brand, 'g'), `___BRAND_${index}___`);
    });
    // 2. Split CamelCase (lowercase followed by uppercase)
    text = text.replace(/([a-z])([A-Z])/g, '$1 $2');
    // 3. Restore
    brands.forEach((brand, index) => {
      text = text.replace(new RegExp(`___BRAND_${index}___`, 'g'), brand);
    });

    // 1. Merge Lines (Sophisticated Logic)
    if (options.mergeLines) {
      // Step A: Preserve double newlines (paragraphs)
      text = text.replace(/\n\s*\n/g, '___PARAGRAPH___');
      
      // Step B: Replace single newlines
      // Handle hyphens: "multi-\nline" -> "multi-line"
      text = text.replace(/(\w)-\n(\w)/g, '$1$2');
      // Handle normal breaks: "word\nword" -> "word word"
      text = text.replace(/(?<![。！？\.\!\?])\n/g, ' '); 
      
      // Step C: Restore paragraphs
      text = text.replace(/___PARAGRAPH___/g, '\n\n');
      
      // Step D: Chinese character merge
      text = text.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
    }

    // 2. Clean Spaces
    if (options.cleanSpaces) {
      text = text.replace(/[ \t]+/g, ' ');
      text = text.replace(/^\s+|\s+$/gm, '');
    }

    // NEW: Format Lists (Bullet Points)
    // Ensure bullets start on a new line
    // Matches: space + bullet + space
    text = text.replace(/([^\n])\s*([•●▪])/g, '$1\n$2 ');
    // Fix "Title: • Item" -> "Title:\n• Item"
    text = text.replace(/([:：])\s*([•●▪])/g, '$1\n$2');

    // 3. Smart Spacing (Pangu - simplified)
    if (options.smartSpacing) {
      // English-Chinese
      text = text.replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2');
      // Chinese-English
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

  return (
    <div className={styles.container}>
      <div className={styles.pane}>
        <header>
          <span>Input</span>
          <span className={styles.stats}>{input.length} chars</span>
        </header>
        <textarea 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste your messy text here..."
        />
      </div>

      <div className={styles.controls}>
        <button 
          onClick={copyToClipboard} 
          className={styles.primary}
          disabled={!output}
        >
          {copied ? '✓ Copied' : 'Copy Result'}
        </button>
        
        <button 
          className={styles.clear} 
          onClick={() => { setInput(''); setOutput(''); }}
        >
          Clear
        </button>

        <div className={styles.toggles}>
          <label>
            <input 
              type="checkbox" 
              checked={options.mergeLines} 
              onChange={e => setOptions({...options, mergeLines: e.target.checked})}
            />
            Merge Broken Lines
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={options.smartSpacing} 
              onChange={e => setOptions({...options, smartSpacing: e.target.checked})}
            />
            Smart Spacing (中 EN)
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={options.cleanSpaces} 
              onChange={e => setOptions({...options, cleanSpaces: e.target.checked})}
            />
            Clean Whitespace
          </label>
          <label>
            <input 
              type="checkbox" 
              checked={options.fixPunctuation} 
              onChange={e => setOptions({...options, fixPunctuation: e.target.checked})}
            />
            Fix Punctuation
          </label>
        </div>
      </div>

      <div className={styles.pane}>
        <header>
          <span>Reflowed Output</span>
          <span className={styles.stats}>{output.length} chars</span>
        </header>
        <textarea 
          readOnly 
          value={output} 
          placeholder="Clean text will appear here..."
        />
      </div>
    </div>
  );
}
