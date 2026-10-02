import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AtSign,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Check,
  X,
  ShieldCheck,
  Fingerprint,
  Cpu,
  Loader2,
  RotateCw,
  BadgeCheck,
  Sparkles,
} from 'lucide-react'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800&family=Manrope:wght@400;500;600;700&display=swap'

const styles = `
.v2-display{font-family:'Unbounded',system-ui,sans-serif}
.v2-body{font-family:'Manrope',system-ui,sans-serif}
@keyframes v2-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes v2-drift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(40px,-30px,0)}}
@keyframes v2-holo{0%{background-position:0% 50%}100%{background-position:200% 50%}}
@keyframes v2-pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,211,238,.45)}70%{box-shadow:0 0 0 9px rgba(34,211,238,0)}}
.v2-enter{animation:v2-rise .7s cubic-bezier(.2,.8,.2,1) both}
.v2-drift{animation:v2-drift 16s ease-in-out infinite}
.v2-holo{background:linear-gradient(115deg,#22d3ee,#e879f9,#fcd34d,#22d3ee,#e879f9);background-size:200% 100%;animation:v2-holo 6s linear infinite}
.v2-live{animation:v2-pulse 2.4s ease-out infinite}

/* Collapse/expand without a hardcoded height: grid-template-rows animates
   between 0fr and 1fr, so errors and hints never shift the layout when they
   appear or disappear. */
.v2-reveal{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .22s ease,opacity .18s ease}
.v2-reveal>div{min-height:0;overflow:hidden}
.v2-reveal[data-open="true"]{grid-template-rows:1fr;opacity:1}

/* Vertical rhythm. The card runs ~800px tall at the base spacing, which
   overflows a short laptop viewport, so spacing tightens with height and the
   page stays a single screen with no scrollbar. */
.v2-shell{padding-top:1.5rem;padding-bottom:1.5rem}
.v2-card{padding:2.25rem}
.v2-head{margin-bottom:1.75rem}
.v2-fields>*+*{margin-top:.875rem}
.v2-input{padding-top:.8rem;padding-bottom:.8rem}
.v2-foot{margin-top:1.375rem;padding-top:1.125rem}
.v2-h1{font-size:2.125rem;line-height:1.1}
@media (min-width:640px){.v2-h1{font-size:2.375rem}}
@media (max-width:639px){
  .v2-shell{padding-top:.75rem;padding-bottom:.75rem}
  .v2-card{padding:1.5rem}
}
@media (max-height:900px){
  .v2-shell{padding-top:1rem;padding-bottom:1rem}
  .v2-card{padding:1.75rem}
  .v2-head{margin-bottom:1.125rem}
  .v2-fields>*+*{margin-top:.625rem}
  .v2-foot{margin-top:1rem;padding-top:.875rem}
}
@media (max-height:790px){
  .v2-shell{padding-top:.5rem;padding-bottom:.5rem}
  .v2-card{padding:1.25rem}
  .v2-head{margin-bottom:.875rem}
  .v2-fields>*+*{margin-top:.5rem}
  .v2-input{padding-top:.45rem;padding-bottom:.45rem}
  .v2-foot{margin-top:.75rem;padding-top:.75rem}
  .v2-h1{font-size:1.75rem}
}
@media (prefers-reduced-motion:reduce){.v2-enter,.v2-drift,.v2-holo,.v2-live{animation:none}.v2-reveal{transition:none}}
`

const OTP_LENGTH = 6
const RESEND_SECONDS = 30

const STEPS = [
  { key: 'form', label: 'Account' },
  { key: 'otp', label: 'Verify' },
  { key: 'done', label: 'Live' },
]

const STRENGTH = [
  { label: 'Too short', bar: 'bg-zinc-700' },
  { label: 'Weak', bar: 'bg-rose-500' },
  { label: 'Okay', bar: 'bg-amber-400' },
  { label: 'Strong', bar: 'bg-cyan-400' },
  { label: 'Unbreakable', bar: 'bg-fuchsia-400' },
]

const NEXT_HINT = [
  null,
  'Add upper and lower case letters',
  'Add a number',
  'Add a symbol',
]

