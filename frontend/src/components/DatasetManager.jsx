import React, { useState, useEffect } from 'react';
import { UploadCloud, Eye, CheckCircle2, AlertTriangle, FileSpreadsheet, X, RefreshCw, Trash2, Download, BarChart2, Search, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [activePreviewId, setActivePreviewId] = useState(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewTotalRows, setPreviewTotalRows] = useState(0);
  
  const [validationData, setValidationData] = useState(null);
  const [validationLoading, setValidationLoading] = useState(false);

  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

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
  const openPreview = async (id, filename, page = 1, search = '') => {
    setPreviewLoading(true);
    setActivePreviewId(id);
    setPreviewPage(page);
    setPreviewSearch(search);
    setPreviewData({ filename, rows: [], columns: [] });
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`${API_BASE}/dataset/preview/${id}?page=${page}&limit=10${searchParam}`);
      const data = await res.json();
      if (data.success) {
        setPreviewData({
          filename,
          rows: data.data.rows || [],
          columns: data.data.columns || []
        });
        setPreviewTotalRows(data.data.total_rows);
      }
    } catch (err) {
      console.error(err);
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Delete dataset
  const handleDelete = async (id, filename) => {
    if (!window.confirm(`Are you sure you want to delete dataset "${filename}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/dataset/delete/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchDatasets();
      } else {
        alert(data.message || 'Failed to delete dataset.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend.');
    }
  };

  // Download dataset
  const handleDownload = (id) => {
    window.open(`${API_BASE}/dataset/download/${id}`, '_blank');
  };

  // View statistics
  const openStats = async (id, filename) => {
    setStatsLoading(true);
    setStatsData({ filename, stats: null });
    try {
      const res = await fetch(`${API_BASE}/dataset/stats/${id}`);
      const data = await res.json();
      if (data.success) {
        setStatsData({
          filename,
          stats: data.data
        });
      }
    } catch (err) {
      console.error(err);
      setStatsData(null);
    } finally {
      setStatsLoading(false);
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
                        <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.5rem' }} onClick={() => openPreview(dataset.id, dataset.filename, 1, '')} title="Preview dataset rows">
                            <Eye size={14} /> Preview
                          </button>
                          <button className="btn btn-primary" style={{ padding: '0.4rem 0.5rem' }} onClick={() => openValidation(dataset.id, dataset.filename)} title="Validate dataset format">
                            <CheckCircle2 size={14} /> Validate
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.5rem' }} onClick={() => openStats(dataset.id, dataset.filename)} title="View dataset statistics">
                            <BarChart2 size={14} /> Stats
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.5rem' }} onClick={() => handleDownload(dataset.id)} title="Download dataset file">
                            <Download size={14} />
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.5rem', color: 'var(--error)', borderColor: 'var(--error-light)' }} onClick={() => handleDelete(dataset.id, dataset.filename)} title="Delete dataset">
                            <Trash2 size={14} />
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
          <div className="modal-content" style={{ maxWidth: '950px', width: '90%' }}>
            <div className="modal-header">
              <h3>Previewing: {previewData.filename}</h3>
              <button className="close-btn" onClick={() => { setPreviewData(null); setActivePreviewId(null); }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* Search Bar */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <div style={{ position: 'relative', flexGrow: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input 
                    type="text" 
                    placeholder="Search in instructions, inputs, or outputs..." 
                    defaultValue={previewSearch}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        openPreview(activePreviewId, previewData.filename, 1, e.target.value);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 1rem 0.5rem 2.25rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={(e) => {
                    const val = e.currentTarget.previousSibling.firstChild.nextSibling.value;
                    openPreview(activePreviewId, previewData.filename, 1, val);
                  }}
                >
                  Search
                </button>
              </div>

              {previewLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                  Loading preview records...
                </div>
              ) : previewData.rows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                  No preview rows found matching your search.
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
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
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {previewTotalRows > 0 ? (
                  <>
                    Showing {Math.min((previewPage - 1) * 10 + 1, previewTotalRows)} to {Math.min(previewPage * 10, previewTotalRows)} of {previewTotalRows} records
                  </>
                ) : (
                  'No records found'
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-secondary" 
                  disabled={previewPage === 1 || previewLoading} 
                  onClick={() => openPreview(activePreviewId, previewData.filename, previewPage - 1, previewSearch)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem' }}
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <button 
                  className="btn btn-secondary" 
                  disabled={previewPage * 10 >= previewTotalRows || previewLoading} 
                  onClick={() => openPreview(activePreviewId, previewData.filename, previewPage + 1, previewSearch)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem' }}
                >
                  Next <ChevronRight size={16} />
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem' }} onClick={() => { setPreviewData(null); setActivePreviewId(null); }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {statsData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>Statistics: {statsData.filename}</h3>
              <button className="close-btn" onClick={() => setStatsData(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {statsLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Calculating advanced statistics...
                </div>
              ) : !statsData.stats ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--error)' }}>
                  Failed to load dataset statistics.
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', border: 'none', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Rows</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.25rem' }}>{statsData.stats.total_rows}</div>
                    </div>
                    <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--bg-app)', border: 'none', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. Avg Tokens</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.25rem' }}>{statsData.stats.avg_tokens_per_row}</div>
                    </div>
                  </div>

                  <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem' }}>Data Quality Check</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Duplicate Samples:</span>
                        <span style={{ fontWeight: 600, color: statsData.stats.duplicates > 0 ? 'var(--warning)' : 'var(--success)' }}>
                          {statsData.stats.duplicates} ({statsData.stats.total_rows > 0 ? ((statsData.stats.duplicates / statsData.stats.total_rows) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Completely Empty Rows:</span>
                        <span style={{ fontWeight: 600, color: statsData.stats.empty_rows > 0 ? 'var(--error)' : 'var(--success)' }}>
                          {statsData.stats.empty_rows}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>File Size:</span>
                        <span style={{ fontWeight: 600 }}>{statsData.stats.file_size_kb} KB</span>
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem' }}>Column Length Distribution (Characters)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {Object.keys(statsData.stats.column_stats).map((col) => {
                        const colStat = statsData.stats.column_stats[col];
                        return (
                          <div key={col}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{col} Column</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                              <span>Min: <strong style={{ color: 'var(--text-main)' }}>{colStat.min_chars}</strong></span>
                              <span>Avg: <strong style={{ color: 'var(--text-main)' }}>{colStat.avg_chars}</strong></span>
                              <span>Max: <strong style={{ color: 'var(--text-main)' }}>{colStat.max_chars}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStatsData(null)}>
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
