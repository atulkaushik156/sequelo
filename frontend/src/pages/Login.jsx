
import { useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

export default function Login() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Gracefully handle errors redirected from the FastAPI backend
    const error = searchParams.get('error');
    if (error) {
      toast.error(error === 'access_denied' ? 'Google login was canceled.' : 'Authentication failed.');
    }
  }, [searchParams]);

  const handleGoogleLogin = () => {
    // Use a relative path so it automatically appends the current domain
    window.location.href = "/api/auth/google/login";
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-zinc-50 px-4 py-12">

      {/* Subtle background accents */}
      <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-indigo-100/50 blur-3xl" />

      <main className="relative z-10 w-full max-w-md">

        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-900/15">
              <svg
                className="h-7 w-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19V5" />
                <path d="M4 19H20" />
                <path d="M7 15L11 10L14 13L20 6" />
                <path d="M16 6H20V10" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Sequelo
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            AI-powered analytics for your data
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-7 shadow-xl shadow-slate-900/[0.04] sm:p-9">

          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Welcome back
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Sign in to access your workspace and continue exploring your data.
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="group flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-400 hover:bg-zinc-50 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100 active:scale-[0.99]"
          >
            <svg className="h-5 w-5 transition-transform duration-200 group-hover:scale-105" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>

            <span>Continue with Google</span>

            <svg
              className="ml-auto h-4 w-4 text-zinc-400 transition-transform duration-200 group-hover:translate-x-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>

          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-zinc-100" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Secure sign in
            </span>
            <div className="h-px flex-1 bg-zinc-100" />
          </div>

          <p className="text-center text-xs leading-5 text-zinc-400">
            By continuing, you will be redirected to Google to authenticate your account.
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="text-xs text-zinc-400">
            © {new Date().getFullYear()} Sequelo. All rights reserved.
          </p>
        </footer>

      </main>
    </div>
  );
}
