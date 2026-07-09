import React, { useState, useEffect } from 'react';
import { UploadCloud, Eye, CheckCircle2, AlertTriangle, FileSpreadsheet, X, RefreshCw } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function DatasetManager() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Modal States
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const [validationData, setValidationData] = useState(null);
  const [validationLoading, setValidationLoading] = useState(false);

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dataset/list`);
      const data = await res.json();
      if (data.success) {
        setDatasets(data.data);
      }
    } catch (err) {
      console.error('Error fetching datasets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  // Upload Handlers
  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/dataset/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (res.status === 400 || !data.success) {
        setUploadError(data.message || 'Validation failed. Ensure file is formatted for instruction tuning.');
      } else {
        fetchDatasets();
      }
    } catch (err) {
      setUploadError('Network error uploading file.');
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

  // Preview dataset
  const openPreview = async (id, filename) => {
    setPreviewLoading(true);
    setPreviewData({ filename, rows: [] });
    try {
      const res = await fetch(`${API_BASE}/dataset/preview/${id}`);
      const data = await res.json();
      if (data.success) {
        setPreviewData({
          filename,
          // CSV / Parquet format wraps records under data.rows, JSON/JSONL might just return raw list
          rows: data.data.rows || (Array.isArray(data.data) ? data.data : [data.data]),
          columns: data.data.columns || (Array.isArray(data.data) && data.data[0] ? Object.keys(data.data[0]) : [])
        });
      }
    } catch (err) {
      console.error(err);
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Validate dataset
  const openValidation = async (id, filename) => {
    setValidationLoading(true);
    setValidationData({ filename, results: null });
    try {
      const res = await fetch(`${API_BASE}/dataset/validate/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setValidationData({
          filename,
          results: data.data
        });
      }
    } catch (err) {
      console.error(err);
      setValidationData(null);
    } finally {
      setValidationLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Datasets</h2>
          <p style={{ marginTop: '0.25rem' }}>Upload instruction tuning datasets containing instruction, input, and output columns.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchDatasets} disabled={loading}>
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
          Reload
        </button>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', gap: '2rem' }}>
        {/* Upload Column */}
        <div className="card">
          <div className="card-title">
            <UploadCloud size={18} /> Upload Dataset
          </div>
          
          <div 
            className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="upload-icon">
              <UploadCloud size={40} />
            </div>
            <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
              Drag & drop files here, or <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>browse</span>
            </p>
            <p style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>
              Supports CSV, JSON, JSONL, Parquet up to 50MB
            </p>
            <input 
              type="file" 
              className="upload-input" 
              accept=".csv,.json,.jsonl,.parquet" 
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </div>

          {uploading && (
            <div style={{ marginTop: '1.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Parsing dataset columns and uploading...
            </div>
          )}

          {uploadError && (
            <div style={{ 
              marginTop: '1.25rem', 
              padding: '0.75rem 1rem', 
              backgroundColor: 'var(--error-light)', 
              color: 'var(--error)', 
              borderRadius: 'var(--radius-md)', 
              fontSize: '0.85rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'start'
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{uploadError}</div>
            </div>
          )}
        </div>

        {/* Datasets Table */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-title">
            <FileSpreadsheet size={18} /> Dataset Library
          </div>
          
          {loading && datasets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Fetching datasets from library...
            </div>
          ) : datasets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No datasets uploaded yet. Upload a dataset above to start fine-tuning.
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Format</th>
                    <th>Size (KB)</th>
                    <th>Uploaded</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((dataset) => (
                    <tr key={dataset.id}>
                      <td style={{ fontWeight: 500 }}>{dataset.filename}</td>
                      <td>
                        <span className="badge badge-preparing" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                          {dataset.type}
                        </span>
                      </td>
                      <td>{dataset.size_kb}</td>
                      <td>{new Date(dataset.uploaded_at).toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem' }} onClick={() => openPreview(dataset.id, dataset.filename)}>
                            <Eye size={14} /> Preview
                          </button>
                          <button className="btn btn-primary" style={{ padding: '0.4rem 0.75rem' }} onClick={() => openValidation(dataset.id, dataset.filename)}>
                            <CheckCircle2 size={14} /> Validate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3>Previewing: {previewData.filename}</h3>
              <button className="close-btn" onClick={() => setPreviewData(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {previewLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                  Loading preview records...
                </div>
              ) : previewData.rows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                  No preview rows available.
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                  <table className="table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        {previewData.columns && previewData.columns.length > 0 ? (
                          previewData.columns.map((col, idx) => <th key={idx}>{col}</th>)
                        ) : (
                          <>
                            <th>Instruction</th>
                            <th>Input</th>
                            <th>Output</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.map((row, idx) => (
                        <tr key={idx}>
                          {previewData.columns && previewData.columns.length > 0 ? (
                            previewData.columns.map((col, cIdx) => (
                              <td key={cIdx} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top', maxWidth: '300px' }}>
                                {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                              </td>
                            ))
                          ) : (
                            <>
                              <td style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top', maxWidth: '250px' }}>{row.instruction}</td>
                              <td style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top', maxWidth: '200px' }}>{row.input}</td>
                              <td style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top', maxWidth: '250px' }}>{row.output}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPreviewData(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Modal */}
      {validationData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>Validation: {validationData.filename}</h3>
              <button className="close-btn" onClick={() => setValidationData(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '2rem 1.5rem' }}>
              {validationLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Analyzing dataset structure...
                </div>
              ) : !validationData.results ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--error)' }}>
                  Failed to run validation API.
                </div>
              ) : (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    {validationData.results.valid ? (
                      <div>
                        <CheckCircle2 size={56} style={{ color: 'var(--success)', marginBottom: '0.75rem' }} />
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Dataset is Valid!</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                          Fully ready for training instructions.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <AlertTriangle size={56} style={{ color: 'var(--error)', marginBottom: '0.75rem' }} />
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Validation Failed</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                          Issues detected with columns or rows.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="card" style={{ backgroundColor: 'var(--bg-app)', border: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Total Rows:</span>
                      <span style={{ fontWeight: 600 }}>{validationData.results.total_rows}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Duplicate Rows:</span>
                      <span style={{ fontWeight: 600, color: validationData.results.duplicate_rows > 0 ? 'var(--warning)' : 'inherit' }}>
                        {validationData.results.duplicate_rows}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Empty Rows:</span>
                      <span style={{ fontWeight: 600, color: validationData.results.empty_rows > 0 ? 'var(--error)' : 'inherit' }}>
                        {validationData.results.empty_rows}
                      </span>
                    </div>
                  </div>

                  {validationData.results.issues && validationData.results.issues.length > 0 && (
                    <div>
                      <h5 style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.025em' }}>
                        Issues List
                      </h5>
                      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {validationData.results.issues.map((issue, idx) => (
                          <li key={idx} style={{ 
                            fontSize: '0.825rem', 
                            padding: '0.5rem 0.75rem', 
                            backgroundColor: validationData.results.valid ? 'var(--warning-light)' : 'var(--error-light)', 
                            color: validationData.results.valid ? '#b45309' : 'var(--error)',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            gap: '0.35rem',
                            alignItems: 'center'
                          }}>
                            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setValidationData(null)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
