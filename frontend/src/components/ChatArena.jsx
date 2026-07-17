import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Plus, Trash2, Send, Cpu, Cloud, Terminal, User, Sparkles, X } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function ChatArena() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatModels, setChatModels] = useState([]);
  const [chatModelsLoading, setChatModelsLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // New Chat Modal/Form State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('New Session');
  const [selectedModelId, setSelectedModelId] = useState('');

  const messagesEndRef = useRef(null);

  // Fetch available models and sessions
  const loadInitialData = async () => {
    setSessionsLoading(true);
    setChatModelsLoading(true);
    try {
      // Fetch Sessions
      const sRes = await fetch(`${API_BASE}/chat/sessions`);
      const sData = await sRes.json();
      if (sData.success) {
        setSessions(sData.data);
        if (sData.data.length > 0 && !activeSession) {
          selectSession(sData.data[0]);
        }
      }

      // Fetch Models
      const mRes = await fetch(`${API_BASE}/chat/models`);
      const mData = await mRes.json();
      if (mData.success) {
        setChatModels(mData.data);
        if (mData.data.length > 0) {
          setSelectedModelId(mData.data[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading initial chat data:', err);
    } finally {
      setSessionsLoading(false);
      setChatModelsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const selectSession = async (session) => {
    setActiveSession(session);
    setMessagesLoading(true);
    setMessages([]);
    try {
      const res = await fetch(`${API_BASE}/chat/session/${session.id}/messages`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const createSession = async () => {
    if (!newChatTitle.trim() || !selectedModelId) return;
    
    const chosenModel = chatModels.find(m => m.id === selectedModelId);
    if (!chosenModel) return;

    try {
      const res = await fetch(`${API_BASE}/chat/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newChatTitle.trim(),
          model_id: chosenModel.id,
          adapter_path: chosenModel.adapter_path || null
        })
      });
      const data = await res.json();
      if (data.success) {
        setSessions([data.data, ...sessions]);
        setActiveSession(data.data);
        setMessages([]);
        setShowNewChatModal(false);
        setNewChatTitle('New Session');
      }
    } catch (err) {
      console.error('Error creating chat session:', err);
    }
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation history?')) return;
    try {
      const res = await fetch(`${API_BASE}/chat/session/${sessionId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        const filtered = sessions.filter(s => s.id !== sessionId);
        setSessions(filtered);
        if (activeSession?.id === sessionId) {
          if (filtered.length > 0) {
            selectSession(filtered[0]);
          } else {
            setActiveSession(null);
            setMessages([]);
          }
        }
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeSession || isGenerating) return;

    const userPrompt = inputMessage.trim();
    setInputMessage('');
    setIsGenerating(true);

    // 1. Show user message in UI immediately
    setMessages(prev => [...prev, { role: 'user', content: userPrompt, created_at: new Date().toISOString() }]);

    try {
      // 2. Open Stream fetch connection
      const response = await fetch(`${API_BASE}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSession.id,
          prompt: userPrompt
        })
      });

      if (!response.ok) {
        throw new Error('Inference API returned an error.');
      }

      // Add a placeholder assistant bubble to stream text into
      setMessages(prev => [...prev, { role: 'assistant', content: '', created_at: new Date().toISOString() }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Split by lines
        const lines = buffer.split('\n');
        
        // Keep the last element (which might be incomplete) in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                assistantResponse = parsed.error;
                updateLastAssistantMessage(assistantResponse);
                break;
              } else if (parsed.choices && parsed.choices.length > 0) {
                const content = parsed.choices[0].delta.content || '';
                assistantResponse += content;
                updateLastAssistantMessage(assistantResponse);
              }
            } catch (err) {
              // Ignore parse errors on partial JSON chunks
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}. Ensure your backend server is active and running.`, created_at: new Date().toISOString() }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const updateLastAssistantMessage = (content) => {
    setMessages(prev => {
      const updated = [...prev];
      if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
        updated[updated.length - 1].content = content;
      }
      return updated;
    });
  };

  const getModelName = (modelId) => {
    const model = chatModels.find(m => m.id === modelId);
    return model ? model.name : modelId;
  };

  return (
    <div className="chat-arena-container" style={{ display: 'flex', height: 'calc(100vh - 4.5rem)', margin: '-2.25rem', backgroundColor: 'var(--bg-app)' }}>
      {/* Sessions Left Sidebar */}
      <div className="chat-sidebar" style={{
        width: '260px',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-card)',
        flexShrink: 0
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowNewChatModal(true)} 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} /> New Chat
          </button>
        </div>

        {/* Sessions list */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '0.75rem 0.5rem' }}>
          {sessionsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)', fontSize: '0.8rem' }}>
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)', fontSize: '0.8rem' }}>
              No chats yet. Create one!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {sessions.map((s) => (
                <div 
                  key={s.id} 
                  onClick={() => selectSession(s)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    backgroundColor: activeSession?.id === s.id ? 'var(--primary-light)' : 'transparent',
                    color: activeSession?.id === s.id ? 'var(--primary)' : 'var(--text-muted)',
                    transition: 'all var(--transition-fast)'
                  }}
                  className="session-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexGrow: 1 }}>
                    <MessageSquare size={16} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
                  </div>
                  <button 
                    onClick={(e) => deleteSession(s.id, e)} 
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-light)',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    className="delete-session-btn"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Frame */}
      <div className="chat-main" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, backgroundColor: '#fcfcfd' }}>
        {activeSession ? (
          <>
            {/* Chat Header */}
            <div style={{
              padding: '0.75rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{activeSession.title}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px' }}>
                  <Cpu size={12} color="var(--success)" />
                  Model: {getModelName(activeSession.model_id)}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                <span className="badge badge-running" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}>Local Inference</span>
              </div>
            </div>

            {/* Message Area */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {messagesLoading ? (
                <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-light)' }}>
                  Loading conversation history...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-light)' }}>
                  <Sparkles size={40} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                  <p style={{ fontWeight: 500, fontSize: '0.95rem' }}>Start typing below to talk with the model.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>This conversation will be saved automatically.</p>
                </div>
              ) : (
                <>
                  {messages.map((m, idx) => (
                    <div 
                      key={idx} 
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        maxWidth: '85%',
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: m.role === 'user' ? 'var(--primary-light)' : 'var(--bg-app)',
                        color: m.role === 'user' ? 'var(--primary)' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        flexShrink: 0
                      }}>
                        {m.role === 'user' ? <User size={16} /> : <Terminal size={15} />}
                      </div>

                      {/* Bubble */}
                      <div style={{
                        padding: '0.75rem 1.15rem',
                        borderRadius: 'var(--radius-lg)',
                        backgroundColor: m.role === 'user' ? 'var(--primary)' : 'var(--bg-card)',
                        color: m.role === 'user' ? '#ffffff' : 'var(--text-main)',
                        boxShadow: 'var(--shadow-sm)',
                        border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                        fontSize: '0.9rem',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap'
                      }}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {isGenerating && messages[messages.length - 1]?.content === '' && (
                    <div style={{ alignSelf: 'flex-start', fontSize: '0.8rem', color: 'var(--text-light)', marginLeft: '40px' }}>
                      Thinking...
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input area */}
            <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
              <form onSubmit={sendMessage} style={{ display: 'flex', gap: '0.75rem' }}>
                <input 
                  type="text" 
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isGenerating ? "Model is streaming..." : "Type your message here..."}
                  disabled={isGenerating}
                  style={{
                    flexGrow: 1,
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color var(--transition-fast)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={!inputMessage.trim() || isGenerating}
                  style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span>Send</span> <Send size={15} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-light)' }}>
            <Sparkles size={56} style={{ color: 'var(--primary)', marginBottom: '1.5rem', opacity: 0.8 }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-main)' }}>Welcome to Chat Arena</h3>
            <p style={{ marginTop: '0.5rem', textAlign: 'center', maxWidth: '350px', fontSize: '0.85rem' }}>
              Select a previous conversation history from the sidebar or start a new chat using one of your custom adapters!
            </p>
            <button className="btn btn-primary" onClick={() => setShowNewChatModal(true)} style={{ marginTop: '1.5rem' }}>
              <Plus size={16} /> Start Chat Session
            </button>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Create Chat Session</h3>
              <button className="close-btn" onClick={() => setShowNewChatModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Session Title</label>
                  <input 
                    type="text" 
                    value={newChatTitle}
                    onChange={(e) => setNewChatTitle(e.target.value)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Select LLM Model</label>
                  {chatModelsLoading ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', padding: '0.5rem' }}>Loading models...</div>
                  ) : chatModels.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--error)', padding: '0.5rem' }}>No models registered. Start a training config first.</div>
                  ) : (
                    <select 
                      value={selectedModelId}
                      onChange={(e) => setSelectedModelId(e.target.value)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '0.9rem',
                        backgroundColor: 'var(--bg-card)'
                      }}
                    >
                      <optgroup label="Local Base Models (No Adapter)">
                        {chatModels.filter(m => m.source === 'local' && !m.is_adapter).map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="My Fine-tuned Adapters">
                        {chatModels.filter(m => m.source === 'local' && m.is_adapter).map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.base_model})</option>
                        ))}
                      </optgroup>
                    </select>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewChatModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={createSession} disabled={chatModels.length === 0}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
