import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)
import './App.css'

const API_BASE = 'https://smart-care-pathway.onrender.com'

const ACTION_STYLE = {
  maintain_plan: { class: 'stable', dot: '#22C7A9' },
  intensify_lifestyle: { class: 'watch', dot: '#F5A623' },
  adjust_medication: { class: 'urgent', dot: '#F0506E' },
  refer_specialist: { class: 'urgent', dot: '#F0506E' },
}

function App() {
  const [patientName, setPatientName] = useState('')
  const [patientId, setPatientId] = useState('')
  const [loadId, setLoadId] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  const [vitals, setVitals] = useState({
    pregnancies: '', glucose: '', blood_pressure: '', skin_thickness: '',
    insulin: '', bmi: '', diabetes_pedigree_function: '', age: '',
  })
  const [recommendation, setRecommendation] = useState(null)
  const [history, setHistory] = useState([])
  const [explanation, setExplanation] = useState('')
  const [explaining, setExplaining] = useState(false)

  const chartData = {
    labels: history.map((e) => new Date(e.timestamp).toLocaleDateString()),
    datasets: [
      {
        label: 'Glucose',
        data: history.map((e) => e.vitals.glucose),
        borderColor: '#F0506E',
        backgroundColor: '#F0506E',
        tension: 0.3,
      },
      {
        label: 'BMI',
        data: history.map((e) => e.vitals.bmi),
        borderColor: '#2DD4BF',
        backgroundColor: '#2DD4BF',
        tension: 0.3,
      },
    ],
  }

  const chartOptions = {
    plugins: { legend: { labels: { color: '#E8EEF9' } } },
    scales: {
      x: { ticks: { color: '#94A3BD' }, grid: { color: 'rgba(148,163,189,0.12)' } },
      y: { ticks: { color: '#94A3BD' }, grid: { color: 'rgba(148,163,189,0.12)' } },
    },
  }

  async function createPatient() {
    setStatusMsg('Creating patient...')
    try {
      const res = await fetch(`${API_BASE}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: patientName }),
      })
      const data = await res.json()
      setPatientId(data.id)
      setStatusMsg(`Patient "${data.name}" created — ID ${data.id}`)
    } catch (err) {
      setStatusMsg('Error: could not reach the backend. Is uvicorn running?')
    }
  }

  function updateVital(field, value) {
    setVitals({ ...vitals, [field]: value })
  }

  async function fetchHistory() {
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}`)
      const data = await res.json()
      setHistory(data.vitals_history || [])
    } catch (err) {
      console.error('Could not fetch history', err)
    }
  }

  async function loadExistingPatient() {
    setStatusMsg('Loading patient...')
    try {
      const res = await fetch(`${API_BASE}/patients/${loadId}`)
      if (!res.ok) throw new Error('not found')
      const data = await res.json()
      setPatientId(data._id)
      setPatientName(data.name)
      setHistory(data.vitals_history || [])
      setStatusMsg(`Loaded patient "${data.name}"`)
    } catch (err) {
      setStatusMsg('Error: could not find that patient ID.')
    }
  }

  async function getExplanation() {
    setExplaining(true)
    setExplanation('')
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}/explain`, { method: 'POST' })
      const data = await res.json()
      setExplanation(data.explanation)
    } catch (err) {
      setExplanation('Could not generate explanation.')
    }
    setExplaining(false)
  }

  async function submitVitals() {
    setStatusMsg('Getting recommendation...')
    try {
      const payload = {
        pregnancies: Number(vitals.pregnancies),
        glucose: Number(vitals.glucose),
        blood_pressure: Number(vitals.blood_pressure),
        skin_thickness: Number(vitals.skin_thickness),
        insulin: Number(vitals.insulin),
        bmi: Number(vitals.bmi),
        diabetes_pedigree_function: Number(vitals.diabetes_pedigree_function),
        age: Number(vitals.age),
      }
      const res = await fetch(`${API_BASE}/patients/${patientId}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      setRecommendation(data)
      setStatusMsg('')
      fetchHistory()
    } catch (err) {
      setStatusMsg('Error: could not get a recommendation.')
    }
  }

  const recStyle = recommendation ? (ACTION_STYLE[recommendation.care_action]?.class || 'watch') : ''

  return (
    <div className="app-shell">
      <p className="eyebrow">Chronic Disease Management · Diabetes</p>
      <h1 className="title">Adaptive Care Pathway</h1>

      <h2 className="section-label">Load Existing Patient</h2>
      <div className="field-row">
        <label className="field-label">Patient ID (from Compass)</label>
        <input
          type="text"
          className="field-input"
          placeholder="Paste patient _id here"
          value={loadId}
          onChange={(e) => setLoadId(e.target.value)}
        />
      </div>
      <button className="btn" onClick={loadExistingPatient}>Load Patient</button>

      <h2 className="section-label">01 · Patient</h2>
      <div className="field-row">
        <label className="field-label">Name</label>
        <input
          type="text"
          className="field-input"
          placeholder="e.g. Ravi Kumar"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
        />
      </div>
      <button className="btn" onClick={createPatient}>Create Patient</button>

      {statusMsg && <div className="status-note">{statusMsg}</div>}

      {patientId && (
        <>
          <h2 className="section-label">02 · Vitals Reading</h2>
          <div className="grid-2">
            {Object.keys(vitals).map((field) => (
              <div className="field-row" key={field}>
                <label className="field-label">{field.replace(/_/g, ' ')}</label>
                <input
                  type="number"
                  className="field-input"
                  value={vitals[field]}
                  onChange={(e) => updateVital(field, e.target.value)}
                />
              </div>
            ))}
          </div>
          <button className="btn" onClick={submitVitals}>Get Recommendation</button>
        </>
      )}

      {recommendation && (
        <div className={`recommendation-card ${recStyle}`}>
          <h3>{recommendation.care_action.replace(/_/g, ' ')}</h3>
          <p>Confidence {(recommendation.confidence * 100).toFixed(1)}%</p>
        </div>
      )}

      {recommendation && (
        <button className="btn btn-secondary" onClick={getExplanation}>
          {explaining ? 'Generating explanation...' : 'Explain Condition & Diet Plan'}
        </button>
      )}

      {explanation && (
        <>
          <button
            className="btn btn-accent"
            onClick={() => {
              const plainText = explanation.replace(/[#*_`]/g, '')
              const utterance = new SpeechSynthesisUtterance(plainText)
              window.speechSynthesis.cancel()
              window.speechSynthesis.speak(utterance)
            }}
          >
            🔊 Listen to Explanation
          </button>
          <div className="explanation-card">
            <ReactMarkdown>{explanation}</ReactMarkdown>
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <h2 className="section-label">03 · Pathway History</h2>
          {history.length > 1 && (
            <div className="chart-card">
              <Line data={chartData} options={chartOptions} />
            </div>
          )}
          <div className="timeline">
            {history.slice().reverse().map((entry, i) => {
              const style = ACTION_STYLE[entry.care_action] || {}
              return (
                <div className="timeline-entry" style={{ '--dot-color': style.dot }} key={i}>
                  <p className="timeline-time">{new Date(entry.timestamp).toLocaleString()}</p>
                  <p className="timeline-vitals">
                    glucose {entry.vitals.glucose} · bmi {entry.vitals.bmi} · bp {entry.vitals.blood_pressure}
                  </p>
                  <p className="timeline-action">{entry.care_action.replace(/_/g, ' ')} — {(entry.confidence * 100).toFixed(1)}%</p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default App