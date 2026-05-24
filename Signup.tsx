import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Compass, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react'
import { supabase } from '@infra/supabase'

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split('@')[0] },
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) throw error
      // If email confirmation is required, no session is returned yet.
      if (!data.session) {
        setConfirmationSent(true)
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed')
    } finally {
      setBusy(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-panel border border-paperEdge rounded-xl p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-paperDeep flex items-center justify-center text-inkSoft">
            <Mail size={20} />
          </div>
          <h1 className="text-xl font-semibold mb-2">Confirm your email</h1>
          <p className="text-sm text-inkSoft mb-4">
            We sent a verification link to <span className="font-medium text-ink">{email}</span>.
            Tap it to activate your account.
          </p>
          <Link to="/auth/login" className="text-sm text-accent font-medium hover:text-accentDeep">
            Back to sign in →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-ink text-paper flex items-center justify-center">
            <Compass size={22} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tightish mb-1">Start your atlas</h1>
          <p className="text-sm text-inkSoft">A vault for the places you've been</p>
        </div>

        <form onSubmit={submit} className="bg-panel border border-paperEdge rounded-xl p-5 space-y-4">
          <Field icon={<User size={15} />} label="Your name">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="What should we call you?"
              className="w-full bg-transparent text-sm outline-none placeholder:text-inkFaint"
            />
          </Field>

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

          <Field icon={<Lock size={15} />} label="Password">
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full bg-transparent text-sm outline-none placeholder:text-inkFaint"
            />
          </Field>

          {error && (
            <div className="text-xs text-danger bg-accentSoft/40 rounded-md px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-ink text-paper rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            Create account
          </button>
        </form>

        <p className="text-center text-sm text-inkSoft mt-6">
          Already have an account? <Link to="/auth/login" className="text-ink font-medium hover:underline">Sign in</Link>
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
