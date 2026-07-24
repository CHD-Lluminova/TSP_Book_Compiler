export type StudioRole = 'author' | 'illustrator';

export interface Covers {
  front: string | null;
  back: string | null;
  spine: string | null;
  fullWrap: string | null;
}

export interface BookPage {
  num: number;
  text: string;
  fullPage: boolean;
  imageDataUrl: string | null;
}

export interface BookRow {
  id: string;
  title: string;
  author_name: string;
  illustrator_name: string;
  owner_id: string | null;
  covers: Covers | null;
  cover_thumbnail: string | null;
  updated_at: string;
  created_at: string;
}

export interface BookPageRow {
  id: string;
  book_id: string;
  page_num: number;
  text: string;
  full_page: boolean;
  image_data_url: string | null;
  created_at: string;
}

export interface FullBook extends BookRow {
  pages: BookPage[];
}

export const MAX_BOOKS = 5;

export const DEFAULT_PAGES: BookPage[] = [
  {
    num: 1,
    text: "Once upon a time, in a little house at the edge of a whispering forest, a curious child discovered a tiny, glowing door hidden behind the old oak tree.",
    fullPage: false,
    imageDataUrl: null,
  },
  {
    num: 2,
    text: "The door was no taller than a teacup, but it hummed with a warm golden light that seemed to invite the child to step closer and listen.",
    fullPage: false,
    imageDataUrl: null,
  },
];
