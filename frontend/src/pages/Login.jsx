import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await api.post('/api/auth/login', form);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      // 1. Look for the exact error message sent by FastAPI (e.g., "Email not registered")
      // 2. If it's a network error and FastAPI is unreachable, show a fallback message
      const errorMessage = err.response?.data?.detail || 'Invalid credentials or server unreachable.';
      
      // Trigger the red error toast notification at the top of the screen
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-zinc-200">
        <h1 className="text-2xl font-bold text-zinc-900 text-center mb-6">Sign In</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            required 
            onChange={e => setForm({...form, email: e.target.value})} 
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all" 
          />
          <input 
            type="password" 
            placeholder="Password" 
            required 
            onChange={e => setForm({...form, password: e.target.value})} 
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all" 
          />
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-2.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center transition-colors"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Login'}
          </button>
        </form>
        
        <p className="text-center text-sm text-zinc-500 mt-4">
          New to Sequelo? <Link to="/register" className="text-zinc-900 font-medium hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}