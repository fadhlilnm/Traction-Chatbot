# Voice AI Chatbot (Web, with Voice Command)

Proyek web **AI chatbot** dengan **voice command** (speech-to-text) dan **text-to-speech** langsung di browser.
- Frontend: React + Vite + TailwindCSS
- Backend: Node.js (Express) + Gemini **Responses API**
- STT/TTS: **Web Speech API** (browser). Disarankan Chrome desktop.

> Untuk jawaban AI sesungguhnya, set `GEMINI_API_KEY` di backend.

## 🚀 Cara Menjalankan (Dev)

### 1) Backend
```bash
cd backend
cp .env.example .env
# isi OPENAI_API_KEY=sk-...  (opsional; jika dikosongkan berjalan dalam demo mode)
npm install
npm run dev
```
Backend pada `http://localhost:3001`.

### 2) Frontend
Buka terminal baru:
```bash
cd frontend
npm install
npm run dev
```
Frontend pada `http://localhost:5173` (otomatis proxy ke backend).

## 📁 Struktur
```
voice-ai-chatbot-web/
  backend/
    server.js
    package.json
    .env.example
  frontend/
    index.html
    vite.config.js
    tailwind.config.js
    postcss.config.js
    package.json
    src/
      main.jsx
      App.jsx
      index.css
      components/
        Chat.jsx
        Message.jsx
        MicButton.jsx
      lib/
        speech.js
      services/
        api.js
```

## ⚙️ Konfigurasi
- Ubah model di frontend `src/services/api.js` (default `gemini-1.5-flash`) atau kirim melalui body ke `/api/chat`.
- Atur bahasa STT/TTS di dropdown (`id-ID` atau `en-US`).

## 🗣️ Catatan STT/TTS (Web Speech API)
- **SpeechRecognition** (STT) tidak tersedia di semua browser. Disarankan **Chrome desktop**.
- **SpeechSynthesis** (TTS) umumnya tersedia lintas platform, namun daftar suara bervariasi.

Referensi:
- MDN Web Speech API (STT & TTS)  
- OpenAI Responses API & Node SDK

## 🔒 Keamanan
Pada produksi, **jangan** memanggil OpenAI langsung dari browser. Selalu **proxy** via backend (seperti proyek ini).
Pastikan `OPENAI_API_KEY` disimpan sebagai secret di server/CI, bukan di repo.

## 📦 Build Produksi (opsional)
```bash
cd frontend && npm run build
# lalu deploy folder dist/ ke hosting statis
# backend tetap dijalankan di server (Express)
```

## 📝 Lisensi
MIT
