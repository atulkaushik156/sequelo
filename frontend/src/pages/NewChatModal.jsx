import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { pendingChatsMemory } from '../utils/secureStore'; // <-- IMPORT SECURE STORE

export default function NewChatModal({ isOpen, onClose }) {
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/api/chats/', { title: title || 'New Chat' });
      const newChatId = res.data.chat_id;
      
      // 1. Lock it in Local Storage
      localStorage.setItem(`pending_setup_${newChatId}`, 'true');
      
      // 2. Lock it in JavaScript RAM (Immune to DevTools Inspection)
      pendingChatsMemory.add(newChatId);
      
      toast.success('Chat created');
      onClose();
      setTitle('');
      navigate(`/chat/${newChatId}`, { state: { isNew: true } });
    } catch (err) {
      toast.error('Failed to create chat');
    } finally {
      setIsLoading(false);
    }
  };

  // ... (Keep the rest of the NewChatModal return statement exactly the same as before)
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/20 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-zinc-200"
        >
          <div className="flex justify-between items-center p-5 border-b border-zinc-100">
            <h2 className="font-semibold text-zinc-900">Create New Chat</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5">
            <label className="block text-sm font-medium text-zinc-700 mb-2">Chat Title</label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Financial Analysis"
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isLoading}
                className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50 flex items-center"
              >
                {isLoading && <Loader2 size={16} className="animate-spin mr-2" />}
                Create & Continue
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}