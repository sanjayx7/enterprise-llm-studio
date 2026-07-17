import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Calendar, Award, RefreshCw, X, Play, Clock, Activity } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function StatusMonitor({ selectedJobId, setSelectedJobId }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  
  const terminalEndRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const fetchJobs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/training/jobs`);
      const data = await res.json();
      if (data.success) {
        setJobs(data.data);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Fetch jobs on load
  useEffect(() => {
    fetchJobs();
    
    // Periodically update the list of jobs every 5 seconds
    const interval = setInterval(() => {
      fetchJobs(false);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Poll details of the active job
  const fetchJobDetails = async (jobId) => {
    try {
      const res = await fetch(`${API_BASE}/training/jobs/${jobId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedJob(data.data);
        
        // If the job is in terminal state, clear polling
        if (['COMPLETED', 'FAILED'].includes(data.data.status)) {
          clearInterval(pollIntervalRef.current);
        }
      }
    } catch (err) {
      console.error('Error polling job details:', err);
    }
  };

  // Handle selectedJobId from Trainer tab transition
  useEffect(() => {
    if (selectedJobId) {
      // Focus on this job
      setSelectedJob({ id: selectedJobId, status: 'PENDING', logs: 'Connecting to pipeline...' });
      
      // Start polling
      clearInterval(pollIntervalRef.current);
      fetchJobDetails(selectedJobId);
      pollIntervalRef.current = setInterval(() => {
        fetchJobDetails(selectedJobId);
      }, 1500);
    } else {
      setSelectedJob(null);
      clearInterval(pollIntervalRef.current);
    }

    return () => clearInterval(pollIntervalRef.current);
  }, [selectedJobId]);

  // Handle manual job selection from table
  const handleSelectJob = (jobId) => {
    setSelectedJobId(jobId);
  };

  const handleCloseMonitor = () => {
    setSelectedJobId(null);
    setSelectedJob(null);
    clearInterval(pollIntervalRef.current);
    fetchJobs(false);
  };

  // Scroll terminal logs to bottom on update
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedJob?.logs]);

  // Helper: Status badge
  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'PENDING') return <span className="badge badge-pending">Pending</span>;
    if (s === 'PREPARING') return <span className="badge badge-preparing">Preparing</span>;
    if (s === 'RUNNING') return <span className="badge badge-running">Running</span>;
    if (s === 'COMPLETED') return <span className="badge badge-completed">Completed</span>;
    if (s === 'FAILED') return <span className="badge badge-failed">Failed</span>;
    return <span className="badge">{status}</span>;
  };

  // Helper: Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Job Monitor</h2>
          <p>Track progress, loss values, remaining time, and console logs of active and completed jobs.</p>
        </div>
        {!selectedJob && (
          <button className="btn btn-secondary" onClick={() => fetchJobs(true)} disabled={loading}>
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
            Refresh
          </button>
        )}
      </div>

      {selectedJob ? (
        /* Detailed Monitor View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>JOB #{selectedJob.id} DETAIL MONITOR</span>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
                  Training Status: {getStatusBadge(selectedJob.status)}
                </h3>
              </div>
              <button className="btn btn-secondary" onClick={handleCloseMonitor}>
                <X size={15} /> Exit Monitor
              </button>
            </div>

            {/* Metrics cards grid */}
            <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
              <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: 'var(--bg-app)', border: 'none' }}>
                <div className="stat-icon" style={{ backgroundColor: 'white' }}>
                  <Clock size={20} />
                </div>
                <div>
                  <h5 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Epoch / Step</h5>
                  <p style={{ fontWeight: 700, fontSize: '1.15rem' }}>
                    Epoch {selectedJob.current_epoch} <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)' }}>- Step {selectedJob.current_step}</span>
                  </p>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: 'var(--bg-app)', border: 'none' }}>
                <div className="stat-icon" style={{ backgroundColor: 'white', color: 'var(--primary)' }}>
                  <Activity size={20} />
                </div>
                <div>
                  <h5 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Loss</h5>
                  <p style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--primary)' }}>
                    {selectedJob.loss ? selectedJob.loss.toFixed(4) : '0.0000'}
                  </p>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: 'var(--bg-app)', border: 'none' }}>
                <div className="stat-icon" style={{ backgroundColor: 'white', color: 'var(--success)' }}>
                  <Calendar size={20} />
                </div>
                <div>
                  <h5 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Started At</h5>
                  <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {formatDate(selectedJob.started_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="progress-container">
              <div className="progress-header">
                <span>Training Progress</span>
                <span>{selectedJob.progress ? selectedJob.progress.toFixed(1) : '0.0'}%</span>
              </div>
              <div className="progress-bar-bg">
                <div 
                  className={`progress-bar-fill ${selectedJob.status === 'RUNNING' ? 'active' : ''}`}
                  style={{ width: `${selectedJob.progress || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Console Terminal Output */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div className="card-title" style={{ justifyContent: 'space-between', display: 'flex' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal size={18} /> Console Terminal logs
              </div>
              {selectedJob.status === 'RUNNING' && (
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span className="badge-running" style={{ width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }}></span>
                  Streaming logs...
                </span>
              )}
            </div>
            
            <div className="terminal">
              {selectedJob.logs ? (
                selectedJob.logs.split('\n').map((line, idx) => {
                  if (!line.trim()) return null;
                  let className = 'terminal-line';
                  if (line.includes('ERROR') || line.includes('Exception') || line.includes('Traceback')) {
                    className += ' error';
                  } else if (line.includes('successfully') || line.includes('finished')) {
                    className += ' success';
                  }
                  return (
                    <div key={idx} className={className}>
                      {line}
                    </div>
                  );
                })
              ) : (
                <div className="terminal-line" style={{ color: 'var(--text-light)' }}>
                  Awaiting logs from pipeline...
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      ) : (
        /* Jobs Table View */
        <div className="card">
          <div className="card-title">
            <Play size={18} /> Training Job History
          </div>

          {loading && jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Loading job history...
            </div>
          ) : jobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No training jobs have been executed yet. Define your model settings in the Training Studio to start.
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Loss</th>
                    <th>Last Active Step</th>
                    <th>Started At</th>
                    <th style={{ textAlign: 'right' }}>Monitor</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td style={{ fontWeight: 600 }}>#{job.id}</td>
                      <td>{getStatusBadge(job.status)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="progress-bar-bg" style={{ width: '60px', height: '6px' }}>
                            <div className="progress-bar-fill" style={{ width: `${job.progress || 0}%` }}></div>
                          </div>
                          <span>{job.progress ? job.progress.toFixed(0) : 0}%</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {job.loss ? job.loss.toFixed(4) : '0.0000'}
                      </td>
                      <td>Step {job.current_step} <span style={{ color: 'var(--text-light)', fontSize: '0.75rem' }}>(Epoch {job.current_epoch})</span></td>
                      <td>{formatDate(job.started_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem' }} onClick={() => handleSelectJob(job.id)}>
                          <Terminal size={14} /> Open Monitor
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
