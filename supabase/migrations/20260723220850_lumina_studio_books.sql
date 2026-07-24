/*
# Lumina 3D Book Studio — books and pages

## Purpose
Stores collaborative 3D picture books for the Lumina studio. The studio is a
SHARED workspace: a small team (author + illustrator/co-author) signs in and
works on the same shelf of up to 5 books together. All signed-in users share
read/write access to every book — this is intentional collaboration, not
per-user isolation.

## New tables
1. `books`
   - id (uuid, PK)
   - title (text, default 'Untitled Book')
   - author_name (text, default 'Author')
   - illustrator_name (text, default 'Illustrator')
   - owner_id (uuid, defaults to the signed-in user who created the book)
   - covers (jsonb: { front, back, spine, fullWrap } cover image data URLs)
   - cover_thumbnail (text: small front-cover data URL for the shelf display)
   - updated_at (timestamptz, auto-refreshed on update)
   - created_at (timestamptz)

2. `book_pages`
   - id (uuid, PK)
   - book_id (uuid, FK -> books ON DELETE CASCADE)
   - page_num (int, unique per book)
   - text (text, page narrative)
   - full_page (boolean, full-bleed illustration flag)
   - image_data_url (text, page illustration data URL, nullable)
   - created_at (timestamptz)

## Helpers
- `set_updated_at()` trigger function + trigger to keep books.updated_at fresh.

## Security (RLS)
- RLS enabled on both tables.
- Policies: any AUTHENTICATED studio member can SELECT/INSERT/UPDATE/DELETE.
  This is a deliberately shared collaborative workspace (author + illustrator
  editing the same books), so access is NOT restricted per user. Anonymous
  access is NOT allowed — you must sign in to use the studio.

## Notes
- The 5-book shelf limit is enforced in the application UI, not at the DB level.
- Page/cover images are stored as compressed data URLs (text) so the downloaded
  3D book HTML stays fully self-contained / standalone.
*/

CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Untitled Book',
  author_name text NOT NULL DEFAULT 'Author',
  illustrator_name text NOT NULL DEFAULT 'Illustrator',
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  covers jsonb NOT NULL DEFAULT '{"front": null, "back": null, "spine": null, "fullWrap": null}'::jsonb,
  cover_thumbnail text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS book_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_num int NOT NULL,
  text text NOT NULL DEFAULT '',
  full_page boolean NOT NULL DEFAULT false,
  image_data_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(book_id, page_num)
);

CREATE INDEX IF NOT EXISTS idx_book_pages_book_id ON book_pages(book_id);
CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at DESC);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_pages ENABLE ROW LEVEL SECURITY;

-- books: shared collaborative workspace (any signed-in member)
DROP POLICY IF EXISTS "books_select_authenticated" ON books;
CREATE POLICY "books_select_authenticated" ON books FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "books_insert_authenticated" ON books;
CREATE POLICY "books_insert_authenticated" ON books FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "books_update_authenticated" ON books;
CREATE POLICY "books_update_authenticated" ON books FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "books_delete_authenticated" ON books;
CREATE POLICY "books_delete_authenticated" ON books FOR DELETE
  TO authenticated USING (true);

-- book_pages: shared collaborative workspace (any signed-in member)
DROP POLICY IF EXISTS "pages_select_authenticated" ON book_pages;
CREATE POLICY "pages_select_authenticated" ON book_pages FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "pages_insert_authenticated" ON book_pages;
CREATE POLICY "pages_insert_authenticated" ON book_pages FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "pages_update_authenticated" ON book_pages;
CREATE POLICY "pages_update_authenticated" ON book_pages FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "pages_delete_authenticated" ON book_pages;
CREATE POLICY "pages_delete_authenticated" ON book_pages FOR DELETE
  TO authenticated USING (true);

-- updated_at auto-refresh for books
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_books_updated_at ON books;
CREATE TRIGGER trg_books_updated_at BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
