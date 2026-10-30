import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatInterface({ chatId, token }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]); 
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchFiles = async () => {
    if (!chatId) return;
    try {
      const response = await fetch(`/api/chats/${chatId}/files`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.files) setUploadedFiles(data.files);
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  };

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!chatId) return;
      try {
        const response = await fetch(`/api/chats/${chatId}/messages`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          }
        }
      } catch (error) {
        console.error("Failed to fetch chat history:", error);
      }
    };
    fetchChatHistory();
    fetchFiles();
  }, [chatId, token]);

  const handleDownload = async (fileId, fileName) => {
    try {
      const response = await fetch(`/api/chats/${chatId}/files/${fileId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        alert("Failed to generate download link.");
        return;
      }
      const data = await response.json();
      if (data.download_url) {
        const a = document.createElement('a');
        a.href = data.download_url;
        a.download = fileName; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      alert("An error occurred while downloading the file.");
    }
  };

  // ==========================================
  // FRONTEND VALIDATION & UPLOAD LOGIC
  // ==========================================
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileName = file.name.toLowerCase();
    
    // STRICT FRONTEND VALIDATION
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) {
      alert("Please use file format of CSV or Excel only.");
      e.target.value = ""; // Reset input
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("files", file);
    formData.append("chat_id", chatId);

    try {
      const response = await fetch(`/api/upload_documents`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        await fetchFiles(); // Refresh file list at the top
        alert("File uploaded successfully.");
      } else {
        const errorData = await response.json();
        alert(errorData.detail || "Failed to upload file.");
      }
    } catch (error) {
      alert("A system error occurred during upload.");
    } finally {
      setIsUploading(false);
      e.target.value = ""; 
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = inputValue;
    setInputValue("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMsg })
      });

      if (!response.ok) throw new Error("Failed to send message");

      setMessages(prev => [...prev, { role: 'assistant', content: '', sql: '' }]);
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        const cleanContent = data.reply || data.content || "No response generated.";
        const generatedSql = data.generated_sql || "";
        
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = cleanContent;
          newMessages[newMessages.length - 1].sql = generatedSql;
          return newMessages;
        });
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let aiResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          aiResponse += decoder.decode(value, { stream: true });
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = aiResponse;
            return newMessages;
          });
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, a system error occurred while processing your request.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 font-sans">
      
      {uploadedFiles.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto bg-white border-b border-gray-200 px-6 py-3 shadow-sm shrink-0">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0">
            Active Datasets:
          </span>
          {uploadedFiles.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 rounded-md pl-3 pr-1.5 py-1.5 shrink-0 hover:bg-blue-50 transition-colors">
              <span className="text-sm font-medium text-blue-900 truncate max-w-[200px]">
                {file.file_name}
              </span>
              <button 
                onClick={() => handleDownload(file.file_id, file.file_name)}
                title="Download Dataset"
                className="bg-white text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 p-1.5 rounded shadow-sm transition-all flex items-center justify-center cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[95%] md:max-w-4xl overflow-x-auto rounded-2xl p-5 shadow-sm ${
                msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
              }`}>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="flex flex-col gap-3 min-w-0">
                    <div className="prose prose-sm md:prose-base max-w-none text-gray-800
                      prose-tables:w-full prose-tables:border-collapse prose-tables:my-4 prose-tables:text-sm
                      prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-th:text-gray-700 prose-th:whitespace-nowrap
                      prose-td:border prose-td:border-gray-200 prose-td:px-4 prose-td:py-2.5 prose-td:whitespace-nowrap
                      prose-tr:nth-child(even):bg-gray-50 hover:prose-tr:bg-blue-50/50
                      prose-p:leading-relaxed prose-p:my-2
                      prose-strong:text-gray-900 prose-strong:font-semibold
                    ">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.sql && (
                      <details className="mt-2 text-xs group">
                        <summary className="cursor-pointer text-gray-400 hover:text-blue-600 font-medium select-none transition-colors">
                          View Executed SQL
                        </summary>
                        <div className="mt-2 p-3 bg-gray-900 text-green-400 rounded-lg overflow-x-auto font-mono whitespace-pre-wrap border border-gray-800">
                          {msg.sql}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 text-gray-500 rounded-2xl rounded-bl-none p-4 shadow-sm flex gap-1.5 items-center">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>

        <div className="p-4 bg-white border-t border-gray-200 shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto relative items-center">
            
            {/* UPLOAD BUTTON INTEGRATED INTO INPUT BAR */}
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload} 
              accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current.click()}
              disabled={isUploading}
              title="Upload CSV or Excel"
              className="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center shrink-0 border border-transparent hover:border-blue-200"
            >
              {isUploading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
              )}
            </button>

            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 border border-gray-300 rounded-xl py-3.5 pl-4 pr-32 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all text-gray-800"
              placeholder="Ask a question about your data..."
              disabled={isTyping}
            />
            <button 
              type="submit" 
              disabled={isTyping || !inputValue.trim()}
              className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
            >
              Send
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </form>
          <div className="text-center mt-2">
            <span className="text-xs text-gray-400">AI can make mistakes. Verify important data.</span>
          </div>
        </div>
      </div>
    </div>
  );
}