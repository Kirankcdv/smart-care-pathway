import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Line } from 'react-chartjs-2'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import './App.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
)

const API_BASE = (
  import.meta.env.VITE_API_BASE || 'https://smart-care-pathway.onrender.com'
).replace(/\/+$/, '')

const ACTION_STYLE = {
  maintain_plan: { class: 'stable', dot: '#22C7A9' },
  intensify_lifestyle: { class: 'watch', dot: '#F5A623' },
  adjust_medication: { class: 'urgent', dot: '#F0506E' },
  refer_specialist: { class: 'urgent', dot: '#F0506E' },
}

const CONDITION_LABEL = {
  maintain_plan: 'Low Risk (Indicative)',
  intensify_lifestyle: 'Pre-Diabetes Risk (Indicative)',
  adjust_medication: 'Type 2 Diabetes (Indicative)',
  refer_specialist: 'High-Risk Diabetes (Indicative)',
}

const EMPTY_VITALS = {
  pregnancies: '',
  glucose: '',
  blood_pressure: '',
  skin_thickness: '',
  insulin: '',
  bmi: '',
  diabetes_pedigree_function: '',
  age: '',
}

const normalizeAction = (action) =>
  String(action || '').trim().toLowerCase().replace(/[\s-]+/g, '_')

const actionText = (action) => normalizeAction(action).replace(/_/g, ' ')

// jsPDF's built-in fonts only support basic Latin characters.
const pdfSafe = (value) =>
  String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u20B9/g, 'Rs. ')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')
    .trim()

async function api(path, options) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, options)
  } catch {
    throw new Error(
      'Cannot reach the server. If it is on free hosting it may be waking up - wait a minute and try again.'
    )
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const detail = data?.detail
    const message = Array.isArray(detail)
      ? detail
          .map((d) => `${(d.loc || []).slice(-1)[0]}: ${d.msg}`)
          .join('; ')
      : detail
    throw new Error(message || `Request failed (${res.status})`)
  }

  return data
}

function isCompleteReport(data) {
  const filled = (list) => Array.isArray(list) && list.length > 0
  return (
    filled(data?.keywords) &&
    filled(data?.precautions) &&
    filled(data?.diet_schedule) &&
    data.diet_schedule.every((i) => i && i.time && i.meal && i.food) &&
    filled(data?.exercise_schedule) &&
    data.exercise_schedule.every(
      (i) => i && i.time && i.activity && i.duration
    )
  )
}

function splitIntoChunks(text, max = 180) {
  const sentences = text.replace(/\n+/g, '. ').match(/[^.!?]+[.!?]*/g) || [text]
  const chunks = []
  let current = ''

  for (const sentence of sentences) {
    const part = sentence.trim()
    if (!part) continue
    if (current && `${current} ${part}`.length > max) {
      chunks.push(current)
      current = part
    } else {
      current = `${current} ${part}`.trim()
    }
  }

  if (current) chunks.push(current)
  return chunks
}

