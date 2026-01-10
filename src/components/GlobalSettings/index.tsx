import React, { useState, useEffect } from 'react';
import styles from './style.module.scss';
import { getGeminiConfig, saveGeminiConfig, type GeminiConfig } from '../../lib/config';

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
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button className={styles.triggerBtn} onClick={() => setIsAiOpen(true)} title="Global AI Settings">
        ⚙️ AI Config
      </button>
      <button className={styles.triggerBtn} onClick={() => setIsGithubOpen(true)} title="GitHub Settings">
        📦 GitHub Config
      </button>

      {/* AI Settings Modal */}
      {isAiOpen && (
        <div className={styles.overlay} onClick={(e) => { if(e.target === e.currentTarget) setIsAiOpen(false); }}>
          <div className={styles.modal}>
            <div className={styles.header}>
                <h2>Global AI Configuration</h2>
                <button className={styles.closeBtn} onClick={() => setIsAiOpen(false)}>×</button>
            </div>
            
            <p className={styles.desc}>Configure your Gemini / OpenAI compatible API endpoints here.</p>

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
                <button onClick={() => save('ai')} className={styles.saveBtn}>Save Settings</button>
                <button onClick={testConnection} className={styles.testBtn} disabled={status === 'testing'}>
                    {status === 'testing' ? 'Testing...' : 'Test Connection'}
                </button>
            </div>
            {msg && <div className={`${styles.status} ${styles[status]}`}>{msg}</div>}
          </div>
        </div>
      )}

      {/* GitHub Settings Modal */}
      {isGithubOpen && (
        <div className={styles.overlay} onClick={(e) => { if(e.target === e.currentTarget) setIsGithubOpen(false); }}>
          <div className={styles.modal}>
            <div className={styles.header}>
                <h2>GitHub Configuration</h2>
                <button className={styles.closeBtn} onClick={() => setIsGithubOpen(false)}>×</button>
            </div>
            
            <p className={styles.desc}>Configure access to private repositories. <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" style={{color: 'var(--accent-highlight)'}}>Generate a Token</a></p>

            <div className={styles.grid}>
                <div className={styles.field}>
                    <label>Personal Access Token (Classic)</label>
                    <input name="githubToken" type="password" value={config.githubToken || ''} onChange={handleChange} placeholder="ghp_..." />
                    <span style={{fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.2rem'}}>Requires 'repo' scope for private repositories.</span>
                </div>
            </div>
            
            <div className={styles.actions}>
                <button onClick={() => save('github')} className={styles.saveBtn}>Save GitHub Token</button>
            </div>
            {msg && <div className={`${styles.status} success`}>{msg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
