import React from 'react'
import Chat from './components/Chat.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white shadow-xl rounded-2xl p-4 sm:p-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold">🎙️ Voice AI Chatbot</h1>
          <p className="text-slate-600 text-sm">Ucapkan perintah atau ketik pesan untuk berbicara dengan AI. (Disarankan Chrome)</p>
        </header>
        <Chat />
        <footer className="text-xs text-slate-500 mt-4">
          <p>Gunakan tanpa kunci API (demo) atau set <code>OPENAI_API_KEY</code> pada backend untuk jawaban AI sesungguhnya.</p>
        </footer>
      </div>
    </div>
  )
}