const HANDLE_RE = /^[a-zA-Z0-9_]{3,20}$/
const EMAIL_RE = /^\S+@\S+\.\S+$/

const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

const maskEmail = (email) => {
  const [name = '', ...rest] = (email || '').split('@')
  const domain = rest.join('@')
  if (!name || !domain) return 'you@domain.com'
  return `${name.slice(0, 2)}${'•'.repeat(Math.min(6, Math.max(3, name.length - 2)))}@${domain}`
}

const checks = {
  length: (pw) => pw.length >= 8,
  mixed: (pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw),
  number: (pw) => /\d/.test(pw),
  symbol: (pw) => /[^A-Za-z0-9]/.test(pw),
}

const getStrength = (pw) => Object.values(checks).reduce((n, ok) => n + (ok(pw) ? 1 : 0), 0)

// An empty field is not a weak password, it is an unknown one, so the meter and
// the ID card show a neutral label until something has actually been typed.
const strengthLabel = (pw, fallback) => (pw ? STRENGTH[getStrength(pw)].label : fallback)

const validate = ({ username, email, password, confirmPassword }) => ({
  username: HANDLE_RE.test(username) ? '' : '3\u201320 letters, numbers or underscores',
  email: EMAIL_RE.test(email) ? '' : 'Enter a valid email address',
  password: password.length >= 8 ? '' : 'Use at least 8 characters',
  confirmPassword: confirmPassword === password ? '' : "Passwords don't match",
})

