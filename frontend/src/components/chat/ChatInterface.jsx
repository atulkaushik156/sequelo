import { useState, useEffect } from 'react';
import api from '../../api/axios';

export default function ChatInterface({ chatId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    api.get(`/api/chats/${chatId}/messages`).then(res => setMessages(res.data.messages || []));
  }, [chatId]);

  const handleSend = (e) => {
    e.preventDefault();
    if(!input) return;
    setMessages(p => [...p, { role: 'user', content: input }]);
    setInput('');
    setTimeout(() => {
      setMessages(p => [...p, { role: 'assistant', content: "MOCK: Here is the SQL result!" }]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full relative p-4 pb-24">
      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`p-3 rounded-lg max-w-[80%] ${m.role === 'user' ? 'bg-zinc-100 ml-auto' : 'border'}`}>
            {m.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="absolute bottom-4 left-4 right-4">
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask your database..." className="w-full px-4 py-3 border rounded-xl shadow-sm" />
      </form>
    </div>
  );
}