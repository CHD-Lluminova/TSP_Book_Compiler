import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginScreen from '@/components/LoginScreen';
import Shelf from '@/components/Shelf';
import Studio from '@/components/Studio';
import { Loader2 } from 'lucide-react';

function AppRoutes() {
  const { session, loading } = useAuth();
  const [openBookId, setOpenBookId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="animate-spin mb-3" size={32} />
        Loading studio…
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (openBookId) {
    return <Studio bookId={openBookId} onBack={() => setOpenBookId(null)} />;
  }

  return <Shelf onOpenBook={(id) => setOpenBookId(id)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
