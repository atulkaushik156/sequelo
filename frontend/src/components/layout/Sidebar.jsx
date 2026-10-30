import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, LogOut, User } from 'lucide-react';
import api from '../../api/axios';
import { cn } from '../../utils/cn';
import NewChatModal from '../../pages/NewChatModal';

export default function Sidebar() {
  const [chats, setChats] = useState([]);
  const [user, setUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Fetch recent chats
    api.get('/api/chats/').then(res => setChats(res.data.chats || [])).catch(() => {});
    
    // 2. Fetch current Google authenticated user
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
      // Always redirect to login, even if the backend session was already expired
      navigate('/login');
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
            <Link key={chat.chat_id} to={`/chat/${chat.chat_id}`} className={cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors", location.pathname === `/chat/${chat.chat_id}` ? "bg-zinc-200/50 text-zinc-900 font-medium" : "text-zinc-600 hover:bg-zinc-100")}>
              <MessageSquare size={16} /> <span className="truncate">{chat.title}</span>
            </Link>
          ))}
        </div>
        
        {/* Dynamic User Profile Section */}
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
    </>
  );
}