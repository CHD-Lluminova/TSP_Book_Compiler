import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  Save,
  Download,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Maximize,
  Layers,
  BookMarked,
  FileDown,
  RefreshCw,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchFullBook, saveBookMeta, saveCovers, bulkSaveBook } from '@/lib/db';
import { Book3DEngine } from '@/lib/bookEngine';
import { buildStandalone3DHTML, downloadHTML } from '@/lib/htmlExport';
import { reflowPages } from '@/lib/textWrap';
import { fileToCompressedDataUrl } from '@/lib/imageUtils';
import type { BookPage, Covers, FullBook } from '@/types';
import { DEFAULT_PAGES } from '@/types';

type Tab = 'pages' | 'cover' | 'export';

interface StudioProps {
  bookId: string;
  onBack: () => void;
}

export default function Studio({ bookId, onBack }: StudioProps) {
  const { role } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Book3DEngine | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [book, setBook] = useState<FullBook | null>(null);
  const [pages, setPages] = useState<BookPage[]>(DEFAULT_PAGES.map((p) => ({ ...p })));
  const [covers, setCovers] = useState<Covers>({
    front: null,
    back: null,
    spine: null,
    fullWrap: null,
  });
  const [activeSpread, setActiveSpread] = useState(0);
  const [tab, setTab] = useState<Tab>('pages');

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);



  // Load book
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const full = await fetchFullBook(bookId);
        if (cancelled) return;
        setBook(full);
        setPages(full.pages.length ? full.pages : DEFAULT_PAGES.map((p) => ({ ...p })));
        setCovers(full.covers || { front: null, back: null, spine: null, fullWrap: null });
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not open this book.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // Init engine
  useEffect(() => {
    if (!canvasRef.current || loading) return;
    const engine = new Book3DEngine(canvasRef.current, {
      onSpreadChange: (idx) => setActiveSpread(idx),
    });
    engineRef.current = engine;
    engine.init();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [loading]);

  // Push data to engine
  useEffect(() => {
    if (engineRef.current && !loading) {
      engineRef.current.setBook(pages, covers);
    }
  }, [pages, covers, loading]);

  const totalSpreads = Math.ceil(pages.length / 2);

  const updatePageText = useCallback((pageIdx: number, text: string) => {
    setPages((prev) => {
      const next = prev.map((p) => ({ ...p }));
      next[pageIdx] = { ...next[pageIdx], text };
      return reflowPages(next, pageIdx);
    });
  }, []);

  const toggleFullPage = useCallback((pageIdx: number, fullPage: boolean) => {
    setPages((prev) => {
      const next = prev.map((p) => ({ ...p }));
      next[pageIdx] = { ...next[pageIdx], fullPage };
      return reflowPages(next, pageIdx);
    });
  }, []);

  const handlePageImage = useCallback(async (pageIdx: number, file: File) => {
    const dataUrl = await fileToCompressedDataUrl(file, 1100, 0.85);
    setPages((prev) => {
      const next = prev.map((p) => ({ ...p }));
      next[pageIdx] = { ...next[pageIdx], imageDataUrl: dataUrl };
      return reflowPages(next, pageIdx);
    });
  }, []);

  const addSpread = useCallback(() => {
    setPages((prev) => {
      const next = prev.map((p) => ({ ...p }));
      const n = next.length + 1;
      next.push({ num: n, text: '', fullPage: false, imageDataUrl: null });
      next.push({ num: n + 1, text: '', fullPage: false, imageDataUrl: null });
      return next;
    });
  }, []);

  const removeSpread = useCallback((spreadIdx: number) => {
    setPages((prev) => {
      if (prev.length <= 2) return prev;
      const next = prev.slice();
      next.splice(spreadIdx * 2, 2);
      next.forEach((p, i) => (p.num = i + 1));
      return next;
    });
    setActiveSpread((s) => Math.max(0, Math.min(s, Math.ceil(pages.length / 2) - 2)));
  }, [pages.length]);

  const handleCoverUpload = useCallback(async (type: keyof Covers, file: File) => {
    const dataUrl = await fileToCompressedDataUrl(file, 2200, 0.85);
    setCovers((prev) => ({ ...prev, [type]: dataUrl }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!book) return;
    setSaving(true);
    setError('');
    try {
      await saveBookMeta(book.id, {
        title: book.title,
        author_name: book.author_name,
        illustrator_name: book.illustrator_name,
      });
      await saveCovers(book.id, covers);
      await bulkSaveBook(book.id, pages);
      setSavedAt(Date.now());
    } catch (err: any) {
      setError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }, [book, pages, covers]);

  const handleExport = useCallback(async () => {
    if (!book) return;
    setExporting(true);
    try {
      const html = buildStandalone3DHTML(pages, covers, book.title, book.author_name);
      const safeName = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'book';
      downloadHTML(html, `${safeName}_3D_reader.html`);
    } catch (err: any) {
      setError(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  }, [book, pages, covers]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="animate-spin mb-3" size={32} />
        Opening your book…
      </div>
    );
  }

  if (error && !book) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-rose-400 p-8">
        <AlertCircle size={32} className="mb-3" />
        {error}
        <button onClick={onBack} className="mt-6 px-4 py-2 bg-slate-800 rounded-xl text-slate-200">
          Back to shelf
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 px-4 sm:px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 backdrop-blur-md z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-all shrink-0"
            title="Back to shelf"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <input
              value={book?.title || ''}
              onChange={(e) => setBook((b) => (b ? { ...b, title: e.target.value } : b))}
              className="font-fredoka font-bold text-base text-white bg-transparent border-none focus:outline-none focus:bg-slate-800 rounded px-1 -mx-1 max-w-[200px] sm:max-w-xs truncate"
            />
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>by {book?.author_name}</span>
              <span>·</span>
              <span className="text-teal-400 capitalize">{role}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {savedAt && Date.now() - savedAt < 4000 && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 size={14} /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-teal-600/30 active:scale-95"
            title="Save to shelf"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            <span className="hidden sm:inline">Save</span>
          </button>
          <button
            onClick={() => engineRef.current?.resetCamera()}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-all"
            title="Reset 3D view"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-all"
            title="Fullscreen"
          >
            <Maximize size={16} />
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 text-rose-400 text-sm px-6 py-2 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="flex-1 flex relative overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 sm:w-96 bg-slate-900/90 border-r border-slate-800/80 flex flex-col shrink-0 backdrop-blur-md z-20">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 text-xs font-bold bg-slate-950/40">
            {([
              ['pages', 'Pages', Layers],
              ['cover', 'Cover', BookMarked],
              ['export', 'Export', FileDown],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-3 border-b-2 flex items-center justify-center gap-2 transition-all ${
                  tab === key
                    ? 'border-teal-500 text-teal-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={14} /> {label}{' '}
                {key === 'pages' && (
                  <span className="text-slate-500">({pages.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Pages tab */}
          {tab === 'pages' && (
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Page Spreads
                </h2>
                <button
                  onClick={addSpread}
                  className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Plus size={14} /> Add Spread
                </button>
              </div>

              {Array.from({ length: totalSpreads }).map((_, spreadIdx) => {
                const leftPage = pages[spreadIdx * 2];
                const rightPage = pages[spreadIdx * 2 + 1];
                if (!leftPage) return null;
                return (
                  <div
                    key={spreadIdx}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      spreadIdx === activeSpread
                        ? 'bg-teal-950/40 border-teal-500/60'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-extrabold text-teal-400 uppercase tracking-wider">
                        Spread {spreadIdx + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => engineRef.current?.selectSpread(spreadIdx)}
                          className="px-2.5 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold"
                        >
                          Preview
                        </button>
                        {totalSpreads > 1 && (
                          <button
                            onClick={() => removeSpread(spreadIdx)}
                            className="p-1 text-rose-400 hover:bg-rose-500/10 rounded-lg"
                            title="Delete spread"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    {[leftPage, rightPage].map((page, side) => {
                      if (!page) return null;
                      const pageIdx = spreadIdx * 2 + side;
                      return (
                        <div
                          key={side}
                          className="space-y-2 p-2.5 bg-slate-900/80 rounded-xl border border-slate-800/80 mb-2 last:mb-0"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                            <span>{side === 0 ? 'Left' : 'Right'} Page {page.num}</span>
                            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={page.fullPage}
                                onChange={(e) => toggleFullPage(pageIdx, e.target.checked)}
                                className="rounded accent-teal-500"
                              />
                              Full bleed
                            </label>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handlePageImage(pageIdx, f);
                            }}
                            className="text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-slate-800 file:text-slate-300 w-full"
                          />
                          {page.imageDataUrl && (
                            <div className="relative w-full h-16 rounded-lg overflow-hidden border border-slate-700">
                              <img
                                src={page.imageDataUrl}
                                alt={`Page ${page.num}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                onClick={() =>
                                  setPages((prev) =>
                                    prev.map((p, i) =>
                                      i === pageIdx ? { ...p, imageDataUrl: null } : p
                                    )
                                  )
                                }
                                className="absolute top-1 right-1 p-1 bg-slate-950/80 text-rose-400 rounded"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          )}
                          <textarea
                            value={page.text}
                            onChange={(e) => updatePageText(pageIdx, e.target.value)}
                            placeholder="Story text…"
                            className="w-full h-16 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 resize-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Cover tab */}
          {tab === 'cover' && (
            <div className="flex-1 p-4 overflow-y-auto space-y-5">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Cover Design
                </h2>
                <p className="text-xs text-slate-400">
                  Upload cover art — full wrap or individual pieces.
                </p>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-teal-400 flex items-center gap-2">
                  <ImageIcon size={14} /> Full Wrap Dust Jacket
                </label>
                <p className="text-[10px] text-slate-500">Auto-splits back / spine / front.</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCoverUpload('fullWrap', f);
                  }}
                  className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white w-full"
                />
                {covers.fullWrap && (
                  <img src={covers.fullWrap} alt="Full wrap" className="w-full rounded-lg border border-slate-700" />
                )}
              </div>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-800" />
                <span className="mx-3 text-[10px] uppercase text-slate-500 font-bold">
                  Or components
                </span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              {(['front', 'back', 'spine'] as const).map((type) => (
                <div key={type} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <label className="text-xs font-semibold text-slate-300 block mb-1 capitalize">
                    {type} Cover
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCoverUpload(type, f);
                    }}
                    className="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 w-full"
                  />
                  {covers[type] && (
                    <img
                      src={covers[type]!}
                      alt={`${type} cover`}
                      className={`mt-2 rounded-lg border border-slate-700 ${
                        type === 'spine' ? 'h-24 w-auto' : 'w-full'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Export tab */}
          {tab === 'export' && (
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <div className="bg-teal-950/30 border border-teal-500/30 p-4 rounded-2xl">
                <h3 className="text-sm font-bold text-teal-300 flex items-center gap-2 mb-1">
                  <BookOpen size={16} /> Interactive 3D HTML Reader
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Compiles your whole book into a standalone 3D WebGL file for the library — text,
                  images, and cover all embedded.
                </p>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 active:scale-95 transition-all disabled:opacity-60"
                >
                  {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                  {exporting ? 'Compiling…' : 'Download 3D Reader (.html)'}
                </button>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-3">
                <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <RefreshCw size={14} /> Studio Info
                </h3>
                <div className="text-xs text-slate-400 space-y-1">
                  <p>Pages: {pages.length}</p>
                  <p>Spreads: {totalSpreads}</p>
                  <p>Cover: {covers.fullWrap ? 'Full wrap' : covers.front ? 'Custom front' : 'Default'}</p>
                  <p className="pt-2 text-slate-500">
                    Save before exporting to capture the latest edits from both collaborators.
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* 3D viewport */}
        <main className="flex-1 relative bg-slate-950 overflow-hidden">
          <div ref={canvasRef} className="w-full h-full absolute inset-0 canvas-container" />

          {/* Bottom HUD */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 w-full max-w-xl px-4">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-2.5 rounded-2xl shadow-2xl flex items-center justify-between w-full gap-4">
              <button
                onClick={() => engineRef.current?.prevSpread()}
                className="px-4 py-2 bg-slate-800 hover:bg-teal-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <div className="flex-1 text-center">
                <span className="text-xs font-extrabold text-white block">
                  Pages {pages[activeSpread * 2]?.num} & {pages[activeSpread * 2 + 1]?.num}
                </span>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mt-1 border border-slate-800">
                  <div
                    className="h-full bg-teal-500 transition-all duration-300"
                    style={{ width: `${((activeSpread + 1) / totalSpreads) * 100}%` }}
                  />
                </div>
              </div>
              <button
                onClick={() => engineRef.current?.nextSpread()}
                className="px-4 py-2 bg-slate-800 hover:bg-teal-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => engineRef.current?.toggleBookState()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-teal-600/30 active:scale-95"
              >
                <BookOpen size={14} /> Open / Close
              </button>
              <button
                onClick={() => engineRef.current?.toggleAutoSpin()}
                className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-800 rounded-xl text-xs font-semibold text-teal-400 transition-all shadow-lg"
              >
                Spin
              </button>
              <button
                onClick={() => engineRef.current?.toggleAutoFloat()}
                className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-800 rounded-xl text-xs font-semibold text-teal-400 transition-all shadow-lg"
              >
                Float
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
