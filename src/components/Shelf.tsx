import { useEffect, useState, useCallback } from 'react';
import { BookOpen, Plus, Trash2, Loader2, BookMarked, Clock, AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchBooks, createBook, deleteBook } from '@/lib/db';
import type { BookRow } from '@/types';
import { MAX_BOOKS } from '@/types';

interface ShelfProps {
  onOpenBook: (bookId: string) => void;
}

export default function Shelf({ onOpenBook }: ShelfProps) {
  const { user, role, signOut } = useAuth();
  const [books, setBooks] = useState<BookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchBooks();
      setBooks(rows);
    } catch (err: any) {
      setError(err.message || 'Could not load the shelf.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      const title = window.prompt('Name your new book:', 'Untitled Book');
      if (!title) return;
      await createBook(title.trim());
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not create the book.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(bookId: string) {
    setBusy(true);
    setError('');
    try {
      await deleteBook(bookId);
      setConfirmDelete(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not delete the book.');
    } finally {
      setBusy(false);
    }
  }

  const slots = Math.max(MAX_BOOKS, books.length);
  const isAuthor = role === 'author';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="h-16 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <BookOpen className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-base text-white flex items-center gap-2">
              Lumina 3D Book Studio
              <span className="px-2 py-0.5 text-[10px] bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-full font-semibold">
                The Shelf
              </span>
            </h1>
            <p className="text-xs text-slate-400">Up to {MAX_BOOKS} working books at a time</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">
              {user?.email}
            </p>
            <p className="text-xs text-teal-400 capitalize">{role}</p>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm text-slate-300 transition-all"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Shelf body */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-6xl mx-auto">
          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-sm mb-6 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-fredoka text-3xl font-bold text-white">Your Book Shelf</h2>
              <p className="text-slate-400 mt-1">
                {books.length} of {MAX_BOOKS} books · {isAuthor ? 'Author' : 'Illustrator'} view
              </p>
            </div>
            {books.length < MAX_BOOKS && (
              <button
                onClick={handleCreate}
                disabled={busy}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-teal-600/30 active:scale-95 disabled:opacity-60"
              >
                {busy ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                New Book
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-500">
              <Loader2 className="animate-spin mb-3" size={32} />
              Loading your shelf…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: slots }).map((_, i) => {
                const book = books[i];
                if (!book) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-600 bg-slate-900/30"
                    >
                      <BookMarked size={32} className="mb-2 opacity-50" />
                      <span className="text-sm">Empty slot</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={book.id}
                    className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-teal-500/60 transition-all cursor-pointer shadow-xl"
                    onClick={() => onOpenBook(book.id)}
                  >
                    {/* Cover preview */}
                    {book.cover_thumbnail ? (
                      <img
                        src={book.cover_thumbnail}
                        alt={book.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-teal-700 via-slate-800 to-emerald-900 flex flex-col items-center justify-center p-6 text-center">
                        <BookOpen className="text-white/40 mb-3" size={40} />
                        <span className="font-fredoka text-xl font-bold text-white/90 line-clamp-3">
                          {book.title}
                        </span>
                      </div>
                    )}
                    {/* Spine effect */}
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/30" />
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90 group-hover:opacity-95 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="font-fredoka text-lg font-bold text-white line-clamp-2 mb-1">
                        {book.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="truncate">{book.author_name}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Clock size={11} />
                          {new Date(book.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(book.id);
                      }}
                      className="absolute top-3 right-3 p-2 bg-slate-950/80 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete book"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <h3 className="font-bold text-white text-lg">Delete this book?</h3>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              This permanently removes the book and all its pages. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={busy}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={busy}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition-all disabled:opacity-60"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
