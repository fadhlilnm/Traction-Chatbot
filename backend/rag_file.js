import fs from 'node:fs/promises'
import path from 'node:path'
import unzipper from 'unzipper'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { GoogleGenerativeAI } from '@google/generative-ai'

const STORE_PATH = path.resolve('rag_store.json')
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

// ---------- Store helpers ----------
async function loadStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { chunks: [] }
  }
}
async function saveStore(store) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store), 'utf8')
}

// ---------- Embedding ----------
export async function embedText(raw) {
    // Normalisasi & batasi panjang biar aman (±8k chars ~ aman untuk embedding)
    let text = String(raw ?? '').replace(/\u0000/g, ' ').trim()
    if (text.length > 8000) text = text.slice(0, 8000)
  
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  
    // >>> Wajib: kirim sebagai Content object
    const res = await model.embedContent({
      content: { parts: [{ text }] }
    })
  
    return res.embedding.values
}

// ---------- Extractors ----------
export async function extractPdf(filePath) {
    // Konversi Buffer -> Uint8Array (perbaikan error)
    const data = new Uint8Array(await fs.readFile(filePath))
    const doc = await pdfjs.getDocument({ data }).promise
  
    let out = ''
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      out += content.items.map(i => ('str' in i ? i.str : '')).join(' ') + '\n'
    }
    return out
}

export async function extractPptx(filePath) {
    // Buka arsip .pptx tanpa stream
    const dir = await unzipper.Open.file(filePath)
  
    // Ambil semua slide, urutkan (slide1.xml, slide2.xml, ...)
    const slides = dir.files
      .filter(f => /^ppt\/slides\/slide\d+\.xml$/i.test(f.path))
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
  
    let text = ''
    for (const f of slides) {
      const buf = await f.buffer()               // <— langsung buffer, bukan stream
      const xml = buf.toString('utf8')
  
      // Tarik teks dari <a:t>…</a:t>
      const tokens = []
      xml.replace(/<a:t>([\s\S]*?)<\/a:t>/g, (_, t) => {
        tokens.push(t.replace(/\s+/g, ' ').trim())
        return ''
      })
      text += tokens.join(' ') + '\n'
    }
  
    return text.trim()
  }

// ---------- Chunking ----------
export function chunkText(txt, maxWords = 700) {
  const words = String(txt || '').split(/\s+/)
  const chunks = []
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '))
  }
  return chunks
}

// ---------- Ingest: tambah dokumen ke store.json ----------
export async function ingestDocument({ docId, text, metadata = {} }) {
  const store = await loadStore()
  const chunks = chunkText(text, 700)
  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i]
    const emb = await embedText(content)
    store.chunks.push({
      id: `${docId}-${i}`,
      doc_id: docId,
      chunk_index: i,
      content,
      metadata,
      embedding: emb
    })
  }
  await saveStore(store)
  return { added: chunks.length }
}

// ---------- Search top-k ----------
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9)
}

export async function searchTopK(queryText, k = 5) {
  const qEmb = await embedText(queryText)
  const store = await loadStore()
  const scored = store.chunks.map(ch => ({
    ...ch,
    score: cosine(qEmb, ch.embedding)
  }))
  scored.sort((x, y) => y.score - x.score)
  return scored.slice(0, k)
}
