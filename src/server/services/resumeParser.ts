import path from 'node:path';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

export interface ParsedResumeFile {
  filename: string;
  fileFormat: 'pdf' | 'docx' | 'txt' | 'md';
  rawText: string;
}

export async function parseResumeBuffer(
  buffer: Buffer,
  originalFilename: string
): Promise<ParsedResumeFile> {
  const ext = path.extname(originalFilename).toLowerCase().replace('.', '');

  if (ext === 'pdf') {
    const uint8 = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8);
    const { text } = await extractText(pdf, { mergePages: true });
    const cleaned = (Array.isArray(text) ? text.join('\n') : String(text ?? '')).trim();
    if (!cleaned) {
      throw new Error(
        'Could not extract text from PDF. If your PDF is a scanned image, paste your resume text directly.'
      );
    }
    return {
      filename: originalFilename,
      fileFormat: 'pdf',
      rawText: cleaned,
    };
  }

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    const cleaned = (result.value ?? '').trim();
    if (!cleaned) {
      throw new Error('The uploaded .docx file did not contain extractable text.');
    }
    return {
      filename: originalFilename,
      fileFormat: 'docx',
      rawText: cleaned,
    };
  }

  if (ext === 'md' || ext === 'markdown') {
    const cleaned = buffer.toString('utf8').trim();
    if (!cleaned) throw new Error('The uploaded Markdown file is empty.');
    return {
      filename: originalFilename,
      fileFormat: 'md',
      rawText: cleaned,
    };
  }

  // Default plain text (.txt or text-like)
  const cleaned = buffer.toString('utf8').trim();
  if (!cleaned) throw new Error('The uploaded text file is empty.');
  return {
    filename: originalFilename,
    fileFormat: 'txt',
    rawText: cleaned,
  };
}
