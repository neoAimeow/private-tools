import React, { useState, useEffect } from 'react';
import styles from './style.module.scss';

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
    // "word.Word" -> "word. Word"
    text = text.replace(/([a-z0-9])([\.?!])([A-Z])/g, '$1$2 $3');
    
    // 1.6 Fix CamelCase Sticky Words (Optional)
    // "controlsWhether" -> "controls Whether"
    // This is optional because it breaks legitimate brands like "iPhone", "eBay", "JavaScript"
    if (options.splitCamelCase) {
      text = text.replace(/([a-z])([A-Z])/g, '$1 $2');
    }

    // 1. Merge Lines (Sophisticated Logic)
    if (options.mergeLines) {
      // Step A: Preserve double newlines (paragraphs)
      text = text.replace(/\n\s*\n/g, '___PARAGRAPH___');

      // Step A.5: PROTECT BULLET POINTS
      // If a line starts with a bullet (•, -, *), its newline should likely NOT be merged.
      // We assume bullet items are self-contained lines or at least shouldn't be merged into the next start-of-line.
      // Regex: Start of line -> optional space -> bullet -> content -> Newline
      // We replace the Newline with a special marker that won't be eaten by Step B.
      text = text.replace(/^([ \t]*[•●▪\-*].*?)\n/gm, '$1___HARD_BREAK___\n');
      
      // Step B: Replace single newlines
      // Handle hyphens: "multi-\nline" -> "multi-line"
      text = text.replace(/(\w)-\n(\w)/g, '$1$2');
      // Handle normal breaks: "word\nword" -> "word word"
      // Note: We use lookbehind to ensure we don't eat our protected break (though simple regex wouldn't match ___HARD_BREAK___ as punctuation)
      // Actually, our regex only ignores if prev char is punctuation. ___HARD_BREAK___ ends with _, which is \w.
      // So we need to be careful. The previous line now ends with ___HARD_BREAK___.
      // Let's just exclude lines ending with ___HARD_BREAK___ from merging.
      
      // Simplified: Just match newlines that are NOT preceded by ___HARD_BREAK___
      // JS Regex lookbehind for negative match
      text = text.replace(/(?<![。！？\.\!\?]|___HARD_BREAK___)\n/g, ' '); 
      
      // Step B.5: Restore protected bullet breaks
      text = text.replace(/___HARD_BREAK___/g, '');

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
          <label title="Splits joined words like 'controlsWhether' -> 'controls Whether'. Warning: Breaks 'iPhone' -> 'i Phone'">
            <input 
              type="checkbox" 
              checked={options.splitCamelCase} 
              onChange={e => setOptions({...options, splitCamelCase: e.target.checked})}
            />
            Split Joined Words (CamelCase)
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
