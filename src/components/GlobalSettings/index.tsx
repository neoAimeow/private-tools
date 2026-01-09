import React, { useState, useEffect } from 'react';
import styles from './style.module.scss';
import { getGeminiConfig, saveGeminiConfig, type GeminiConfig } from '../../lib/config';

export default function GlobalSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<GeminiConfig>({
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta', textApiKey: '', imageApiKey: '', textModel: 'gemini-2.0-flash', imageModel: 'imagen-3.0-generate-002'
  });
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
        setConfig(getGeminiConfig());
        setMsg('');
        setStatus('idle');
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const save = () => {
    saveGeminiConfig(config);
    setMsg('Settings saved globally.');
    setTimeout(() => {
        setMsg('');
        setIsOpen(false);
    }, 1500);
  };

  const testConnection = async () => {
    setStatus('testing');
    try {
        if (!config.textApiKey) throw new Error("Text API Key missing");
        
        // Ensure no trailing slash
        let baseUrl = config.baseUrl.replace(/\/$/, '');
        if (!baseUrl.includes('/v1') && !baseUrl.includes('googleapis.com')) {
             baseUrl += '/v1beta';
        }

        // Exact match to user's working curl
        const url = `${baseUrl}/models/${config.textModel}:streamGenerateContent?alt=sse`; 
        
        console.log('Testing connection to:', url);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': config.textApiKey,
                // Emulate headers from curl
                'Accept': '*/*',
                'x-title': 'Cherry Studio', // Some proxies require specific headers
                'http-referer': 'https://cherry-ai.com' // Some proxies check referer
            },
            body: JSON.stringify({
                generationConfig: {},
                contents: [{ role: "user", parts: [{ text: "hi" }] }],
                systemInstruction: { parts: [{ text: "test" }] }
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        // Note: Response is SSE stream, but for "Test Connection" we just care if it connects ok (200 OK)
        // We won't fully parse the SSE here to keep it simple, getting a 200 OK stream start is success.
        
        setStatus('success');
        setMsg('Connection Successful!');
    } catch (e) {
        setStatus('error');
        setMsg((e as Error).message);
    }
  };

  return (
    <>
      <button className={styles.triggerBtn} onClick={() => setIsOpen(true)} title="Global AI Settings">
        ⚙️ AI Config
      </button>

      {isOpen && (
        <div className={styles.overlay} onClick={(e) => { if(e.target === e.currentTarget) setIsOpen(false); }}>
          <div className={styles.modal}>
            <div className={styles.header}>
                <h2>Global AI Configuration</h2>
                <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>×</button>
            </div>
            
            <p className={styles.desc}>These settings are stored locally and shared across all tools (App Generator, Chat, etc).</p>

            <div className={styles.grid}>
                <div className={styles.field}>
                    <label>Base URL</label>
                    <input name="baseUrl" value={config.baseUrl} onChange={handleChange} placeholder="https://generativelanguage.googleapis.com/v1beta" />
                </div>
                <div className={styles.field}>
                    <label>Text Model Name</label>
                    <input name="textModel" value={config.textModel} onChange={handleChange} placeholder="gemini-2.0-flash" />
                </div>
                <div className={styles.field}>
                    <label>Text API Key</label>
                    <input name="textApiKey" type="password" value={config.textApiKey} onChange={handleChange} placeholder="AIza..." />
                </div>
                <div className={styles.field}>
                    <label>Image Model Name</label>
                    <input name="imageModel" value={config.imageModel} onChange={handleChange} placeholder="imagen-3.0-generate-002" />
                </div>
                <div className={styles.field}>
                    <label>Image API Key</label>
                    <input name="imageApiKey" type="password" value={config.imageApiKey} onChange={handleChange} placeholder="AIza... (Optional)" />
                </div>
            </div>
            
            <div className={styles.actions}>
                <button onClick={save} className={styles.saveBtn}>Save Settings</button>
                <button onClick={testConnection} className={styles.testBtn} disabled={status === 'testing'}>
                    {status === 'testing' ? 'Testing...' : 'Test Connection'}
                </button>
            </div>
            {msg && <div className={`${styles.status} ${styles[status]}`}>{msg}</div>}
          </div>
        </div>
      )}
    </>
  );
}
