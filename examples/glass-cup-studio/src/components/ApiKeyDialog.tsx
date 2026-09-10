import { useState } from 'react'
import { testApiConnection } from '../lib/openai'

type Props = { open: boolean; apiKey: string; model: string; onKey: (value: string) => void; onModel: (value: string) => void; onClose: () => void }

export function ApiKeyDialog({ open, apiKey, model, onKey, onModel, onClose }: Props) {
  const [status, setStatus] = useState('')
  if (!open) return null
  const test = async () => {
    setStatus('正在测试…')
    try { await testApiConnection(apiKey, model); setStatus('连接成功') } catch (error) { setStatus(error instanceof Error ? error.message : '连接失败') }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="api-dialog" role="dialog" aria-modal="true" aria-labelledby="api-dialog-title">
      <div className="dialog-title"><div><p>AI 设置</p><h2 id="api-dialog-title">OpenAI API</h2></div><button type="button" onClick={onClose} aria-label="关闭">×</button></div>
      <label>API Key<input type="password" autoComplete="off" placeholder="sk-…" value={apiKey} onChange={(event) => { onKey(event.target.value); setStatus('') }} /></label>
      <label>模型 ID<input type="text" value={model} onChange={(event) => onModel(event.target.value)} /></label>
      <div className="security-note"><strong>仅适合本地或受信环境</strong><span>密钥只保存在当前页面内存，刷新后清除，不会写入工程文件。公开部署请改用后端代理。</span></div>
      {status ? <p className="api-status" role="status">{status}</p> : null}
      <div className="dialog-actions"><button className="ghost-button" type="button" onClick={() => { onKey(''); setStatus('已清除') }}>清除</button><button className="primary-button" type="button" onClick={test}>测试连接</button></div>
    </section>
  </div>
}