/* ---------- Field ---------- */
const Field = ({ label, icon: Icon, error, trailing, hint, className = '', ...props }) => {
  const errorId = `${props.name}-error`

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={props.name} className="text-[13px] font-semibold text-zinc-300">
          {label}
        </label>
        {hint && <span className="text-xs text-zinc-500">{hint}</span>}
      </div>
      <div
        className={`group flex items-center gap-3 rounded-2xl border bg-white/[0.03] px-4 transition-colors focus-within:bg-white/[0.06] ${
          error
            ? 'border-rose-500/70'
            : 'border-white/10 focus-within:border-cyan-300/70 hover:border-white/20'
        }`}
      >
        <Icon
          size={18}
          strokeWidth={2}
          aria-hidden="true"
          className={`shrink-0 transition-colors ${
            error ? 'text-rose-400' : 'text-zinc-500 group-focus-within:text-cyan-300'
          }`}
        />
        <input
          {...props}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`v2-input w-full min-w-0 bg-transparent text-sm text-white placeholder-zinc-500 outline-none ${className}`}
        />
        {trailing}
      </div>
      <div className="v2-reveal" data-open={error ? 'true' : 'false'}>
        <div>
          {error && (
            <p id={errorId} className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400">
              <X size={12} aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Show/hide password ---------- */
const RevealButton = ({ hidden, onToggle, label }) => (
  <button
    type="button"
    onClick={onToggle}
    // Stopping the default keeps the input focused so toggling visibility
    // does not dismiss the mobile keyboard or blur the field mid-typing.
    onMouseDown={(e) => e.preventDefault()}
    aria-label={label}
    aria-pressed={!hidden}
    title={label}
    className="-mr-1 shrink-0 rounded-lg p-1 text-zinc-500 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
  >
    {hidden ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
  </button>
)

/* ---------- Form level error ---------- */
const FormError = ({ children }) => (
  <div className="v2-reveal" data-open={children ? 'true' : 'false'}>
    <div>
      {children && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          <X size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          {children}
        </p>
      )}
    </div>
  </div>
)

/* ---------- Stepper ---------- */
const Stepper = ({ step }) => {
  const current = STEPS.findIndex((s) => s.key === step)

  return (
    <nav aria-label="Registration progress">
      <ol className="flex items-center">
        {STEPS.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo'
          return (
            <li key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                    state === 'todo'
                      ? 'border-white/10 bg-white/[0.03] text-zinc-600'
                      : state === 'current'
                        ? 'v2-live border-cyan-300/70 bg-cyan-300/10 text-cyan-200'
                        : 'border-cyan-300/40 bg-cyan-300/10 text-cyan-300'
                  }`}
                >
                  {state === 'done' ? <Check size={13} /> : i + 1}
                </span>
                <span
                  className={`hidden text-xs font-semibold sm:block ${
                    state === 'todo' ? 'text-zinc-600' : 'text-zinc-300'
                  }`}
                >
                  {s.label}
                </span>
                <span className="sr-only">
                  Step {i + 1} of {STEPS.length}: {s.label}
                  {state === 'done' ? ' (complete)' : state === 'current' ? ' (current)' : ''}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`mx-2.5 h-px flex-1 ${
                    i < current ? 'bg-cyan-300/40' : 'bg-white/10'
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>
      <p aria-live="polite" className="sr-only">
        Step {current + 1} of {STEPS.length}, {STEPS[current].label}
      </p>
    </nav>
  )
}

/* ---------- Live ID card ---------- */
const IdCard = ({ username, email, strength, security }) => {
  const [t, setT] = useState({ x: 0, y: 0, gx: 50, gy: 30 })
  const id = useMemo(() => `${(hash(username || 'new') % 9000) + 1000}`, [username])
  const handle = username || 'yourhandle'

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    setT({ x: (py - 0.5) * -16, y: (px - 0.5) * 20, gx: px * 100, gy: py * 100 })
  }

  return (
    <div
      onMouseMove={onMove}
      onMouseLeave={() => setT({ x: 0, y: 0, gx: 50, gy: 30 })}
      className="w-full max-w-[420px]"
      style={{ perspective: 1100 }}
    >
      <div
        className="relative aspect-[1.586/1] overflow-hidden rounded-[28px] border border-white/15 bg-zinc-950 p-6 shadow-[0_40px_120px_-30px_rgba(232,121,249,0.55)]"
        style={{
          transform: `rotateX(${t.x}deg) rotateY(${t.y}deg)`,
          transition: 'transform .15s ease-out',
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="v2-holo absolute inset-0 opacity-[0.16]" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle at ${t.gx}% ${t.gy}%, rgba(255,255,255,0.22), transparent 45%)`,
          }}
        />

        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Fingerprint size={20} aria-hidden="true" className="text-cyan-300" />
              <span className="v2-display text-xs font-extrabold tracking-tight">vibe id</span>
            </div>
            <Cpu size={34} strokeWidth={1.4} aria-hidden="true" className="text-amber-300/90" />
          </div>

          <div>
            <p className="v2-display truncate text-2xl font-extrabold tracking-tight text-white">
              @{handle}
            </p>
            <p className="mt-1 truncate text-sm text-zinc-400">{maskEmail(email)}</p>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] text-zinc-500">Member no.</p>
              <p className="v2-display text-sm font-semibold text-zinc-200">{id}</p>
            </div>
            <div className="w-32">
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck size={12} aria-hidden="true" /> Security
                </span>
                <span className="truncate">{security}</span>
              </div>
              <div className="flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      strength >= n ? STRENGTH[strength].bar : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Password strength ---------- */
const StrengthMeter = ({ password }) => {
  const strength = getStrength(password)
  const hint = password ? NEXT_HINT[strength] : ''

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                strength >= n ? STRENGTH[strength].bar : 'bg-white/10'
              }`}
            />
          ))}
        </div>
        <span aria-live="polite" className="min-w-[5.5rem] text-right text-xs text-zinc-500">
          {strengthLabel(password, 'Strength')}
        </span>
      </div>
      <div className="v2-reveal" data-open={hint ? 'true' : 'false'}>
        <div>
          <p className="mt-2 text-xs text-zinc-500">{hint}</p>
        </div>
      </div>
    </div>
  )
}

