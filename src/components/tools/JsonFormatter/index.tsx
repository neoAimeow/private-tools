import React, { useState } from 'react';
import styles from './style.module.scss';

export default function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className={styles.container}>
      <div className={styles.pane}>
        <header>Input JSON</header>
        <textarea 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          placeholder='{"key": "value"}'
        />
      </div>

      <div className={styles.controls}>
        <button onClick={format}>Format &rarr;</button>
        <button onClick={minify}>Minify &rarr;</button>
        <button className={styles.clear} onClick={() => { setInput(''); setOutput(''); setError(null); }}>Clear</button>
      </div>

      <div className={styles.pane}>
        <header>Output</header>
        <textarea 
          readOnly 
          value={error ? `Error: ${error}` : output} 
          style={{ borderColor: error ? '#dc3545' : 'inherit', color: error ? '#ff6b6b' : 'inherit' }}
        />
      </div>
    </div>
  );
}