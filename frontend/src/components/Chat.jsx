import React, { useEffect, useRef, useState } from "react";
import Message from "./Message.jsx";
import { sendChat, health } from "../services/api.js";
import { getRecognition, speak } from "../lib/speech.js";

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Halo! Ketik pesan di bawah." },
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState({ hasKey: false });

  const listRef = useRef(null);        // container chat (auto scroll)
  const fileRef = useRef(null);        // hidden file input
  const recRef = useRef(null);         // Web Speech
  const interimRef = useRef("");       // untuk menampung interim STT

  const TYPE_SPEED = 14;               // ms per karakter (kecilkan utk lebih cepat)
  const lang = "id-ID";                // bahasa TTS

  useEffect(() => {
    health().then(setStatus).catch(() => {});
  }, []);

  // ---- util scroll ke bawah
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    });
  };
  useEffect(() => { scrollToBottom(); }, [messages]);

  // ---- STT init
  const ensureRecognition = () => {
    if (!recRef.current) {
      const rec = getRecognition();
      if (!rec) return null;
      rec.lang = "id-ID";
      rec.onstart = () => { interimRef.current = ""; };
      rec.onresult = (e) => {
        let finalTranscript = "";
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalTranscript += transcript;
          else interimRef.current = transcript;
        }
        if (finalTranscript.trim()) handleSend(finalTranscript.trim());
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recRef.current = rec;
    }
    return recRef.current;
  };

  const toggleMic = () => {
    const rec = ensureRecognition();
    if (!rec) {
      alert("Browser belum mendukung SpeechRecognition. Coba Chrome desktop.");
      return;
    }
    if (listening) {
      try { rec.stop(); } catch {}
      setListening(false);
    } else {
      try { rec.start(); } catch {}
      setListening(true);
    }
  };

  // ---- efek ketik per karakter
  const typeAssistant = (fullText, onDone) => {
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setMessages((prev) => {
        if (!prev.length) return prev;
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last.role !== "assistant") return prev;
        copy[copy.length - 1] = { ...last, content: fullText.slice(0, i) };
        return copy;
      });
      scrollToBottom();
      if (i >= fullText.length) {
        clearInterval(timer);
        onDone?.();
      }
    }, TYPE_SPEED);
  };

  // ---- kirim pesan
  const handleSend = async (text) => {
    const content = (text ?? input).trim();
    if (!content) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    scrollToBottom();

    try {
      const { text: reply } = await sendChat(next);
      const finalText = String(reply || "");
      typeAssistant(finalText, () => {
        if (finalText) speak(finalText, lang);
      });
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Terjadi kesalahan: ${e.message}` },
      ]);
      scrollToBottom();
    }
  };

  // ---- upload PDF/PPTX via tombol +
  const pickFile = () => fileRef.current?.click();
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset
    if (!file) return;
    // tampilkan status kecil
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: `Mengunggah “${file.name}”…` },
    ]);
    scrollToBottom();

    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/ingest", { method: "POST", body: fd });
      const data = await resp.json();
      const txt = resp.ok
        ? `✅ Dokumen di-ingest: ${data.docId} (chunks: ${data.chunks}).`
        : `❌ Gagal ingest: ${data.error || resp.statusText}`;
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: txt };
        return copy;
      });
      scrollToBottom();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Gagal ingest: ${err.message}` },
      ]);
      scrollToBottom();
    }
  };

  // ---- render
  return (
    <div className="flex flex-col gap-4">
      {/* daftar pesan */}
      <div ref={listRef} className="h-[50vh] overflow-y-auto pr-1 chat-scroll">
        {messages.map((m, i) => (
          <Message key={i} role={m.role} text={m.content} />
        ))}
      </div>

      {/* input bar model "Ask anything" tanpa tombol Kirim */}
      <div className="w-full">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-2 shadow-sm">
          {/* tombol + */}
          <button
            onClick={pickFile}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-slate-100 transition"
            title="Tambahkan dokumen (.pdf/.pptx)"
          >
            {/* plus icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          {/* input */}
          <input
            className="flex-1 bg-transparent outline-none text-[15px] placeholder-slate-400"
            placeholder="Ask anything"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          />

          {/* mic button di kanan */}
          <button
            onClick={toggleMic}
            className={`flex items-center justify-center w-9 h-9 rounded-full transition
                       ${listening ? "bg-red-50 text-red-600" : "hover:bg-slate-100"}`}
            title={listening ? "Stop" : "Speak"}
          >
            {/* mic icon */}
            {!listening ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              // tampilkan indikator "gelombang" sederhana saat listening
              <svg width="18" height="18" viewBox="0 0 24 24" className="animate-pulse" fill="none">
                <rect x="3" y="6" width="3" height="12" rx="1.5" fill="currentColor"/>
                <rect x="9" y="3" width="3" height="18" rx="1.5" fill="currentColor"/>
                <rect x="15" y="6" width="3" height="12" rx="1.5" fill="currentColor"/>
              </svg>
            )}
          </button>
        </div>

        {/* hidden input untuk file */}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.pptx"
          hidden
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