/* ---------- OTP step ---------- */
const OtpStep = ({ email, loading, onVerify, onResend, onBack, onEditCode, serverError }) => {
  const [otp, setOtp] = useState(() => Array(OTP_LENGTH).fill(''))
  const [left, setLeft] = useState(RESEND_SECONDS)
  const [resent, setResent] = useState(false)
  const refs = useRef([])
  const submittingFor = useRef('')

  const code = otp.join('')
  const expired = left <= 0

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (expired) return undefined
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [expired])

  useEffect(() => {
    if (!resent) return undefined
    const id = setTimeout(() => setResent(false), 4000)
    return () => clearTimeout(id)
  }, [resent])

  // Submit the moment the code is complete. The ref guard stops a re-render (or
  // a StrictMode double-invoke) from sending the same code twice.
  useEffect(() => {
    if (code.length !== OTP_LENGTH) {
      submittingFor.current = ''
      return
    }
    if (loading || submittingFor.current === code) return
    submittingFor.current = code
    onVerify(code)
  }, [code, loading, onVerify])

  // Editing the code invalidates any previous "wrong code" message.
  const edit = (next) => {
    if (next.join('') !== code) onEditCode()
  }

  const setDigit = (i, raw) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[i] = digit
    edit(next)
    setOtp(next)
    if (digit && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus()
  }

  const onKeyDown = (i, e) => {
    if ((e.key === 'Backspace' && !otp[i] && i > 0) || (e.key === 'ArrowLeft' && i > 0)) {
      e.preventDefault()
      refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) {
      e.preventDefault()
      refs.current[i + 1]?.focus()
    }
  }

  const onPaste = (e) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!digits) return
    e.preventDefault()
    const next = Array(OTP_LENGTH).fill('')
    ;[...digits].forEach((d, i) => {
      next[i] = d
    })
    submittingFor.current = ''
    edit(next)
    setOtp(next)
    const last = Math.min(digits.length, OTP_LENGTH) - 1
    refs.current[last]?.focus()
    refs.current[last]?.select()
  }

  const handleResend = async () => {
    setOtp(Array(OTP_LENGTH).fill(''))
    setLeft(RESEND_SECONDS)
    submittingFor.current = ''
    setResent(true)
    onEditCode()
    refs.current[0]?.focus()
    await onResend()
  }

  return (
    <div className="v2-enter">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300">
        <Mail size={22} aria-hidden="true" />
      </div>
      <h2 className="v2-display v2-h1 font-extrabold tracking-tight">Check your inbox</h2>
      <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
        We sent a {OTP_LENGTH}-digit code to <span className="text-zinc-200">{maskEmail(email)}</span>.
      </p>

      <div
        role="group"
        aria-label={`${OTP_LENGTH}-digit verification code`}
        className="mt-6 flex gap-2.5"
        onPaste={onPaste}
      >
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            value={digit}
            inputMode="numeric"
            pattern="\d"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            className={`h-14 w-full min-w-0 rounded-2xl border bg-white/[0.03] text-center text-xl font-bold text-white outline-none transition-colors focus:border-cyan-300/80 focus:bg-white/[0.07] ${
              digit ? 'border-white/25' : 'border-white/10'
            }`}
          />
        ))}
      </div>

      <div className="mt-3 space-y-3">
        <FormError>{serverError}</FormError>
        {/* Held in flow with a fixed height so the confirmation cannot jump the layout. */}
        <p
          aria-live="polite"
          className={`flex items-center gap-1.5 text-xs text-cyan-300/90 transition-opacity duration-300 ${
            resent ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Check size={12} aria-hidden="true" />
          New code sent to {maskEmail(email)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onVerify(code)}
        disabled={code.length < OTP_LENGTH || loading}
        aria-busy={loading || undefined}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-bold text-zinc-950 transition hover:bg-cyan-200 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <Loader2 size={18} aria-hidden="true" className="animate-spin" />
        ) : (
          <BadgeCheck size={18} aria-hidden="true" />
        )}
        Verify email
      </button>

      <div className="mt-5 flex items-center justify-between gap-4 text-xs text-zinc-500">
        <button
          type="button"
          onClick={onBack}
          className="rounded text-left transition-colors hover:text-zinc-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          Change email
        </button>
        <button
          type="button"
          disabled={!expired || loading}
          onClick={handleResend}
          className="flex items-center gap-1.5 rounded transition-colors enabled:text-cyan-300 enabled:hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-default"
        >
          <RotateCw size={12} aria-hidden="true" />
          {expired ? 'Resend code' : `Resend in ${left}s`}
        </button>
      </div>
    </div>
  )
}

/* ---------- Success ---------- */
const DoneStep = ({ username }) => {
  const heading = useRef(null)

  useEffect(() => {
    heading.current?.focus()
  }, [])

  return (
    <div className="v2-enter py-4 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-300 ring-8 ring-cyan-300/5">
        <BadgeCheck size={32} aria-hidden="true" />
      </div>
      <h2
        ref={heading}
        tabIndex={-1}
        className="v2-display text-2xl font-extrabold tracking-tight outline-none"
      >
        You&rsquo;re in, @{username}
      </h2>
      <p className="mx-auto mt-2 max-w-xs text-sm text-zinc-400">
        Your email is verified and your ID is live.
      </p>
      <a
        href="/login"
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-zinc-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        Continue to log in <ArrowRight size={18} aria-hidden="true" />
      </a>
    </div>
  )
}

/* ---------- Page ---------- */
const RegisterPage = () => {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [touched, setTouched] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [step, setStep] = useState('form') // form | otp | done
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const strength = getStrength(form.password)
  const confirmMatches = Boolean(form.confirmPassword) && form.confirmPassword === form.password

  const errors = validate(form)
  const err = (k) => (touched[k] ? errors[k] : '')

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    if (serverError) setServerError('')
  }

  const onBlur = (e) => setTouched((p) => ({ ...p, [e.target.name]: true }))

  const onSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setTouched({ username: true, email: true, password: true, confirmPassword: true })
    if (Object.values(errors).some(Boolean)) return
    setLoading(true)
    setServerError('')
    try {
      // TODO: POST to your Spring Boot register endpoint, e.g. /api/auth/register
      await new Promise((r) => setTimeout(r, 900))
      setStep('otp')
    } catch (error) {
      setServerError(error?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const onVerify = useCallback(
    async (code) => {
      if (loading || code.length !== OTP_LENGTH) return
      setLoading(true)
      setServerError('')
      try {
        // TODO: POST { email, code } to your Spring Boot OTP verify endpoint
        await new Promise((r) => setTimeout(r, 900))
        setStep('done')
      } catch (error) {
        setServerError(error?.message || 'That code did not match. Try again.')
      } finally {
        setLoading(false)
      }
    },
    [loading],
  )

  const onResend = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setServerError('')
    try {
      // TODO: POST { email } to your Spring Boot resend endpoint
      await new Promise((r) => setTimeout(r, 700))
    } catch (error) {
      setServerError(error?.message || 'We could not send a new code. Try again shortly.')
    } finally {
      setLoading(false)
    }
  }, [loading])

  return (
    <div className="v2-body relative min-h-screen w-full overflow-hidden bg-[#06060b] font-sans text-white selection:bg-fuchsia-500 selection:text-white">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={FONTS} />
      <style>{styles}</style>

      {/* Ambient light */}
      <div
        className="v2-drift pointer-events-none absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-cyan-500/20 blur-[140px]"
        aria-hidden="true"
      />
      <div
        className="v2-drift pointer-events-none absolute -bottom-40 right-[8%] h-[560px] w-[560px] rounded-full bg-fuchsia-600/20 blur-[150px]"
        style={{ animationDelay: '-8s' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      />

      {/* Brand bar */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 pt-6 sm:px-10">
        <a
          href="/"
          className="flex items-center gap-2 rounded text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
        >
          <Fingerprint size={20} aria-hidden="true" className="text-cyan-300" />
          <span className="v2-display text-xs font-extrabold tracking-tight">vibe id</span>
        </a>
        <p className="text-xs text-zinc-500 sm:text-sm">
          Already a member?{' '}
          <a
            href="/login"
            className="rounded font-semibold text-cyan-300 hover:text-cyan-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            Log in
          </a>
        </p>
      </header>

      <div className="v2-shell relative z-10 mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-7xl items-center gap-12 px-6 sm:px-10 lg:grid-cols-[minmax(0,470px)_1fr] lg:gap-20">
        {/* ============ FORM ============ */}
        <main className="v2-enter w-full">
          <div className="v2-card rounded-[32px] border border-white/10 bg-zinc-950/70 shadow-2xl shadow-black/60 backdrop-blur-2xl">
            <Stepper step={step} />

            {step === 'form' && (
              <div className="v2-head pt-6">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-2 pr-3 text-xs text-zinc-300">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-500/20 text-fuchsia-300">
                    <Sparkles size={12} aria-hidden="true" />
                  </span>
                  Free forever, no card needed
                </div>
                <h1 className="v2-display v2-h1 font-extrabold tracking-tight">
                  Make your
                  <br />
                  vibe ID
                </h1>
                <p className="mt-3 text-sm text-zinc-400">
                  Takes about 30 seconds. We&rsquo;ll confirm your email next.
                </p>
              </div>
            )}

            {step === 'form' && (
              <form onSubmit={onSubmit} noValidate autoComplete="on" className="v2-fields">
                <Field
                  label="Handle"
                  hint="Public and unique"
                  icon={AtSign}
                  name="username"
                  value={form.username}
                  onChange={onChange}
                  onBlur={onBlur}
                  error={err('username')}
                  placeholder="vibemaster_99"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <Field
                  label="Email"
                  icon={Mail}
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  onBlur={onBlur}
                  error={err('email')}
                  placeholder="you@domain.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />

                <div>
                  <Field
                    label="Password"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={onChange}
                    onBlur={onBlur}
                    error={err('password')}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    trailing={
                      <RevealButton
                        hidden={showPassword}
                        onToggle={() => setShowPassword((s) => !s)}
                        label={showPassword ? 'Hide password' : 'Show password'}
                      />
                    }
                  />
                  <StrengthMeter password={form.password} />
                </div>

                <Field
                  label="Confirm password"
                  icon={ShieldCheck}
                  type={showConfirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={onChange}
                  onBlur={onBlur}
                  error={err('confirmPassword')}
                  placeholder="Type it once more"
                  autoComplete="new-password"
                  trailing={
                    <span className="flex shrink-0 items-center gap-1.5">
                      {confirmMatches && <Check size={18} aria-hidden="true" className="text-cyan-300" />}
                      <RevealButton
                        hidden={showConfirm}
                        onToggle={() => setShowConfirm((s) => !s)}
                        label={showConfirm ? 'Hide password' : 'Show password'}
                      />
                    </span>
                  }
                />

                <FormError>{serverError}</FormError>

                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading || undefined}
                  className="v2-holo group mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-extrabold text-zinc-950 shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 active:scale-[0.99] disabled:opacity-70"
                >
                  {loading && <Loader2 size={18} aria-hidden="true" className="animate-spin" />}
                  Create my ID
                  {!loading && (
                    <ArrowRight
                      size={18}
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                    />
                  )}
                </button>

                <p className="v2-foot border-t border-white/10 text-sm text-zinc-500">
                  By continuing you agree to the{' '}
                  <a href="/terms" className="rounded text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
                    terms
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" className="rounded text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
                    privacy policy
                  </a>
                  .
                </p>
              </form>
            )}

            {step === 'otp' && (
              <div className="pt-6">
                <OtpStep
                  email={form.email}
                  loading={loading}
                  onVerify={onVerify}
                  onResend={onResend}
                  onBack={() => setStep('form')}
                  onEditCode={() => setServerError('')}
                  serverError={serverError}
                />
              </div>
            )}

            {step === 'done' && (
              <div className="pt-6">
                <DoneStep username={form.username} />
              </div>
            )}
          </div>
        </main>

        {/* ============ HERO: LIVE ID ============ */}
        <aside className="hidden flex-col items-center justify-center lg:flex">
          <IdCard
            username={form.username}
            email={form.email}
            strength={strength}
            security={strengthLabel(form.password, 'Not set')}
          />
          <p className="mt-10 max-w-sm text-center text-sm leading-relaxed text-zinc-500">
            Your ID builds itself as you type. Move your cursor over the card to tilt it.
          </p>
        </aside>
      </div>
    </div>
  )
}

export default RegisterPage