import { supabaseAdmin } from '../../config/supabase.js';
import { config } from '../../config/index.js';
import { extractText } from './extract.js';
import { chunkText, cleanText } from '../../utils/chunking.js';
import { llm, withBackoff } from '../llm/provider.js';

export async function processDocument(docId, userId, fileBuffer, mime, filename) {
  const set = (patch) => supabaseAdmin.from('documents').update(patch).eq('id', docId);
  const log = (...a) => console.log(`[ingest ${docId.slice(0, 8)}]`, ...a);
  try {
    log('start', filename, mime, `${fileBuffer.length} bytes`);
    await set({ status: 'extracting' });
    const { pages, pageCount } = await extractText(fileBuffer, mime, filename);
    const full = cleanText(pages.map(p => p.text).join('\n'));
    log(`extracted ${full.length} chars from ${pageCount} pages`);
    if (!full || full.length < 50) throw new Error('No extractable text found (even after OCR).');
    const chunks = chunkText(pages);
    log(`${chunks.length} chunks`);
    await set({ status: 'embedding', page_count: pageCount, char_count: full.length });
    // embed in batches of 32
    for (let i = 0; i < chunks.length; i += 32) {
      const batch = chunks.slice(i, i + 32);
      const vectors = await withBackoff(() => llm.embed(batch.map(b => b.content)));
      const rows = batch.map((b, j) => ({
        document_id: docId, user_id: userId, content: b.content,
        embedding: vectors[j], page_number: b.page_number,
        chunk_index: b.chunk_index, token_count: b.token_count
      }));
      const { error } = await supabaseAdmin.from('document_chunks').insert(rows);
      if (error) throw error;
    }
    await set({ status: 'ready', error_message: null });
    log('done → ready');
  } catch (e) {
    log('FAILED:', e.message);
    await supabaseAdmin.from('documents').update({ status: 'failed', error_message: e.message }).eq('id', docId);
  }
}

export async function processRawText(docId, userId, text) {
  const set = (patch) => supabaseAdmin.from('documents').update(patch).eq('id', docId);
  try {
    await set({ status: 'embedding' });
    const chunks = chunkText([{ page: 1, text }]);
    for (let i = 0; i < chunks.length; i += 32) {
      const batch = chunks.slice(i, i + 32);
      const vectors = await withBackoff(() => llm.embed(batch.map(b => b.content)));
      const rows = batch.map((b, j) => ({
        document_id: docId, user_id: userId, content: b.content,
        embedding: vectors[j], page_number: b.page_number,
        chunk_index: b.chunk_index, token_count: b.token_count
      }));
      const { error } = await supabaseAdmin.from('document_chunks').insert(rows);
      if (error) throw error;
    }
    await set({ status: 'ready', page_count: 1, char_count: text.length });
  } catch (e) {
    await set({ status: 'failed', error_message: e.message });
  }
}
