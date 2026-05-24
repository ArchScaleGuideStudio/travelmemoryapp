import { useState, FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Compass, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { supabase } from '@infra/supabase'

type Mode = 'password' | 'magic'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate(from, { replace: true })
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        setMagicSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-ink text-paper flex items-center justify-center">
            <Compass size={22} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tightish mb-1">Welcome back</h1>
          <p className="text-sm text-inkSoft">Sign in to your atlas</p>
        </div>

        {magicSent ? (
          <div className="bg-panel border border-paperEdge rounded-xl p-6 text-center">
            <div className="text-sm font-medium mb-1">Check your inbox</div>
            <p className="text-sm text-inkSoft">
              A sign-in link has been sent to <span className="font-medium text-ink">{email}</span>.
              Tap it on this device to continue.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-panel border border-paperEdge rounded-xl p-5 space-y-4">
            <Field icon={<Mail size={15} />} label="Email">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent text-sm outline-none placeholder:text-inkFaint"
              />
            </Field>

            {mode === 'password' && (
              <Field icon={<Lock size={15} />} label="Password">
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-inkFaint"
                />
              </Field>
            )}

            {error && (
              <div className="text-xs text-danger bg-accentSoft/40 rounded-md px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-ink text-paper rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {mode === 'password' ? 'Sign in' : 'Send magic link'}
            </button>

            <button
              type="button"
              onClick={() => { setMode(mode === 'password' ? 'magic' : 'password'); setError(null) }}
              className="w-full text-xs text-inkSoft hover:text-ink text-center"
            >
              {mode === 'password' ? 'Use a magic link instead' : 'Use password instead'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-inkSoft mt-6">
          New here? <Link to="/auth/signup" className="text-ink font-medium hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider2 text-inkFaint font-medium mb-1.5">{label}</div>
      <div className="flex items-center gap-2.5 bg-paper border border-paperEdge rounded-lg px-3 py-2.5 focus-within:border-ink">
        <span className="text-inkFaint">{icon}</span>
        {children}
      </div>
    </label>
  )
}
