import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- Inisialisasi Gemini ---
const hasKey = !!process.env.GOOGLE_API_KEY;
const genAI = hasKey ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;

// --- Util: bangun history yang valid untuk Gemini ---
// - Ambil hanya role 'user' & 'assistant'
// - Map: assistant -> 'model', user -> 'user'
// - Pastikan item pertama adalah 'user' (kalau bukan, buang yang di depan)
// - Batasi panjang history biar efisien
function buildGeminiHistory(messages, maxItems = 20) {
  const filtered = (messages || [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content ?? '').slice(0, 8000) }]
    }))
    .filter(x => x.parts[0].text.trim().length > 0);

  // Pastikan pesan pertama = user
  while (filtered.length && filtered[0].role !== 'user') {
    filtered.shift();
  }

  // Potong agar tidak terlalu panjang
  if (filtered.length > maxItems) {
    // Ambil bagian akhir (paling baru) tetapi tetap menjaga urutan
    return filtered.slice(-maxItems);
  }
  return filtered;
}

// --- Health check ---
app.get('/health', (_req, res) => {
  res.json({ ok: true, hasKey, provider: 'gemini' });
});

// --- Endpoint chat kompatibel dengan frontend ---
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], model = 'gemini-1.5-flash' } = req.body || {};

    if (!hasKey) {
      const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
      return res.json({
        text: `🤖 (Demo mode - Gemini) Anda berkata: "${lastUser}". Tambahkan GOOGLE_API_KEY di backend untuk jawaban AI.`
      });
    }

    const gModel = genAI.getGenerativeModel({ model });

    // Build riwayat yang valid untuk Gemini
    const history = buildGeminiHistory(messages);

    // Ambil pesan user terakhir (fallback kalau history kosong)
    const lastUserMsg =
      [...messages].reverse().find(m => m.role === 'user')?.content?.toString() ?? '';

    if (!lastUserMsg.trim()) {
      return res.json({ text: 'Silakan ketik atau ucapkan pertanyaan Anda.' });
    }

    // Mulai sesi chat dengan history, lalu kirim pesan terakhir user
    const chat = gModel.startChat({ history });
    const result = await chat.sendMessage(lastUserMsg);
    const text = result.response.text() || 'Maaf, tidak ada keluaran.';

    return res.json({ text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

app.get('/', (_req, res) => {
  res.send('Voice AI Chatbot backend (Gemini) is running. Try GET /health or POST /api/chat');
});

app.listen(PORT, () => {
  console.log(`✅ Backend (Gemini) running on http://localhost:${PORT}`);
  if (!hasKey) {
    console.log('ℹ️ GOOGLE_API_KEY belum diset. Backend berjalan dalam "Demo mode".');
  }
});