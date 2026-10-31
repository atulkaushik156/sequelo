import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ChatView from './pages/ChatView';

// 1. Import your new Landing Page here
import LandingPage from './pages/LandingPage'; 

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <Routes>
        {/* 2. Set the Landing Page as the default route (/) outside the AppLayout */}
        <Route path="/" element={<LandingPage />} />
        
        <Route path="/login" element={<Login />} />
        
        <Route element={<AppLayout />}>
          {/* Note: I removed the Navigate redirect that was here so it doesn't block the Landing Page */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat/:chatId" element={<ChatView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}