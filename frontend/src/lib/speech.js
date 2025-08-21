// Simple helpers for Web Speech API (STT + TTS)
export function speak(text, lang = 'id-ID') {
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  // Queue-clearing: stop previous speech if still speaking
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  speechSynthesis.speak(utter);
}

export function getRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}