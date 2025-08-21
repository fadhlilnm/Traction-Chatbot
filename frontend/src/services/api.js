const API_BASE = import.meta.env.VITE_API_URL || '';

export async function sendChat(messages, model = 'gemini-1.5-flash') {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model })
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || 'Request failed');
  }
  return res.json(); // { text }
}

export async function health() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}