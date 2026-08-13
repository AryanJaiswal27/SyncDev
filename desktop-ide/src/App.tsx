import React, { useState, useEffect, useRef } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import Editor from '@monaco-editor/react';
import './index.css';

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

interface Message {
  sender: 'ai' | 'user';
  text: string;
  isDiff?: boolean;
  diffData?: { file: string; diff: string };
  isStep?: boolean;
}

function FileTreeItem({ node, activePath, onSelect }: { node: FileNode; activePath: string; onSelect: (node: FileNode) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  if (node.is_dir) {
    return (
      <div style={{ marginLeft: 8 }}>
        <div 
          className="file-item folder" 
          onClick={() => setIsOpen(!isOpen)}
          style={{ cursor: 'pointer', fontWeight: 600, color: '#9da5b4', padding: '4px 6px', userSelect: 'none' }}
        >
          <span style={{ display: 'inline-block', width: 12, fontSize: '0.7rem' }}>{isOpen ? 'v' : '>'}</span> {node.name}
        </div>
        {isOpen && node.children && (
          <div>
            {node.children.map((child, idx) => (
              <FileTreeItem key={idx} node={child} activePath={activePath} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`file-item ${activePath === node.path ? 'active' : ''}`}
      onClick={() => onSelect(node)}
      style={{ marginLeft: 16, padding: '4px 6px', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center' }}
    >
      <svg style={{ opacity: 0.6, width: 14, height: 14, marginRight: 6 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
      {node.name}
    </div>
  );
}

function App() {
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string>('');
  const [activeFileName, setActiveFileName] = useState<string>('Select a file');
  const [fileContent, setFileContent] = useState<string>('// Select a file from the explorer to view its code...');
  const [models, setModels] = useState<{id: string, name: string}[]>([{id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash'}]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'ai', text: "Project initialized. Connected to Daemon. Select a model above and ask a question!" }
  ]);
  const [input, setInput] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch File Tree from Daemon
  const fetchFileTree = async () => {
    setErrorMsg(null);
    try {
      const res = await fetch('http://localhost:8080/fs/tree');
      if (res.ok) {
        const data = await res.json();
        setFileTree(data);
      } else {
        setErrorMsg(`Server returned ${res.status}`);
      }
    } catch (err: any) {
      console.error('Failed to fetch file tree:', err);
      setErrorMsg('Daemon offline or unreachable');
    }
  };

  // Fetch File Content from Daemon
  const handleFileSelect = async (node: FileNode) => {
    setActiveFilePath(node.path);
    setActiveFileName(node.name);
    try {
      const res = await fetch(`http://localhost:8080/fs/read?path=${encodeURIComponent(node.path)}`);
      if (res.ok) {
        const text = await res.text();
        setFileContent(text);
      } else {
        setFileContent(`// Error reading file: ${res.statusText}`);
      }
    } catch (err) {
      setFileContent(`// Failed to fetch content for ${node.name}`);
    }
  };

  useEffect(() => {
    fetchFileTree();
    fetch('http://localhost:3000/api/models')
      .then(res => res.json())
      .then(data => {
        if (data.models && data.models.length > 0) {
          setModels(data.models);
          setSelectedModel(data.models[0].id);
        }
      })
      .catch(err => console.error('Failed to fetch models:', err));

    const ws = new WebSocket('ws://127.0.0.1:8080/ws');
    
    ws.onopen = () => console.log('Connected to Daemon WS');
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'agent_step') {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.sender === 'ai' && last.isStep) {
              return [...prev.slice(0, -1), { sender: 'ai', text: data.payload, isStep: true }];
            }
            return [...prev, { sender: 'ai', text: data.payload, isStep: true }];
          });
        } else if (data.type === 'chat_response') {
          let parsedResponse;
          try {
            parsedResponse = JSON.parse(data.payload);
          } catch(e) { parsedResponse = null; }

          if (parsedResponse && parsedResponse.type === 'code_diff') {
             setMessages(prev => [...prev, { 
               sender: 'ai', 
               text: "I proposed a change:",
               isDiff: true,
               diffData: parsedResponse
             }]);
          } else {
             setMessages(prev => [...prev, { sender: 'ai', text: data.payload }]);
          }
          fetchFileTree();
        }
      } catch (err) {
        console.error('Error parsing WS message', err);
      }
    };
    
    ws.onclose = () => console.log('Disconnected from Daemon WS');
    wsRef.current = ws;

    return () => ws.close();
  }, []);

  const handleSend = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim() !== '') {
      const newMsg = input.trim();
      setMessages(prev => [...prev, { sender: 'user', text: newMsg }]);
      setInput('');
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ 
          type: 'chat', 
          payload: newMsg,
          model: selectedModel 
        }));
      }
    }
  };

  const getLanguage = (filename: string) => {
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
    if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
    if (filename.endsWith('.go')) return 'go';
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.md')) return 'markdown';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.html')) return 'html';
    return 'plaintext';
  };

  return (
    <PanelGroup orientation="horizontal" style={{ width: '100vw', height: '100vh' }}>
      
      {/* SIDEBAR PANEL */}
      <Panel defaultSize={20} minSize={15} maxSize={30} className="panel sidebar" style={{ overflowY: 'auto' }}>
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>SYNCDEV EXPLORER</span>
          <button 
            onClick={fetchFileTree} 
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#888', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: '0.7rem' }}
            title="Refresh File Tree"
          >
            REFRESH
          </button>
        </div>
        <div style={{ padding: '8px 0' }}>
          {errorMsg ? (
            <div style={{ padding: 10, color: '#ff4f4f', fontSize: '0.8rem' }}>{errorMsg}</div>
          ) : fileTree ? (
            fileTree.children ? (
              fileTree.children.map((child, idx) => (
                <FileTreeItem key={idx} node={child} activePath={activeFilePath} onSelect={handleFileSelect} />
              ))
            ) : (
              <FileTreeItem node={fileTree} activePath={activeFilePath} onSelect={handleFileSelect} />
            )
          ) : (
            <div style={{ padding: 10, color: '#666', fontSize: '0.8rem' }}>Loading workspace tree...</div>
          )}
        </div>
      </Panel>
      
      <PanelResizeHandle className="resize-handle" />

      {/* EDITOR PANEL */}
      <Panel defaultSize={50} minSize={30} className="editor-area" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {activeFilePath || activeFileName}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Editor
            height="100%"
            theme="vs-dark"
            language={getLanguage(activeFileName)}
            value={fileContent}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </Panel>

      <PanelResizeHandle className="resize-handle" />

      {/* CHAT PANEL */}
      <Panel defaultSize={30} minSize={20} maxSize={40} className="panel chat-panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span>AI ORCHESTRATOR</span>
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              background: '#1a1a1a',
              color: '#e0e0e0',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 4,
              padding: '2px 6px',
              fontSize: '0.75rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.sender} ${msg.isStep ? 'agent-step-container' : ''}`}>
              {!msg.isStep && (
                <>
                  {msg.sender === 'ai' && <strong>SyncDev AI</strong>}
                  {msg.sender === 'ai' && <br/>}
                  {msg.text}
                </>
              )}
              {msg.isStep && (
                <div className="agent-step-terminal">
                  <span className="step-icon">⚡</span> {msg.text}
                </div>
              )}
              
              {msg.isDiff && msg.diffData && (
                <div className="diff-viewer">
                  <div className="diff-header">{msg.diffData.file}</div>
                  <pre className="diff-content">{msg.diffData.diff}</pre>
                  <div className="diff-actions">
                    <button className="btn-approve" onClick={() => alert('Change Approved & Written!')}>Approve</button>
                    <button className="btn-reject" onClick={() => alert('Change Rejected!')}>Reject</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input 
            type="text" 
            placeholder="Ask SyncDev..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleSend}
          />
        </div>
      </Panel>
    </PanelGroup>
  );
}

export default App;
