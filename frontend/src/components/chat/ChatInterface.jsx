import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatInterface({ chatId }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]); 
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(() => { scrollToBottom(); }, [messages]);

  const fetchFiles = async () => {
    if (!chatId) return;
    try {
      const response = await fetch(`/api/chats/${chatId}/files`, { credentials: 'include' });
      if (response.ok) { const data = await response.json(); if (data.files) setUploadedFiles(data.files); }
    } catch (error) { console.error("Failed to fetch files"); }
  };

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!chatId) return;
      try {
        const response = await fetch(`/api/chats/${chatId}/messages`, { method: 'GET', credentials: 'include' });
        if (response.ok) { const data = await response.json(); if (data.messages) setMessages(data.messages); }
      } catch (error) { console.error("Failed history"); }
    };
    fetchChatHistory();
    fetchFiles();
  }, [chatId]);

  const handleDownload = async (fileId, fileName) => {
    try {
      const response = await fetch(`/api/chats/${chatId}/files/${fileId}/download`, { credentials: 'include' });
      if (!response.ok) return alert("Failed link.");
      const data = await response.json();
      if (data.download_url) {
        const a = document.createElement('a');
        a.href = data.download_url; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    } catch (error) { alert("Download error."); }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.xlsx')) return alert("CSV or Excel only.");
    
    setIsUploading(true);
    const formData = new FormData(); formData.append("files", file); formData.append("chat_id", chatId);

    try {
      // EXPLICIT PATH: /api/upload_documents
      const response = await fetch(`/api/upload_documents`, { method: 'POST', credentials: 'include', body: formData });
      if (response.ok) { await fetchFiles(); alert("Success."); } 
      else { const err = await response.json(); alert(err.detail || "Failed."); }
    } catch (error) { alert("Error."); } 
    finally { setIsUploading(false); e.target.value = ""; }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const userMsg = inputValue; setInputValue("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]); setIsTyping(true);

    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ message: userMsg })
      });
      if (!response.ok) throw new Error("Failed");
      
      const contentType = response.headers.get("content-type");
      setMessages(prev => [...prev, { role: 'assistant', content: '', sql: '' }]);
      
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        setMessages(prev => { const n = [...prev]; n[n.length - 1].content = data.reply || data.content || "Done."; n[n.length - 1].sql = data.generated_sql || ""; return n; });
      }
    } catch (error) { setMessages(prev => [...prev, { role: 'assistant', content: 'System error.' }]); } 
    finally { setIsTyping(false); }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 font-sans">
      {uploadedFiles.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto bg-white border-b border-gray-200 px-6 py-3 shadow-sm shrink-0">
          <span className="text-xs font-bold text-gray-500 uppercase shrink-0">Datasets:</span>
          {uploadedFiles.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 rounded-md pl-3 pr-1.5 py-1.5 shrink-0">
              <span className="text-sm font-medium text-blue-900 truncate max-w-[200px]">{file.file_name}</span>
              <button onClick={() => handleDownload(file.file_id, file.file_name)} className="bg-white text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 p-1.5 rounded shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[95%] md:max-w-4xl overflow-x-auto rounded-2xl p-5 shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'}`}>
                {msg.role === 'user' ? <p className="whitespace-pre-wrap">{msg.content}</p> : (
                  <div className="flex flex-col gap-3 min-w-0">
                    <div className="prose prose-sm md:prose-base max-w-none text-gray-800"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                    {msg.sql && (
                      <details className="mt-2 text-xs group"><summary className="cursor-pointer text-gray-400 hover:text-blue-600 font-medium select-none">View SQL</summary><div className="mt-2 p-3 bg-gray-900 text-green-400 rounded-lg overflow-x-auto font-mono whitespace-pre-wrap">{msg.sql}</div></details>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (<div className="flex justify-start"><div className="bg-white border border-gray-200 p-4 rounded-2xl rounded-bl-none shadow-sm text-gray-500 animate-pulse">Typing...</div></div>)}
          <div ref={messagesEndRef} className="h-2" />
        </div>

        <div className="p-4 bg-white border-t border-gray-200 shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto relative items-center">
            
            <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="flex-1 border border-gray-300 rounded-xl py-3.5 pl-4 pr-32 focus:outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="Ask a question..." disabled={isTyping} />
            <button type="submit" disabled={isTyping || !inputValue.trim()} className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white px-6 rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2">Send <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg></button>
          </form>
        </div>
      </div>
    </div>
  );
}