import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { extractPdf, extractPptx, ingestDocument, searchTopK } from './rag_file.js';

// --- RAG routing config (bisa diubah via .env) ---
const RAG_TOP_K = Number(process.env.RAG_TOP_K ?? 5)
const RAG_MIN_SCORE = Number(process.env.RAG_MIN_SCORE ?? 0.35)   // 0..1 (cosine)
const RAG_HYBRID = (process.env.RAG_HYBRID ?? 'true').toLowerCase() === 'true'


const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// --- Inisialisasi Gemini ---
const hasKey = !!process.env.GOOGLE_API_KEY;
const genAI = hasKey ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
const upload = multer({ dest: 'uploads/' }) // folder uploads/ akan dibuat otomatis


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

app.post('/api/ingest', upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error: 'No file' })

    const ext = path.extname(file.originalname).toLowerCase()
    let text = ''
    if (ext === '.pdf') text = await extractPdf(file.path)
    else if (ext === '.pptx') text = await extractPptx(file.path)
    else return res.status(400).json({ error: 'Format harus .pdf atau .pptx' })

    const docId = `${Date.now()}_${file.originalname}`
    const { added } = await ingestDocument({
      docId,
      text,
      metadata: { source: file.originalname }
    })

    res.json({ ok: true, docId, chunks: added })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  } finally {
    try { await fs.unlink(req.file?.path) } catch {}
  }
})


// --- Endpoint chat kompatibel dengan frontend ---
app.post('/api/chat', async (req, res) => {
  try {
    const { messages = [], model = 'gemini-1.5-flash' } = req.body || {}

    const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content?.toString() ?? ''
    if (!lastUser.trim()) return res.json({ text: 'Silakan kirim pertanyaan.' })

    const gModel = genAI.getGenerativeModel({ model })

    // ---- 1) RAG: cari konteks top-K
    const top = await searchTopK(lastUser, RAG_TOP_K)
    const best = top[0]?.score ?? 0

    // ---- 2) Siapkan history (untuk dua jalur)
    const history = (messages || [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content ?? '') }] }))
      .filter(x => x.parts[0].text.trim().length > 0)
    while (history.length && history[0].role !== 'user') history.shift()
    if (history.length > 20) history.splice(0, history.length - 20)

    // ---- 3) ROUTING: fallback ke general jika skor rendah
    if (RAG_HYBRID && best < RAG_MIN_SCORE) {
      // Fallback: jawaban umum Gemini (tanpa konteks internal)
      const chat = gModel.startChat({ history })
      const result = await chat.sendMessage(lastUser)
      const text = result.response.text() || 'Maaf, tidak ada keluaran.'
      return res.json({
        text,
        mode: 'general',
        bestScore: +best.toFixed(3),
        threshold: RAG_MIN_SCORE,
        sources: []
      })
    }

    // ---- 4) Jalur RAG: gunakan konteks internal
    const context = top
      .map((r, i) => `[#${i + 1} s=${r.score.toFixed(3)} ${r.metadata?.source ?? ''}]\n${r.content}`)
      .join('\n\n')

    const systemPrompt =
`Anda adalah asisten perusahaan. Utamakan fakta dari "KONTEKS" di bawah.
Jika informasi pada konteks tidak lengkap, Anda boleh menambahkan pengetahuan umum SEPANJANG tidak bertentangan dengan konteks. Hindari mengarang.
Jawab ringkas, jelas, dan dalam bahasa Indonesia.`

    const userPrompt =
`Pertanyaan: ${lastUser}

=== KONTEKS (top-${RAG_TOP_K}) ===
${context}`

    const chat = gModel.startChat({
      history: [...history, { role: 'user', parts: [{ text: systemPrompt }] }]
    })
    const result = await chat.sendMessage(userPrompt)
    const text = result.response.text() || 'Maaf, tidak ada keluaran.'

    return res.json({
      text,
      mode: 'rag',
      bestScore: +best.toFixed(3),
      threshold: RAG_MIN_SCORE,
      sources: top.map(r => ({
        score: +r.score.toFixed(3),
        source: r.metadata?.source,
        snippet: r.content.slice(0, 160) + (r.content.length > 160 ? '…' : '')
      }))
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message || String(err) })
  }
})


app.get('/', (_req, res) => {
  res.send('Voice AI Chatbot backend (Gemini) is running. Try GET /health or POST /api/chat');
});

app.listen(PORT, () => {
  console.log(`✅ Backend (Gemini) running on http://localhost:${PORT}`);
  if (!hasKey) {
    console.log('ℹ️ GOOGLE_API_KEY belum diset. Backend berjalan dalam "Demo mode".');
  }
});