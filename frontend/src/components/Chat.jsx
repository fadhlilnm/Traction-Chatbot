import React, { useEffect, useMemo, useRef, useState } from 'react'
import Message from './Message.jsx'
import MicButton from './MicButton.jsx'
import { getRecognition, speak } from '../lib/speech.js'
import { sendChat, health } from '../services/api.js'

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Halo! Tekan 🎤 untuk mulai bicara, atau ketik pesan di bawah.' }
  ])
  const [input, setInput] = useState('')
  const [lang, setLang] = useState('id-ID')
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState({ hasKey: false })
  const recRef = useRef(null)
  const interimRef = useRef('')

  useEffect(() => {
    health().then(setStatus).catch(()=>{})
  }, [])

  const supportsSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  const supportsTTS = !!window.speechSynthesis

  // Initialize recognition on first use
  const ensureRecognition = () => {
    if (!recRef.current) {
      const rec = getRecognition()
      if (!rec) return null
      rec.lang = lang
      rec.onstart = () => {
        interimRef.current = ''
      }
      rec.onresult = (e) => {
        let finalTranscript = ''
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          const transcript = e.results[i][0].transcript
          if (e.results[i].isFinal) finalTranscript += transcript
          else interimRef.current = transcript // show interim in input
        }
        // if final transcript exists, send it
        if (finalTranscript.trim()) {
          setInput(finalTranscript.trim())
          handleSend(finalTranscript.trim())
        }
      }
      rec.onerror = () => setListening(false)
      rec.onend = () => setListening(false)
      recRef.current = rec
    }
    recRef.current.lang = lang
    return recRef.current
  }

  const handleToggleMic = () => {
    if (!supportsSTT) return alert('Browser Anda belum mendukung SpeechRecognition. Coba Chrome di desktop.')
    const rec = ensureRecognition()
    if (!rec) return
    if (listening) {
      try { rec.stop() } catch(e) {}
      setListening(false)
    } else {
      try { rec.start() } catch(e) {}
      setListening(true)
    }
  }

  const handleSend = async (text=undefined) => {
    const content = (text ?? input).trim()
    if (!content) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')

    try {
      const { text: reply } = await sendChat(next)
      const finalList = [...next, { role: 'assistant', content: reply }]
      setMessages(finalList)
      if (supportsTTS) speak(reply, lang)
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `Terjadi kesalahan: ${e.message}` }])
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-600">
          STT: {supportsSTT ? '✅' : '❌'} · TTS: {supportsTTS ? '✅' : '❌'} · API Key: {status.hasKey ? '✅' : '❌ Demo'}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border rounded-lg px-2 py-1 text-sm"
            value={lang}
            onChange={e => setLang(e.target.value)}
            title="Bahasa pengenal & suara"
          >
            <option value="id-ID">Indonesia (id-ID)</option>
            <option value="en-US">English (en-US)</option>
          </select>
          <MicButton listening={listening} onToggle={handleToggleMic} />
        </div>
      </div>

      <div className="h-[50vh] overflow-y-auto pr-1 scrollbar-thin">
        {messages.map((m, idx) => <Message key={idx} role={m.role} text={m.content} />)}
        {listening && <div className="text-xs text-slate-500 italic px-1">Mendengarkan... {interimRef.current}</div>}
      </div>

      <div className="flex items-center gap-2">
        <input
          className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Ketik pesan... lalu Enter"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
        />
        <button
          onClick={() => handleSend()}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm shadow hover:bg-blue-700"
        >
          Kirim
        </button>
      </div>
    </div>
  )
}