function App() {
  const [patientName, setPatientName] = useState('')
  const [patientId, setPatientId] = useState('')
  const [loadId, setLoadId] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  const [vitals, setVitals] = useState(EMPTY_VITALS)
  const [recommendation, setRecommendation] = useState(null)
  const [history, setHistory] = useState([])
  const [explanation, setExplanation] = useState('')
  const [explaining, setExplaining] = useState(false)
  const [reportData, setReportData] = useState(null)

  const [speechStatus, setSpeechStatus] = useState('idle')
  const speechRunRef = useRef(0)

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

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
      x: {
        ticks: { color: '#94A3BD' },
        grid: { color: 'rgba(148,163,189,0.12)' },
      },
      y: {
        ticks: { color: '#94A3BD' },
        grid: { color: 'rgba(148,163,189,0.12)' },
      },
    },
  }

  function resetResults() {
    stopExplanation()
    setRecommendation(null)
    setExplanation('')
    setReportData(null)
  }

  async function createPatient() {
    const name = patientName.trim()
    if (!name) {
      setStatusMsg('Please enter patient name.')
      return
    }

    setStatusMsg('Creating patient... (the server may take a minute to wake up)')

    try {
      const data = await api('/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      resetResults()
      setHistory([])
      setVitals(EMPTY_VITALS)
      setPatientId(data.id)
      setPatientName(data.name)
      setStatusMsg(`Patient "${data.name}" created — ID ${data.id}`)
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`)
    }
  }

  async function loadExistingPatient() {
    const id = loadId.trim()
    if (!id) {
      setStatusMsg('Please enter a patient ID.')
      return
    }

    setStatusMsg('Loading patient... (the server may take a minute to wake up)')

    try {
      const data = await api(`/patients/${id}`)

      resetResults()
      setVitals(EMPTY_VITALS)
      setPatientId(data._id)
      setPatientName(data.name)

      const past = data.vitals_history || []
      setHistory(past)

      if (past.length > 0) {
        const last = past[past.length - 1]
        setRecommendation({
          care_action: last.care_action,
          confidence: last.confidence,
          vitals: last.vitals,
        })
      }

      setStatusMsg(`Loaded patient "${data.name}"`)
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`)
    }
  }

  function updateVital(field, value) {
    setVitals((prev) => ({ ...prev, [field]: value }))
  }

  async function submitVitals() {
    if (!patientId) {
      setStatusMsg('Create or load a patient first.')
      return
    }

    if (Object.values(vitals).some((value) => value === '')) {
      setStatusMsg('Please enter all patient readings.')
      return
    }

    setStatusMsg('Getting recommendation...')
    resetResults()

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

    try {
      const entry = await api(`/patients/${patientId}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setRecommendation({
        care_action: entry.care_action,
        confidence: entry.confidence,
        vitals: payload,
      })
      setHistory((prev) => [...prev, entry])
      setStatusMsg('Recommendation generated successfully.')
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`)
    }
  }

  async function getExplanation() {
    if (!patientId || !recommendation) {
      setStatusMsg('Create or load a patient and get a recommendation first.')
      return
    }

    stopExplanation()
    setExplaining(true)
    setExplanation('')
    setReportData(null)
    setStatusMsg('Generating explanation and timetables...')

    try {
      const data = await api(`/patients/${patientId}/explain`, {
        method: 'POST',
      })

      if (!data?.explanation) {
        throw new Error('The server returned an empty explanation.')
      }

      setExplanation(data.explanation)

      if (isCompleteReport(data)) {
        setReportData(data)
        setStatusMsg('Explanation and PDF report are ready.')
      } else {
        setStatusMsg(
          'Explanation generated, but the timetable was incomplete. Click "Explain" again to retry the PDF.'
        )
      }
    } catch (err) {
      setStatusMsg(`Explanation error: ${err.message}`)
    } finally {
      setExplaining(false)
    }
  }

  function downloadPDF() {
    if (!reportData) {
      setStatusMsg('Generate the explanation first.')
      return
    }

    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      let y = 20

      const action = normalizeAction(recommendation?.care_action)
      const latestVitals =
        recommendation?.vitals ||
        (history.length > 0 ? history[history.length - 1].vitals : vitals)

      const ensureSpace = (needed) => {
        if (y + needed > pageHeight - 25) {
          doc.addPage()
          y = 20
        }
      }

      const addHeading = (title) => {
        ensureSpace(30)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(35, 75, 110)
        doc.text(title, 14, y)
        doc.setTextColor(0)
        y += 6
      }

      const addTable = (headers, rows) => {
        autoTable(doc, {
          startY: y,
          head: [headers],
          body: rows.map((row) => row.map(pdfSafe)),
          margin: { left: 14, right: 14, bottom: 22 },
          styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
          headStyles: { fillColor: [35, 75, 110], textColor: 255 },
          alternateRowStyles: { fillColor: [240, 245, 250] },
        })
        y = doc.lastAutoTable.finalY + 10
      }

      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('SMART CARE PATHWAY', 14, y)
      y += 9

      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('Personalized Health Report', 14, y)
      y += 12

      doc.setFontSize(10)
      doc.text(`Patient Name: ${pdfSafe(patientName) || 'Not provided'}`, 14, y)
      y += 7
      doc.text(`Patient ID: ${patientId}`, 14, y)
      y += 7
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, 14, y)
      y += 12

      addHeading('ASSESSMENT')
      addTable(
        ['Category', 'Details'],
        [
          ['Assessment Focus', reportData.assessment_focus || 'Diabetes'],
          ['Indicative Condition', CONDITION_LABEL[action] || 'Not available'],
          ['Care Action', actionText(recommendation?.care_action) || 'Not available'],
          [
            'Care Action Confidence',
            recommendation
              ? `${(recommendation.confidence * 100).toFixed(1)}%`
              : 'Not available',
          ],
        ]
      )

      addHeading('PATIENT READINGS')
      addTable(
        ['Reading', 'Value'],
        [
          ['Pregnancies', latestVitals.pregnancies ?? 'N/A'],
          ['Glucose', `${latestVitals.glucose ?? 'N/A'} mg/dL`],
          ['Blood Pressure', latestVitals.blood_pressure ?? 'N/A'],
          ['Skin Thickness', latestVitals.skin_thickness ?? 'N/A'],
          ['Insulin', latestVitals.insulin ?? 'N/A'],
          ['BMI', latestVitals.bmi ?? 'N/A'],
          [
            'Diabetes Pedigree Function',
            latestVitals.diabetes_pedigree_function ?? 'N/A',
          ],
          ['Age', latestVitals.age ?? 'N/A'],
        ]
      )

      addHeading('KEY HEALTH INDICATORS')
      addTable(
        ['No.', 'Keyword'],
        reportData.keywords.map((item, i) => [i + 1, item])
      )

      addHeading('DAILY DIET TIMETABLE')
      addTable(
        ['Time', 'Meal', 'Food'],
        reportData.diet_schedule.map((i) => [i.time, i.meal, i.food])
      )

      addHeading('DAILY EXERCISE TIMETABLE')
      addTable(
        ['Time', 'Activity', 'Duration'],
        reportData.exercise_schedule.map((i) => [i.time, i.activity, i.duration])
      )

      addHeading('PRECAUTIONS')
      addTable(
        ['No.', 'Precaution'],
        reportData.precautions.map((item, i) => [i + 1, item])
      )

      ensureSpace(20)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text(
        'Disclaimer: AI-generated health information only. This is a screening aid, not a confirmed diagnosis or a substitute for professional medical advice.',
        14,
        y,
        { maxWidth: pageWidth - 28 }
      )

      const total = doc.getNumberOfPages()
      for (let i = 1; i <= total; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(120)
        doc.text(`Page ${i} of ${total}`, pageWidth - 14, pageHeight - 10, {
          align: 'right',
        })
      }

      const fileName =
        pdfSafe(patientName).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') ||
        'patient'
      doc.save(`${fileName}_care_report.pdf`)
      setStatusMsg('PDF report downloaded successfully.')
    } catch (err) {
      console.error('PDF generation error:', err)
      setStatusMsg(`PDF generation failed: ${err.message}`)
    }
  }

  // ------------------------------------------------------ TEXT TO SPEECH
  function getPlainExplanation() {
    return explanation
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*[-*•]\s+/gm, '')
      .replace(/[#*_`>]/g, '')
  }

  function startSpeech() {
    if (!('speechSynthesis' in window)) {
      setStatusMsg('Text-to-speech is not supported by this browser.')
      return
    }

    const chunks = splitIntoChunks(getPlainExplanation())
    if (chunks.length === 0) return

    const synth = window.speechSynthesis
    synth.cancel()
    const runId = ++speechRunRef.current

    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk)

      if (index === 0) {
        utterance.onstart = () => {
          if (runId === speechRunRef.current) setSpeechStatus('speaking')
        }
      }

      if (index === chunks.length - 1) {
        utterance.onend = () => {
          if (runId === speechRunRef.current) setSpeechStatus('idle')
        }
      }

      utterance.onerror = (event) => {
        if (runId !== speechRunRef.current) return
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          setSpeechStatus('idle')
          setStatusMsg('Speech playback failed. Please try again.')
        }
      }

      synth.speak(utterance)
    })
  }

  function playExplanation() {
    if (!('speechSynthesis' in window)) {
      setStatusMsg('Text-to-speech is not supported by this browser.')
      return
    }

    const synth = window.speechSynthesis

    if (synth.paused) {
      synth.resume()
      setSpeechStatus('speaking')
      return
    }

    if (speechStatus === 'speaking') return
    startSpeech()
  }

  function pauseExplanation() {
    const synth = window.speechSynthesis
    if (synth.speaking && !synth.paused) {
      synth.pause()
      setSpeechStatus('paused')
    }
  }

  function stopExplanation() {
    speechRunRef.current += 1
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeechStatus('idle')
  }

  // ------------------------------------------------------ RENDER
  const action = recommendation ? normalizeAction(recommendation.care_action) : ''
  const recStyle = recommendation ? ACTION_STYLE[action]?.class || 'watch' : ''
  const conditionLabel = CONDITION_LABEL[action] || 'Not classified'

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
      <button className="btn" onClick={loadExistingPatient}>
        Load Patient
      </button>

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
      <button className="btn" onClick={createPatient}>
        Create Patient
      </button>

      {statusMsg && (
        <div className="status-note" role="status">
          {statusMsg}
        </div>
      )}

      {patientId && (
        <>
          <h2 className="section-label">02 · Vitals Reading</h2>
          <div className="grid-2">
            {Object.keys(vitals).map((field) => (
              <div className="field-row" key={field}>
                <label className="field-label">{field.replace(/_/g, ' ')}</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="field-input"
                  value={vitals[field]}
                  onChange={(e) => updateVital(field, e.target.value)}
                />
              </div>
            ))}
          </div>
          <button className="btn" onClick={submitVitals}>
            Get Recommendation
          </button>
        </>
      )}

      {recommendation && (
        <div className={`recommendation-card ${recStyle}`}>
          <p className="condition-tag">Screening result · not a diagnosis</p>
          <p className="condition-name">{conditionLabel}</p>
          <h3>{actionText(recommendation.care_action)}</h3>
          <p>
            Care action confidence:{' '}
            {(recommendation.confidence * 100).toFixed(1)}%
          </p>
          <small className="card-note">
            This confidence refers to the care-action model, not a confirmed
            disease diagnosis.
          </small>
        </div>
      )}

      {recommendation && (
        <button
          className="btn btn-secondary"
          onClick={getExplanation}
          disabled={explaining}
        >
          {explaining ? 'Generating explanation...' : 'Explain Condition & Diet Plan'}
        </button>
      )}

      {explanation && (
        <>
          <div className="speech-controls">
            <button
              className="btn btn-accent"
              onClick={playExplanation}
              disabled={speechStatus === 'speaking'}
            >
              {speechStatus === 'paused' ? '▶ Resume' : '▶ Play'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={pauseExplanation}
              disabled={speechStatus !== 'speaking'}
            >
              ⏸ Pause
            </button>
            <button className="btn btn-secondary" onClick={startSpeech}>
              ↻ Restart
            </button>
            <button
              className="btn btn-secondary"
              onClick={stopExplanation}
              disabled={speechStatus === 'idle'}
            >
              ⏹ Stop
            </button>
          </div>

          <p className="speech-status" aria-live="polite">
            {speechStatus === 'speaking' && 'Speaking…'}
            {speechStatus === 'paused' && 'Speech paused'}
            {speechStatus === 'idle' && 'Speech not playing'}
          </p>

          <div className="explanation-card">
            <ReactMarkdown>{explanation}</ReactMarkdown>
          </div>

          <button
            className="btn btn-pdf"
            onClick={downloadPDF}
            disabled={!reportData}
          >
            ⬇ Download Health Report (PDF)
          </button>

          <p className="speech-status">
            {reportData
              ? 'The PDF has your readings, keywords, diet timetable, exercise timetable and precautions.'
              : 'The AI did not return a complete timetable. Click "Explain Condition & Diet Plan" again to retry.'}
          </p>
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
            {history
              .slice()
              .reverse()
              .map((entry, i) => {
                const style = ACTION_STYLE[normalizeAction(entry.care_action)] || {}
                return (
                  <div
                    className="timeline-entry"
                    style={{ '--dot-color': style.dot }}
                    key={i}
                  >
                    <p className="timeline-time">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                    <p className="timeline-vitals">
                      glucose {entry.vitals.glucose} · bmi {entry.vitals.bmi} · bp{' '}
                      {entry.vitals.blood_pressure}
                    </p>
                    <p className="timeline-action">
                      {actionText(entry.care_action)} —{' '}
                      {(entry.confidence * 100).toFixed(1)}%
                    </p>
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