import React, { useState, useEffect } from 'react';
import { Database, Cpu, Play, Award } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function Dashboard({ setActiveTab }) {
  const [stats, setStats] = useState({
    datasets: 0,
    models: 0,
    jobs: 0,
    completedJobs: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const datasetRes = await fetch(`${API_BASE}/dataset/list`);
        const datasetData = await datasetRes.json();
        
        const modelRes = await fetch(`${API_BASE}/model/list`);
        const modelData = await modelRes.json();

        const jobRes = await fetch(`${API_BASE}/training/jobs`);
        const jobData = await jobRes.json();

        setStats({
          datasets: datasetData.success ? datasetData.data.length : 0,
          models: modelData.success ? modelData.data.length : 4,
          jobs: jobData.success ? jobData.data.length : 0,
          completedJobs: jobData.success 
            ? jobData.data.filter(j => j.status === 'COMPLETED').length 
            : 0
        });
      } catch (err) {
        console.error('Failed to fetch dashboard stats', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Welcome to Enterprise LLM Studio. Track datasets, model templates, and fine-tuning jobs.</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading system metrics...
        </div>
      ) : (
        <>
          <div className="grid-3" style={{ marginBottom: '2.5rem' }}>
            <div className="card stat-card">
              <div className="stat-icon">
                <Database size={24} />
              </div>
              <div className="stat-info">
                <h4>Uploaded Datasets</h4>
                <p>{stats.datasets}</p>
              </div>
            </div>

            <div className="card stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
                <Cpu size={24} />
              </div>
              <div className="stat-info">
                <h4>Base Model Templates</h4>
                <p>{stats.models}</p>
              </div>
            </div>

            <div className="card stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Play size={24} />
              </div>
              <div className="stat-info">
                <h4>Training Jobs Run</h4>
                <p>{stats.jobs} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>({stats.completedJobs} completed)</span></p>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <div className="card-title" style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>
              <Award size={20} /> Fine-Tuning Workflow Guide
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ 
                  backgroundColor: 'var(--primary-light)', 
                  color: 'var(--primary)', 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  flexShrink: 0,
                  fontSize: '0.85rem'
                }}>1</div>
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Upload & Validate Datasets</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Go to the <strong>Datasets</strong> tab. Upload CSV, JSON, JSONL, or Parquet datasets. 
                    The studio automatically validates columns (`instruction`, `input`, `output`) to ensure compatibility with instruction-tuning.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ 
                  backgroundColor: 'var(--primary-light)', 
                  color: 'var(--primary)', 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  flexShrink: 0,
                  fontSize: '0.85rem'
                }}>2</div>
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Configure Hyperparameters</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Navigate to <strong>Training Studio</strong>. Select your dataset and target base model template. 
                    Fine-tune hyperparameters including training epochs, batch size, learning rates, and LoRA details (rank, alpha, and dropout).
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ 
                  backgroundColor: 'var(--primary-light)', 
                  color: 'var(--primary)', 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  flexShrink: 0,
                  fontSize: '0.85rem'
                }}>3</div>
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Monitor Live Training</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Start training and monitor the process live in the <strong>Job Monitor</strong>. 
                    Get real-time updates for training loss, current epoch steps, total progress metrics, and full console outputs.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', display: 'flex', gap: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setActiveTab('datasets')}>
                Manage Datasets
              </button>
              <button className="btn btn-secondary" onClick={() => setActiveTab('trainer')}>
                Launch Training Studio
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
