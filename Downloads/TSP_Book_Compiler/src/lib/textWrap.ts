import type { BookPage } from '@/types';

export interface WrapResult {
  lines: string[];
  overflowText: string;
}

export function getWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  lineHeight: number
): WrapResult {
  const lines: string[] = [];
  if (!text) return { lines, overflowText: '' };

  const paragraphs = text.split('\n');
  const maxLines = Math.floor(maxHeight / lineHeight);

  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p];
    const words = para.split(' ');
    let currentLine = '';

    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          if (lines.length >= maxLines) {
            const remainingInPara = words.slice(w).join(' ');
            const overflow = [remainingInPara, ...paragraphs.slice(p + 1)].join('\n');
            return { lines, overflowText: overflow };
          }
          currentLine = '';
        }

        if (ctx.measureText(word).width > maxWidth) {
          for (let c = 0; c < word.length; c++) {
            const char = word[c];
            const testCharLine = currentLine + char;
            if (ctx.measureText(testCharLine).width <= maxWidth) {
              currentLine = testCharLine;
            } else {
              lines.push(currentLine);
              if (lines.length >= maxLines) {
                const remainingWord = word.slice(c);
                const remainingInPara =
                  w + 1 < words.length ? ' ' + words.slice(w + 1).join(' ') : '';
                const overflow = [remainingWord + remainingInPara, ...paragraphs.slice(p + 1)].join(
                  '\n'
                );
                return { lines, overflowText: overflow };
              }
              currentLine = char;
            }
          }
        } else {
          currentLine = word;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
      if (lines.length >= maxLines && p < paragraphs.length - 1) {
        const overflow = paragraphs.slice(p + 1).join('\n');
        return { lines, overflowText: overflow };
      }
      currentLine = '';
    }
  }

  return { lines, overflowText: '' };
}

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d')!;

export function reflowPages(pages: BookPage[], startIdx: number): BookPage[] {
  measureCtx.font = "bold 44px 'Fredoka'";

  const maxWidth = 840;
  const lineHeight = 60;

  for (let i = startIdx; i < pages.length; i++) {
    const p = pages[i];
    if (p.fullPage) continue;

    const availableHeight = p.imageDataUrl ? 300 : 1080;
    const result = getWrappedLines(measureCtx, p.text || '', maxWidth, availableHeight, lineHeight);

    if (result.overflowText && result.overflowText.trim().length > 0) {
      pages[i] = { ...p, text: result.lines.join('\n') };

      const nextIdx = i + 1;
      if (nextIdx >= pages.length) {
        const nextNum = pages.length + 1;
        pages.push(
          { num: nextNum, text: '', fullPage: false, imageDataUrl: null },
          { num: nextNum + 1, text: '', fullPage: false, imageDataUrl: null }
        );
      }

      const nextPage = pages[nextIdx];
      if (nextPage.text && nextPage.text.trim().length > 0) {
        pages[nextIdx] = { ...nextPage, text: result.overflowText + '\n' + nextPage.text };
      } else {
        pages[nextIdx] = { ...nextPage, text: result.overflowText };
      }
    }
  }

  pages.forEach((p, idx) => (p.num = idx + 1));
  return pages;
}
