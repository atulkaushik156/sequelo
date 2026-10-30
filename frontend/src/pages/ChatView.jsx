import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios'; // <-- FIX: Uses custom axios instance with cookies
import FileUpload from '../components/chat/FileUpload';
import Wizard from '../components/chat/Wizard';
import ChatInterface from '../components/chat/ChatInterface';

export default function ChatView() {
  const { chatId } = useParams(); 
  const [step, setStep] = useState(1);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkChatStatus = async () => {
      setIsChecking(true);
      try {
        const response = await api.get(`/api/chats/${chatId}/status`); // <-- FIX: using 'api'
        setStep(response.data.step);
      } catch (err) {
        console.error("Failed to fetch chat status:", err);
        setStep(1); 
      } finally {
        setIsChecking(false);
      }
    };

    if (chatId) {
      checkChatStatus();
    }
  }, [chatId]);

  if (!chatId) {
    return <div className="p-8 text-center text-red-600">Error: No Chat ID found in URL.</div>;
  }

  if (isChecking) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 font-medium animate-pulse">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-white flex flex-col">
      {step === 1 && (
        <FileUpload 
          chatId={chatId} 
          onComplete={() => setStep(2)} 
        />
      )}

      {step === 2 && (
        <Wizard 
          chatId={chatId} 
          onContinue={() => setStep(3)} 
        />
      )}

      {step === 3 && (
        <ChatInterface 
          chatId={chatId} 
        />
      )}
    </div>
  );
}