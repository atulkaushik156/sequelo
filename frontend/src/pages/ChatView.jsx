import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import FileUpload from '../components/chat/FileUpload';
import Wizard from '../components/chat/Wizard';
import ChatInterface from '../components/chat/ChatInterface';

export default function ChatView() {
  const { chatId } = useParams(); 
  const [step, setStep] = useState(1);

  // Automatically reset to the Upload step whenever a new chat is selected
  useEffect(() => {
    setStep(1);
  }, [chatId]);

  if (!chatId) {
    return <div className="p-8 text-center text-red-600">Error: No Chat ID found in URL.</div>;
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