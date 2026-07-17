import React, { useState, useEffect } from 'react';
import { UploadCloud, Trash2, Download, Edit3, Settings, MessageSquare, X, RefreshCw, FileArchive, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function ModelHub({ setActiveTab }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Modals / Editing
  const [selectedModel, setSelectedModel] = useState(null);
  const [editingModelId, setEditingModelId] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');

  const fetchTrainedModels = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/model/trained`);
      const data = await res.json();
      if (data.success) {
        setModels(data.data);
      }
    } catch (err) {
      console.error('Error fetching trained models:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainedModels();
  }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/model/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        setUploadError(data.message || 'Failed to upload adapter. Ensure it contains adapter_config.json.');
      } else {
        fetchTrainedModels();
      }
    } catch (err) {
      setUploadError('Network error uploading adapter.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const startEditing = (model) => {
    setEditingModelId(model.job_id);
    setEditNameValue(model.custom_name);
  };

  const saveRename = async (jobId) => {
    if (!editNameValue.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/model/${jobId}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editNameValue.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setModels(models.map(m => m.job_id === jobId ? { ...m, custom_name: editNameValue.trim() } : m));
        setEditingModelId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (jobId, name) => {
    if (!window.confirm(`Are you sure you want to delete the model "${name}"? This removes all adapter files from disk.`)) return;
    try {
      const res = await fetch(`${API_BASE}/model/${jobId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setModels(models.filter(m => m.job_id !== jobId));
      } else {
        alert(data.message || 'Failed to delete model.');
      }
    } catch (err) {
      console.error(err);
      alert('Error communicating with backend.');
    }
  };

  const handleDownload = (jobId) => {
    window.open(`${API_BASE}/model/${jobId}/download`, '_blank');
  };

  const openDetails = async (jobId) => {
    try {
      const res = await fetch(`${API_BASE}/training/jobs/${jobId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedModel(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Model Hub</h2>
          <p style={{ marginTop: '0.25rem' }}>Manage your fine-tuned adapters. Rename, download, delete, or upload pre-trained LoRA parameters.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchTrainedModels} disabled={loading}>
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
          Reload
        </button>
      </div>

      <div className="grid-3" style={{ alignItems: 'start', gap: '2rem', marginBottom: '2.5rem' }}>
        {/* Upload Card */}
        <div className="card" style={{ gridColumn: 'span 1' }}>
          <div className="card-title">
            <UploadCloud size={18} /> Upload Adapter
          </div>
          <div 
            className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}
          >
            <div className="upload-icon">
              <FileArchive size={36} color="var(--primary)" />
            </div>
            <p style={{ fontWeight: 500, fontSize: '0.85rem', margin: '0.5rem 0 0.25rem 0' }}>
              Drag & drop adapter ZIP here
            </p>
            <p style={{ color: 'var(--text-light)', fontSize: '0.75rem', marginBottom: '1rem' }}>
              Zip must contain adapter_config.json
            </p>
            <input 
              type="file" 
              className="upload-input" 
              accept=".zip" 
              onChange={handleFileSelect}
              disabled={uploading}
            />
            <button className="btn btn-secondary" style={{ pointerEvents: 'none', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
              Browse Zip
            </button>
          </div>

          {uploading && (
            <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Verifying and extracting adapter...
            </div>
          )}

          {uploadError && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem 1rem', 
              backgroundColor: 'var(--error-light)', 
              color: 'var(--error)', 
              borderRadius: 'var(--radius-md)', 
              fontSize: '0.8rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'start'
            }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{uploadError}</div>
            </div>
          )}
        </div>

        {/* Model Hub Grid */}
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>Your Active Adapters ({models.length})</h3>
          </div>

          {loading && models.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              Fetching adapters...
            </div>
          ) : models.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              No trained models available yet. Complete a training run or upload a pre-trained adapter to get started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {models.map((model) => (
                <div className="card model-card" key={model.job_id} style={{ padding: '1.5rem', transition: 'all var(--transition-fast)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ flexGrow: 1, marginRight: '1rem' }}>
                      {editingModelId === model.job_id ? (
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '400px' }}>
                          <input 
                            type="text" 
                            value={editNameValue} 
                            onChange={(e) => setEditNameValue(e.target.value)}
                            style={{
                              flexGrow: 1,
                              padding: '0.35rem 0.75rem',
                              border: '1px solid var(--primary)',
                              borderRadius: 'var(--radius-sm)',
                              fontFamily: 'var(--font-sans)',
                              fontSize: '0.9rem'
                            }}
                          />
                          <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => saveRename(model.job_id)}>
                            Save
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setEditingModelId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{model.custom_name}</h4>
                          <button 
                            style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '2px' }}
                            onClick={() => startEditing(model)}
                            title="Rename Model"
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Cpu size={14} /> Base: {model.base_model}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Size: {model.size_kb} KB
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Loss: <strong style={{ color: 'var(--primary)' }}>{model.loss ? model.loss.toFixed(4) : '0.0000'}</strong>
                        </span>
                        {model.epochs && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Epochs: {model.epochs}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="badge badge-completed" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                      Ready
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                      Completed: {new Date(model.completed_at).toLocaleString()}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => openDetails(model.job_id)}>
                        <Settings size={14} /> View Config
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleDownload(model.job_id)}>
                        <Download size={14} /> Download
                      </button>
                      <button className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setActiveTab('chat')}>
                        <MessageSquare size={14} /> Test in Chat
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: 'var(--error)', borderColor: 'var(--error-light)' }} 
                        onClick={() => handleDelete(model.job_id, model.custom_name)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Config Details Modal */}
      {selectedModel && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Training Details</h3>
              <button className="close-btn" onClick={() => setSelectedModel(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Base Model ID:</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedModel.config_id === 0 ? "Uploaded Adapter" : "Config #" + selectedModel.config_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Adapter Path:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', wordBreak: 'break-all', textAlign: 'right', maxWidth: '250px' }}>{selectedModel.adapter_path}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Final Loss:</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary)' }}>{selectedModel.loss ? selectedModel.loss.toFixed(6) : 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Epochs Completed:</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedModel.current_epoch}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Steps Executed:</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedModel.current_step}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedModel(null)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
