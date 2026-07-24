import { useState } from 'react';
import { BookOpen, PenTool, Palette, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { StudioRole } from '@/types';

const ACCOUNTS: { role: StudioRole; label: string; email: string; password: string; desc: string; icon: typeof PenTool; accent: string }[] = [
  {
    role: 'author',
    label: 'Author',
    email: 'author@lumina.studio',
    password: 'Jamet',
    desc: 'Write the story, manage pages and text flow.',
    icon: PenTool,
    accent: 'teal',
  },
  {
    role: 'illustrator',
    label: 'Illustrator',
    email: 'illustrator@lumina.studio',
    password: 'Sonsofbigboss',
    desc: 'Upload art, design covers, shape the visuals.',
    icon: Palette,
    accent: 'amber',
  },
];

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [selected, setSelected] = useState<StudioRole | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function selectRole(role: StudioRole) {
    setSelected(role);
    setError('');
    setPassword('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const account = ACCOUNTS.find((a) => a.role === selected)!;
    setBusy(true);
    setError('');
    try {
      await signIn(account.email, password || account.password);
    } catch (err: any) {
      setError('Wrong password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row overflow-hidden">
      {/* Left brand panel */}
      <div className="lg:w-1/2 relative flex items-center justify-center p-8 lg:p-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950/40" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(13,148,136,0.4), transparent 45%), radial-gradient(circle at 80% 70%, rgba(245,158,11,0.18), transparent 50%)',
          }}
        />
        <div className="relative z-10 max-w-md animate-fade-in-up">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center shadow-2xl shadow-teal-500/30">
              <BookOpen className="text-white" size={28} />
            </div>
            <div>
              <h1 className="font-fredoka text-3xl font-bold text-white tracking-tight">Lumina</h1>
              <p className="text-teal-400 text-sm font-semibold">3D Book Studio</p>
            </div>
          </div>
          <h2 className="font-fredoka text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Build picture books that come alive in 3D.
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            A shared studio where the author and illustrator craft each book side by side — then
            compile it into a standalone 3D reader for the library.
          </p>
          <div className="flex flex-wrap gap-3">
            {['5-book shelf', 'Co-editing', '3D WebGL export', 'Auto text flow'].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800/80 border border-slate-700 rounded-full text-teal-300"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-16 bg-slate-900/50">
        <div className="w-full max-w-md">
          {!selected ? (
            <div className="animate-fade-in-up">
              <h3 className="text-2xl font-bold text-white mb-2">Choose your role to sign in</h3>
              <p className="text-slate-400 mb-8">Both collaborators share the same book shelf.</p>
              <div className="space-y-4">
                {ACCOUNTS.map((acc) => {
                  const Icon = acc.icon;
                  return (
                    <button
                      key={acc.role}
                      onClick={() => selectRole(acc.role)}
                      className="w-full group flex items-center gap-4 p-5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-teal-500/50 rounded-2xl transition-all text-left"
                    >
                      <div
                        className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                          acc.accent === 'teal'
                            ? 'bg-teal-500/20 text-teal-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        <Icon size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-white">{acc.label}</div>
                        <div className="text-sm text-slate-400">{acc.desc}</div>
                      </div>
                      <ArrowRight className="text-slate-600 group-hover:text-teal-400 transition-colors" size={20} />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="animate-fade-in-up">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-slate-400 hover:text-teal-400 mb-6 transition-colors"
              >
                ← Back
              </button>
              {(() => {
                const acc = ACCOUNTS.find((a) => a.role === selected)!;
                const Icon = acc.icon;
                return (
                  <>
                    <div className="flex items-center gap-3 mb-6">
                      <div
                        className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
                          acc.accent === 'teal'
                            ? 'bg-teal-500/20 text-teal-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        <Icon size={28} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">{acc.label} sign in</h3>
                        <p className="text-sm text-slate-400">{acc.email}</p>
                      </div>
                    </div>

                    <label className="block text-sm font-semibold text-slate-300 mb-2">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      autoFocus
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-teal-500 rounded-xl text-white text-lg focus:outline-none transition-colors mb-4"
                    />

                    {error && (
                      <div className="flex items-center gap-2 text-rose-400 text-sm mb-4">
                        <AlertCircle size={16} />
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-600/30 active:scale-[0.98] disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                      {busy ? 'Signing in…' : 'Enter Studio'}
                    </button>

                    <p className="text-center text-xs text-slate-500 mt-6">
                      You'll work on the same shared shelf as your collaborator.
                    </p>
                  </>
                );
              })()}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
