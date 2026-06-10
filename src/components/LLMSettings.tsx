import React, { useState } from 'react';
import { LLMConfig, loadLLMConfig, saveLLMConfig, getLastError } from '../ai/llmStrategy';

interface LLMSettingsProps {
  onClose: () => void;
}

const LLMSettings: React.FC<LLMSettingsProps> = ({ onClose }) => {
  const [config, setConfig] = useState<LLMConfig>(loadLLMConfig);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const handleSave = () => {
    saveLLMConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const endpoint = /\/v\d+\/?$/.test(config.baseUrl)
        ? `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`
        : `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        setTestResult(`❌ HTTP ${response.status}: ${errText.slice(0, 150)}`);
        return;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      setTestResult(`✅ 连接成功! 模型回复: "${content.slice(0, 50)}"`);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setTestResult('❌ 连接超时 (15秒)，请检查API地址是否正确');
      } else {
        setTestResult(`❌ ${err.message || err}`);
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="llm-settings-overlay" onClick={onClose}>
      <div className="llm-settings-panel" onClick={e => e.stopPropagation()}>
        <div className="llm-settings-header">
          <h3>🤖 AI设置</h3>
          <button className="llm-settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="llm-settings-row">
          <label>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={e => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
            />
            启用LLM AI (使用大语言模型代替概率算法)
          </label>
        </div>

        <div className="llm-settings-row">
          <label className="llm-settings-label">API地址</label>
          <input
            type="text"
            className="llm-settings-input"
            value={config.baseUrl}
            onChange={e => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
            placeholder="https://api.deepseek.com"
          />
        </div>

        <div className="llm-settings-row">
          <label className="llm-settings-label">模型</label>
          <input
            type="text"
            className="llm-settings-input"
            value={config.model}
            onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
            placeholder="deepseek-v4-flash"
          />
        </div>

        <div className="llm-settings-row">
          <label className="llm-settings-label">API Key</label>
          <input
            type="password"
            className="llm-settings-input"
            value={config.apiKey}
            onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            placeholder="sk-..."
          />
        </div>

        <div className="llm-settings-note">
          配置保存在浏览器本地，不会上传到任何服务器。API Key仅用于直接调用LLM接口。
        </div>

        {testResult && (
          <div className={`llm-settings-error ${testResult.startsWith('✅') ? 'success' : ''}`}>
            {testResult}
          </div>
        )}

        {getLastError() && !testResult && (
          <div className="llm-settings-error">
            ⚠️ 上次错误: {getLastError()}
          </div>
        )}

        <div className="llm-settings-actions">
          <button className="btn btn-llm-test" onClick={handleTest} disabled={testing || !config.apiKey}>
            {testing ? '⏳ 测试中...' : '🔌 测试连接'}
          </button>
          <button className="btn btn-llm-save" onClick={handleSave}>
            {saved ? '✅ 已保存' : '💾 保存'}
          </button>
          <button className="btn btn-llm-cancel" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default LLMSettings;
