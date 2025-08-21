import React from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

export default function Message({ role, text }) {
  const isUser = role === 'user'

  const html = React.useMemo(() => {
    const raw = marked.parse(String(text ?? ''), { breaks: true })
    return DOMPurify.sanitize(raw)
  }, [text])

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-1`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow
        ${isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-slate-50 text-slate-900 rounded-bl-sm border'
        }`}
      >
        <div
          className={`prose prose-sm max-w-none 
            ${isUser ? 'prose-invert prose-p:text-white prose-strong:text-white prose-code:text-white' : ''}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
