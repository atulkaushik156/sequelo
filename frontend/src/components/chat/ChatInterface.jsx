import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export default function ChatInterface({ chatId }) {
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Schema finalized successfully! What would you like to know about your data?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to the newest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post(`/api/chats/${chatId}/messages`, {
        message: userText
      });
      
      setMessages((prev) => [
        ...prev, 
        { role: 'ai', content: response.data.reply }
      ]);
    } catch (err) {
      console.error("Chat Error:", err);
      const errorMsg = err.response?.data?.detail || "Failed to connect to the AI.";
      setMessages((prev) => [
        ...prev, 
        { role: 'system', content: `Error: ${errorMsg}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 font-sans">
      {/* Chat Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center shadow-sm">
        <h2 className="text-xl font-semibold text-gray-800">AI Data Assistant</h2>
        <span className="ml-3 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
          Schema Active
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[75%] px-5 py-3 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-black text-white rounded-br-none' 
                  : msg.role === 'system'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-white text-gray-800 border border-gray-200 shadow-sm rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl rounded-bl-none px-5 py-4 text-gray-500 text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t p-4">
        <form 
          onSubmit={handleSend} 
          className="max-w-4xl mx-auto flex gap-3 relative"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your data..."
            className="flex-1 px-4 py-3 bg-gray-100 border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-gray-200 rounded-lg outline-none transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isLoading ? 'Thinking...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}