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

    // 1. Merge Lines (Sophisticated Logic)
    // If a line doesn't end with a period/question mark/exclamation, merge it with next.
    if (options.mergeLines) {
      // Logic: Replace newline with space if prev line doesn't end with punctuation
      // AND next line doesn't look like a new paragraph (indentation or empty line)
      
      // Step A: Preserve double newlines (paragraphs)
      text = text.replace(/\n\s*\n/g, '___PARAGRAPH___');
      
      // Step B: Replace single newlines with space, handling hyphens
      // "multi-\nline" -> "multi-line"
      text = text.replace(/(\w)-\n(\w)/g, '$1$2');
      // "word\nword" -> "word word" (English) or "字\n字" -> "字字" (Chinese)
      text = text.replace(/(?<![。！？\.\!\?])\n/g, ' '); 
      
      // Step C: Restore paragraphs
      text = text.replace(/___PARAGRAPH___/g, '\n\n');
      
      // Step D: Chinese character merge (remove space between Chinese chars)
      text = text.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
    }

    // 2. Clean Spaces
    if (options.cleanSpaces) {
      // Multiple spaces -> single space
      text = text.replace(/[ \t]+/g, ' ');
      // Remove spaces at start/end of lines
      text = text.replace(/^\s+|\s+$/gm, '');
    }

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
