import React from 'react'

export default function MicButton({ listening, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`px-3 py-2 rounded-full font-medium shadow
       ${listening ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'}`}
      title={listening ? 'Berhenti mendengarkan' : 'Mulai bicara'}
      aria-pressed={listening}
    >
      {listening ? '■ Stop' : '🎤 Speak'}
    </button>
  )
}