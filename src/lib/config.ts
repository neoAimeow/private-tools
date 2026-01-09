export interface GeminiConfig {
  baseUrl: string;
  textApiKey: string;
  imageApiKey: string;
  textModel: string;
  imageModel: string;
}

export const DEFAULT_GEMINI_CONFIG: GeminiConfig = {
  baseUrl: 'http://127.0.0.1:8045/v1beta',
  textApiKey: '',
  imageApiKey: '',
  textModel: 'gemini-2.0-flash',
  imageModel: 'imagen-3.0-generate-002', // Or appropriate model
};

export const STORAGE_KEY = 'solvin_tools_gemini_config';

export function getGeminiConfig(): GeminiConfig {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_CONFIG;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? { ...DEFAULT_GEMINI_CONFIG, ...JSON.parse(stored) } : DEFAULT_GEMINI_CONFIG;
}

export function saveGeminiConfig(config: GeminiConfig) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}
