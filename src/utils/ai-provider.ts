import { aiSettings } from '../store';

/**
 * Common AI call utility to decouple API logic from components.
 */

export const extractMermaidCode = (text: string): string => {
  // Try to extract from ```mermaid ... ``` block
  const match = text.match(/```mermaid\s*([\s\S]*?)```/i);
  if (match) return match[1].trim();
  
  // Fallback: return raw text if it starts with graph/flowchart
  const trimmed = text.trim();
  if (trimmed.startsWith('graph') || trimmed.startsWith('flowchart')) return trimmed;
  
  // Last resort: strip any code fence
  return text.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
};

const callGemini = async (prompt: string): Promise<string> => {
  const key = aiSettings.value.geminiKey.trim();
  const model = aiSettings.value.geminiModel || 'gemini-1.5-pro';
  if (!key) throw new Error('Gemini API Key is not configured. Go to Settings -> AI.');
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
};

const callOpenAI = async (prompt: string): Promise<string> => {
  const key = aiSettings.value.openaiKey.trim();
  if (!key) throw new Error('OpenAI API Key is not configured. Go to Settings -> AI.');
  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${key}` 
    },
    body: JSON.stringify({
      model: aiSettings.value.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
};

const callClaude = async (prompt: string): Promise<string> => {
  const key = aiSettings.value.claudeKey.trim();
  if (!key) throw new Error('Claude API Key is not configured. Go to Settings -> AI.');
  
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: aiSettings.value.claudeModel,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
};

const callOllama = async (prompt: string): Promise<string> => {
  const url = aiSettings.value.ollamaUrl.trim() || 'http://localhost:11434/api/generate';
  const model = aiSettings.value.ollamaModel.trim() || 'llama3';
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.response ?? '';
};

export const callAI = async (prompt: string): Promise<string> => {
  switch (aiSettings.value.provider) {
    case 'openai': return callOpenAI(prompt);
    case 'claude': return callClaude(prompt);
    case 'ollama': return callOllama(prompt);
    default: return callGemini(prompt);
  }
};
