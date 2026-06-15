import { useState, useEffect } from "react";

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  icon: string;
  description: string;
  apiKeyRequired: boolean;
  docsUrl: string;
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    icon: "ri-openai-line",
    description: "Most capable OpenAI model. Great for complex apps, detailed logic, and production code.",
    apiKeyRequired: true,
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    icon: "ri-brain-line",
    description: "Excellent at understanding nuance and generating well-structured, clean code.",
    apiKeyRequired: true,
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    icon: "ri-sparkling-line",
    description: "Fast and efficient. Great for rapid prototyping and quick iterations.",
    apiKeyRequired: true,
    docsUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    icon: "ri-code-box-line",
    description: "Strong coding performance at a fraction of the cost. Open-weight model.",
    apiKeyRequired: true,
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "grok-3",
    name: "Grok 3",
    provider: "xAI",
    icon: "ri-rocket-line",
    description: "Real-time aware model with strong reasoning for complex app logic.",
    apiKeyRequired: true,
    docsUrl: "https://console.x.ai",
  },
];

export interface StoredConfig {
  selectedModel: string;
  apiKeys: Record<string, string>;
  baseUrls: Record<string, string>;
}

export function loadConfig(): StoredConfig {
  try {
    const raw = localStorage.getItem("creailty_model_config");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { selectedModel: "gpt-4o", apiKeys: {}, baseUrls: {} };
}

export function saveConfig(config: StoredConfig) {
  localStorage.setItem("creailty_model_config", JSON.stringify(config));
}

interface ModelSelectorProps {
  onClose: () => void;
}

export default function ModelSelector({ onClose }: ModelSelectorProps) {
  const [config, setConfig] = useState<StoredConfig>(loadConfig);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [tempKey, setTempKey] = useState("");
  const [tempUrl, setTempUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const selectModel = (modelId: string) => {
    setConfig(prev => ({ ...prev, selectedModel: modelId }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const startEditKey = (modelId: string) => {
    setEditingModel(modelId);
    setTempKey(config.apiKeys[modelId] || "");
    setTempUrl(config.baseUrls[modelId] || "");
  };

  const saveKey = () => {
    if (!editingModel) return;
    setConfig(prev => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [editingModel]: tempKey },
      baseUrls: tempUrl ? { ...prev.baseUrls, [editingModel]: tempUrl } : prev.baseUrls,
    }));
    setEditingModel(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const removeKey = (modelId: string) => {
    const newKeys = { ...config.apiKeys };
    delete newKeys[modelId];
    const newUrls = { ...config.baseUrls };
    delete newUrls[modelId];
    setConfig(prev => ({ ...prev, apiKeys: newKeys, baseUrls: newUrls }));
  };

  const selectedModel = AVAILABLE_MODELS.find(m => m.id === config.selectedModel);
  const hasSelectedKey = selectedModel ? !!config.apiKeys[selectedModel.id] : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-background-100 border border-background-300/60 rounded-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-background-200/60 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground-800">AI Model Settings</h2>
            <p className="text-xs text-foreground-500 mt-0.5">Choose your model and add your API key</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer">
            <i className="ri-close-line text-foreground-500 text-sm" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-background-200/60 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-500">Active model:</span>
              <span className="text-xs font-semibold text-foreground-800 bg-background-200/60 rounded-full px-2.5 py-1">
                {selectedModel?.name || "None"}
              </span>
              {hasSelectedKey ? (
                <span className="flex items-center gap-1 text-xs text-accent-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-500 inline-block" />API key set
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-foreground-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground-600 inline-block" />No API key
                </span>
              )}
            </div>
            {saved && (
              <span className="text-xs text-accent-400 flex items-center gap-1"><i className="ri-check-line" />Saved</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {AVAILABLE_MODELS.map(model => {
            const isSelected = config.selectedModel === model.id;
            const hasKey = !!config.apiKeys[model.id];
            const isEditing = editingModel === model.id;

            return (
              <div key={model.id} className={`rounded-xl border transition-all ${isSelected ? "border-accent-500/30 bg-accent-500/5" : "border-background-200/60 bg-background-100 hover:border-background-300/60"}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button onClick={() => selectModel(model.id)}
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors ${
                          isSelected ? "border-accent-500 bg-accent-500" : "border-background-400 hover:border-foreground-600"
                        }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-background-50 inline-block" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground-800">{model.name}</h3>
                          <span className="text-[10px] font-medium text-foreground-500 bg-background-200/50 px-1.5 py-0.5 rounded-full">{model.provider}</span>
                        </div>
                        <p className="text-xs text-foreground-500 mt-1 leading-relaxed">{model.description}</p>
                        <div className="flex items-center gap-3 mt-2.5">
                          {hasKey ? (
                            <span className="text-[11px] text-accent-400 flex items-center gap-1"><i className="ri-key-2-line text-xs" />Key configured</span>
                          ) : (
                            <span className="text-[11px] text-foreground-600 flex items-center gap-1"><i className="ri-key-2-line text-xs" />API key needed</span>
                          )}
                          <button onClick={() => startEditKey(model.id)} className="text-[11px] text-foreground-500 hover:text-foreground-700 cursor-pointer whitespace-nowrap">
                            {hasKey ? "Change key" : "Add key"}
                          </button>
                          {hasKey && (
                            <button onClick={() => removeKey(model.id)} className="text-[11px] text-foreground-600 hover:text-accent-500 cursor-pointer whitespace-nowrap">Remove</button>
                          )}
                        </div>
                        {isEditing && (
                          <div className="mt-3 flex flex-col gap-2">
                            <input type="password" value={tempKey} onChange={e => setTempKey(e.target.value)}
                              placeholder="sk-... or ant-..." autoFocus
                              className="w-full bg-background-200/40 border border-background-300/60 rounded-lg px-3 py-2 text-xs text-foreground-800 placeholder-foreground-600 outline-none focus:border-foreground-400/50 font-mono"
                            />
                            <div className="flex items-center gap-2">
                              <input type="text" value={tempUrl} onChange={e => setTempUrl(e.target.value)}
                                placeholder="Custom base URL (optional)"
                                className="flex-1 bg-background-200/40 border border-background-300/60 rounded-lg px-3 py-2 text-xs text-foreground-800 placeholder-foreground-600 outline-none focus:border-foreground-400/50 font-mono"
                              />
                              <button onClick={saveKey} disabled={!tempKey.trim()}
                                className="flex items-center gap-1 bg-foreground-50 text-background-950 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-foreground-100 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">
                                Save key
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-background-200/60 flex-shrink-0 bg-background-100">
          <p className="text-[10px] text-foreground-600">Keys are stored in your browser only. Never sent to our servers.</p>
          <button onClick={onClose} className="text-xs font-medium text-foreground-500 hover:text-foreground-800 px-3 py-1.5 rounded-lg hover:bg-background-200/60 transition-colors cursor-pointer whitespace-nowrap">Done</button>
        </div>
      </div>
    </div>
  );
}