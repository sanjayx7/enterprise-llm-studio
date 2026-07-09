import React, { useState, useEffect } from 'react';
import { Settings, Play, Sliders, Cpu, Database } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function Trainer({ setActiveTab, setSelectedJobId }) {
  const [datasets, setDatasets] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    dataset_id: '',
    model_id: '',
    epochs: 3,
    batch_size: 4,
    learning_rate: '0.00005',
    lora_rank: 8,
    lora_alpha: 16,
    lora_dropout: 0.05,
    max_sequence_length: 512
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const datasetRes = await fetch(`${API_BASE}/dataset/list`);
        const datasetData = await datasetRes.json();

        const modelRes = await fetch(`${API_BASE}/model/list`);
        const modelData = await modelRes.json();

        if (datasetData.success) setDatasets(datasetData.data);
        if (modelData.success) setModels(modelData.data);

        // Prepopulate first options
        setFormData(prev => ({
          ...prev,
          dataset_id: datasetData.success && datasetData.data[0] ? datasetData.data[0].id : '',
          model_id: modelData.success && modelData.data[0] ? modelData.data[0].id : ''
        }));
      } catch (err) {
        console.error('Error fetching models/datasets:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStartTraining = async (e) => {
    e.preventDefault();
    setStarting(true);
    setErrorMsg('');

    // Validations
    if (!formData.dataset_id) {
      setErrorMsg('Please select a dataset to start training.');
      setStarting(false);
      return;
    }
    if (!formData.model_id) {
      setErrorMsg('Please select a base model to start training.');
      setStarting(false);
      return;
    }

    try {
      // Step 1: Create Configuration
      const configRes = await fetch(`${API_BASE}/training/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: parseInt(formData.dataset_id),
          model_id: formData.model_id,
          epochs: parseInt(formData.epochs),
          batch_size: parseInt(formData.batch_size),
          learning_rate: parseFloat(formData.learning_rate),
          lora_rank: parseInt(formData.lora_rank),
          lora_alpha: parseInt(formData.lora_alpha),
          lora_dropout: parseFloat(formData.lora_dropout),
          max_sequence_length: parseInt(formData.max_sequence_length)
        })
      });
      const configData = await configRes.json();

      if (!configRes.ok || !configData.success) {
        throw new Error(configData.message || 'Failed to create training configuration.');
      }

      const configId = configData.data.config_id;

      // Step 2: Start Training Job (Runs in background)
      const startRes = await fetch(`${API_BASE}/training/start/${configId}`, {
        method: 'POST'
      });
      const startData = await startRes.json();

      if (!startRes.ok || !startData.success) {
        throw new Error(startData.message || 'Failed to initiate background training.');
      }

      // Step 3: Redirect to Monitor tab, setting the active jobId
      setSelectedJobId(startData.data.job_id);
      setActiveTab('jobs');

    } catch (err) {
      setErrorMsg(err.message || 'Network error initiating training.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Training Studio</h2>
          <p>Configure model templates, datasets, and LoRA hyperparameters to fine-tune your model.</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading training resources...
        </div>
      ) : (
        <form onSubmit={handleStartTraining}>
          <div className="grid-2">
            
            {/* Core Settings */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card-title">
                <Sliders size={18} /> Model & Dataset Selectors
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="model_id">Base Model Template</label>
                <div style={{ position: 'relative' }}>
                  <select 
                    id="model_id"
                    name="model_id" 
                    className="form-control" 
                    value={formData.model_id} 
                    onChange={handleChange}
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.size})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="dataset_id">Target Instruction Dataset</label>
                {datasets.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--error)' }}>
                    No datasets available. Please upload a dataset in the Dataset Manager first.
                  </p>
                ) : (
                  <select 
                    id="dataset_id"
                    name="dataset_id" 
                    className="form-control" 
                    value={formData.dataset_id} 
                    onChange={handleChange}
                  >
                    {datasets.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.filename} ({d.type})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="epochs">Training Epochs</label>
                  <input 
                    id="epochs"
                    type="number" 
                    name="epochs" 
                    className="form-control" 
                    value={formData.epochs} 
                    min="1" 
                    max="100" 
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="batch_size">Batch Size</label>
                  <input 
                    id="batch_size"
                    type="number" 
                    name="batch_size" 
                    className="form-control" 
                    value={formData.batch_size} 
                    min="1" 
                    max="64" 
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="learning_rate">Learning Rate</label>
                <input 
                  id="learning_rate"
                  type="text" 
                  name="learning_rate" 
                  className="form-control" 
                  value={formData.learning_rate} 
                  placeholder="0.00005" 
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Hyperparameters */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card-title">
                <Settings size={18} /> LoRA & Sequence Hyperparameters
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="lora_rank">LoRA Rank (r)</label>
                  <input 
                    id="lora_rank"
                    type="number" 
                    name="lora_rank" 
                    className="form-control" 
                    value={formData.lora_rank} 
                    min="1" 
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="lora_alpha">LoRA Alpha (α)</label>
                  <input 
                    id="lora_alpha"
                    type="number" 
                    name="lora_alpha" 
                    className="form-control" 
                    value={formData.lora_alpha} 
                    min="1" 
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="lora_dropout">LoRA Dropout</label>
                <input 
                  id="lora_dropout"
                  type="number" 
                  name="lora_dropout" 
                  className="form-control" 
                  value={formData.lora_dropout} 
                  step="0.01" 
                  min="0" 
                  max="1" 
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="max_sequence_length">Max Sequence Length</label>
                <input 
                  id="max_sequence_length"
                  type="number" 
                  name="max_sequence_length" 
                  className="form-control" 
                  value={formData.max_sequence_length} 
                  min="64" 
                  max="8192" 
                  onChange={handleChange}
                />
              </div>

              {errorMsg && (
                <div style={{ 
                  padding: '0.75rem 1rem', 
                  backgroundColor: 'var(--error-light)', 
                  color: 'var(--error)', 
                  borderRadius: 'var(--radius-md)', 
                  fontSize: '0.85rem'
                }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ marginTop: 'auto', paddingTop: '1.25rem' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '0.875rem' }} 
                  disabled={starting}
                >
                  <Play size={16} /> {starting ? 'Initiating Pipeline...' : 'Start Training Job'}
                </button>
              </div>
            </div>

          </div>
        </form>
      )}
    </div>
  );
}
