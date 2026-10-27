import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Calls your FastAPI register route
      await api.post('/api/auth/register', form);
      toast.success('Registration successful! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-zinc-200">
        <h1 className="text-2xl font-bold text-zinc-900 text-center mb-6">Create Account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            required 
            onChange={e => setForm({...form, email: e.target.value})} 
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent" 
          />
          <input 
            type="password" 
            placeholder="Password" 
            required 
            onChange={e => setForm({...form, password: e.target.value})} 
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent" 
          />
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-2.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-500 mt-4">
          Already have an account? <Link to="/login" className="text-zinc-900 font-medium hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}