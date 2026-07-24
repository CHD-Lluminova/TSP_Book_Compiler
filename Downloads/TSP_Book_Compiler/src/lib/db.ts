import { supabase } from './supabase';
import { reflowPages } from './textWrap';
import { compressImage, generateThumbnail } from './imageUtils';
import type { BookRow, BookPage, Covers, FullBook } from '@/types';
import { DEFAULT_PAGES, MAX_BOOKS } from '@/types';

function normalizeCovers(covers: Covers | null): Covers {
  if (!covers) return { front: null, back: null, spine: null, fullWrap: null };
  return {
    front: covers.front ?? null,
    back: covers.back ?? null,
    spine: covers.spine ?? null,
    fullWrap: covers.fullWrap ?? null,
  };
}

export async function fetchBooks(): Promise<BookRow[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []) as BookRow[];
}

export async function fetchFullBook(bookId: string): Promise<FullBook> {
  const { data: book, error: bookErr } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .maybeSingle();
  if (bookErr) throw bookErr;
  if (!book) throw new Error('Book not found');

  const { data: pageRows, error: pagesErr } = await supabase
    .from('book_pages')
    .select('*')
    .eq('book_id', bookId)
    .order('page_num', { ascending: true });
  if (pagesErr) throw pagesErr;

  const pages: BookPage[] = (pageRows || []).map((r: any) => ({
    num: r.page_num,
    text: r.text || '',
    fullPage: r.full_page || false,
    imageDataUrl: r.image_data_url || null,
  }));

  const finalPages = pages.length > 0 ? pages : DEFAULT_PAGES.map((p) => ({ ...p }));

  return {
    ...(book as BookRow),
    covers: normalizeCovers((book as BookRow).covers),
    pages: finalPages,
  };
}

export async function createBook(title: string): Promise<BookRow> {
  const { count, error: countErr } = await supabase
    .from('books')
    .select('*', { count: 'exact', head: true });
  if (countErr) throw countErr;
  if ((count ?? 0) >= MAX_BOOKS) {
    throw new Error(`The shelf holds ${MAX_BOOKS} books. Delete one to make room.`);
  }

  const { data, error } = await supabase
    .from('books')
    .insert({ title })
    .select('*')
    .single();
  if (error) throw error;
  return data as BookRow;
}

export async function deleteBook(bookId: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', bookId);
  if (error) throw error;
}

export async function saveBookMeta(
  bookId: string,
  fields: { title?: string; author_name?: string; illustrator_name?: string }
): Promise<void> {
  const { error } = await supabase.from('books').update(fields).eq('id', bookId);
  if (error) throw error;
}

export async function saveCovers(bookId: string, covers: Covers): Promise<void> {
  const processed: Covers = { front: null, back: null, spine: null, fullWrap: null };

  if (covers.fullWrap) {
    processed.fullWrap = await compressImage(covers.fullWrap, 2200, 0.85);
  }
  if (covers.front) {
    processed.front = await compressImage(covers.front, 1100, 0.9);
  }
  if (covers.back) {
    processed.back = await compressImage(covers.back, 1100, 0.9);
  }
  if (covers.spine) {
    processed.spine = await compressImage(covers.spine, 256, 0.9);
  }

  const updateFields: Record<string, any> = { covers: processed };

  if (processed.front) {
    updateFields.cover_thumbnail = await generateThumbnail(processed.front, 280);
  } else if (processed.fullWrap) {
    updateFields.cover_thumbnail = await generateThumbnail(processed.fullWrap, 280);
  }

  const { error } = await supabase
    .from('books')
    .update(updateFields)
    .eq('id', bookId);
  if (error) throw error;
}

export async function savePage(
  bookId: string,
  pageNum: number,
  fields: { text?: string; full_page?: boolean; image_data_url?: string | null }
): Promise<void> {
  let toSave = { ...fields };
  if (fields.image_data_url) {
    toSave.image_data_url = await compressImage(fields.image_data_url, 1100, 0.85);
  }

  const { error } = await supabase
    .from('book_pages')
    .update(toSave)
    .eq('book_id', bookId)
    .eq('page_num', pageNum);
  if (error) throw error;
}

export async function upsertPage(
  bookId: string,
  page: BookPage
): Promise<void> {
  let imageDataUrl = page.imageDataUrl;
  if (imageDataUrl) {
    imageDataUrl = await compressImage(imageDataUrl, 1100, 0.85);
  }

  const { error } = await supabase.from('book_pages').upsert(
    {
      book_id: bookId,
      page_num: page.num,
      text: page.text,
      full_page: page.fullPage,
      image_data_url: imageDataUrl,
    },
    { onConflict: 'book_id,page_num' }
  );
  if (error) throw error;
}

export async function deletePagesAfter(bookId: string, keepCount: number): Promise<void> {
  const { error } = await supabase
    .from('book_pages')
    .delete()
    .eq('book_id', bookId)
    .gt('page_num', keepCount);
  if (error) throw error;
}

export async function bulkSaveBook(bookId: string, pages: BookPage[]): Promise<void> {
  const processed = reflowPages(pages.map((p) => ({ ...p })), 0);

  const rows = processed.map((p) => ({
    book_id: bookId,
    page_num: p.num,
    text: p.text,
    full_page: p.fullPage,
    image_data_url: p.imageDataUrl,
  }));

  const { error: delErr } = await supabase
    .from('book_pages')
    .delete()
    .eq('book_id', bookId);
  if (delErr) throw delErr;

  const { error } = await supabase.from('book_pages').insert(rows);
  if (error) throw error;
}
