import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, LogOut, User, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { cn } from '../../utils/cn';
import NewChatModal from '../../pages/NewChatModal';

export default function Sidebar() {
  const [chats, setChats] = useState([]);
  const [user, setUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [chatToDelete, setChatToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/chats').then(res => setChats(res.data.chats || [])).catch(() => {});
    
    api.get('/api/auth/me').then(res => {
      if (res.data?.user) setUser(res.data.user);
    }).catch(() => {});
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      // FIX: Changed from '/login' to '/' to route to the landing page
      navigate('/'); 
    }
  };

  const confirmDelete = async () => {
    if (!chatToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/chats/${chatToDelete}`);
      setChats(prevChats => prevChats.filter(chat => chat.chat_id !== chatToDelete));
      
      if (location.pathname === `/chat/${chatToDelete}`) {
        // FIX: Redirects to dashboard instead of the landing page (/)
        navigate('/dashboard'); 
      }
    } catch (error) {
      console.error("Failed to delete chat:", error);
      alert("Failed to delete chat. Please try again.");
    } finally {
      setIsDeleting(false);
      setChatToDelete(null); 
    }
  };

  return (
    <>
      <aside className="w-64 bg-zinc-50 flex flex-col h-full border-r border-zinc-200">
        <div className="p-4">
          <button onClick={() => setIsModalOpen(true)} className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors shadow-sm">
            <Plus size={16} /> New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <p className="text-xs font-semibold text-zinc-400 mb-3 px-2 uppercase tracking-wider">Recent</p>
          {chats.map((chat) => (
            <div 
              key={chat.chat_id} 
              className={cn(
                "group flex items-center justify-between px-2 py-1.5 rounded-md transition-colors", 
                location.pathname === `/chat/${chat.chat_id}` ? "bg-zinc-200/50" : "hover:bg-zinc-100"
              )}
            >
              <Link 
                to={`/chat/${chat.chat_id}`} 
                className={cn(
                  "flex items-center gap-2 flex-1 min-w-0 text-sm py-0.5",
                  location.pathname === `/chat/${chat.chat_id}` ? "text-zinc-900 font-medium" : "text-zinc-600"
                )}
              >
                <MessageSquare size={16} className="shrink-0" /> 
                <span className="truncate">{chat.title}</span>
              </Link>
              
              <button 
                onClick={() => setChatToDelete(chat.chat_id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all shrink-0"
                title="Delete Chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-zinc-200 flex justify-between items-center bg-white">
          <div className="flex items-center gap-2 min-w-0">
            {user?.picture_url ? (
              <img src={user.picture_url} alt="Profile" className="w-8 h-8 rounded-full border border-zinc-200 shrink-0" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 shrink-0">
                <User size={16} />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-zinc-700 truncate">{user?.full_name || 'Workspace'}</span>
              <span className="text-xs text-zinc-400 truncate max-w-[120px]">{user?.email || ''}</span>
            </div>
          </div>
          <button onClick={handleLogout} title="Logout" className="text-zinc-400 hover:text-zinc-900 shrink-0 ml-2">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <NewChatModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {chatToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">Delete Chat?</h3>
            <p className="text-sm text-zinc-500 mb-6">
              Are you sure you want to delete this chat? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setChatToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg flex items-center gap-2 transition-colors"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-pulse">Deleting...</span>
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}