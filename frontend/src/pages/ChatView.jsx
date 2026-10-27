import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import FileUpload from '../components/chat/FileUpload';
import Wizard from '../components/chat/Wizard';
import ChatInterface from '../components/chat/ChatInterface';
import { pendingChatsMemory } from '../utils/secureStore'; // <-- IMPORT SECURE STORE

export default function ChatView() {
  const { chat_id } = useParams();
  const location = useLocation();
  const [step, setStep] = useState(3);

  // The Anti-Tamper Enforcement Logic
  useEffect(() => {
    const enforceSecurity = () => {
      const isPendingStorage = localStorage.getItem(`pending_setup_${chat_id}`);
      const isPendingMemory = pendingChatsMemory.has(chat_id);

      // TAMPER DETECTED: They deleted the local storage key, but RAM remembers!
      if (isPendingMemory && !isPendingStorage) {
        console.warn("Security check failed: Restoring required upload state.");
        localStorage.setItem(`pending_setup_${chat_id}`, 'true'); // Put it back
        setStep(1); // Force them back to upload
        return;
      }

      // Normal check
      if (isPendingMemory || isPendingStorage === 'true' || location.state?.isNew) {
        setStep(1);
      } else {
        setStep(3);
      }
    };

    // Run the check immediately on load
    enforceSecurity();

    // ACTIVE DEFENSE: Listen for the exact moment they change Local Storage in DevTools
    const handleStorageChange = (e) => {
      if (e.key === `pending_setup_${chat_id}`) {
        enforceSecurity(); // Re-evaluate immediately if they tamper with it
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [chat_id, location.state]);

  const finishSetup = () => {
    // Official unlock: Only triggered when the API upload is successful
    localStorage.removeItem(`pending_setup_${chat_id}`);
    pendingChatsMemory.delete(chat_id);
    setStep(3);
  };

  return (
    <div className="flex-1 h-full w-full bg-white relative">
      {step === 1 && (
        <FileUpload chatId={chat_id} onComplete={() => setStep(2)} />
      )}
      {step === 2 && (
        <Wizard onContinue={finishSetup} />
      )}
      {step === 3 && (
        <ChatInterface chatId={chat_id} />
      )}
    </div>
  );
}