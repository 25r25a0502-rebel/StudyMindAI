import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import officeParser from 'officeparser';
import Tesseract from 'tesseract.js';
import { cleanText } from '../../utils/chunking.js';

// Returns [{page, text}] normalized across formats
export async function extractText(buffer, mime, filename) {
  const name = (filename || '').toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    let pages = (data.text || '').split('\f').map((t, i) => ({ page: i + 1, text: t }));
    if (!cleanText(data.text) || (data.numpages > 0 && needsOcr(pages))) {
      // Fallback OCR note: full image-render OCR needs pdfjs raster; try OCR on empty text
      const { data: ocr } = await Tesseract.recognize(buffer, 'eng');
      if (cleanText(ocr.text)) pages = [{ page: 1, text: ocr.text }];
    }
    return { pages, pageCount: data.numpages || pages.length };
  }
  if (name.endsWith('.docx') || mime.includes('wordprocessingml')) {
    const { value } = await mammoth.extractRawText({ buffer });
    return { pages: [{ page: 1, text: value }], pageCount: 1 };
  }
  if (name.endsWith('.pptx') || name.endsWith('.ppt')) {
    const text = await new Promise((resolve, reject) =>
      officeParser.parseOfficeAsync(buffer, (d, err) => err ? reject(err) : resolve(d)));
    return { pages: [{ page: 1, text: String(text) }], pageCount: 1 };
  }
  if (mime.startsWith('text/') || name.endsWith('.txt')) {
    return { pages: [{ page: 1, text: buffer.toString('utf-8') }], pageCount: 1 };
  }
  if (mime.startsWith('image/')) {
    const { data } = await Tesseract.recognize(buffer, 'eng');
    return { pages: [{ page: 1, text: data.text }], pageCount: 1 };
  }
  throw Object.assign(new Error('Unsupported file type'), { status: 400 });
}
function needsOcr(pages) {
  const nonEmpty = pages.filter(p => cleanText(p.text).length > 50);
  return nonEmpty.length < pages.length * 0.3; // mostly empty => scanned
}
