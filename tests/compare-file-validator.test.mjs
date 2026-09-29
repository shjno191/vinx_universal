import { describe, it, expect } from 'vitest';
import { 
  getFileExtension, 
  detectFileCategory, 
  validateDroppedFile, 
  isBinaryContent 
} from '../packages/plugins/compare/src/file-validator.ts';

describe('Compare Tab File Validator', () => {
  it('correctly extracts file extensions', () => {
    expect(getFileExtension('hello.txt')).toBe('txt');
    expect(getFileExtension('C:\\Users\\test\\file.BOI')).toBe('boi');
    expect(getFileExtension('/path/to/archive.tar.gz')).toBe('gz');
    expect(getFileExtension('no-extension')).toBe('');
    expect(getFileExtension('.gitignore')).toBe('');
  });

  it('detects image files correctly', () => {
    expect(detectFileCategory('photo.png')).toBe('image');
    expect(detectFileCategory('image.JPG')).toBe('image');
    expect(detectFileCategory('screenshot.webp')).toBe('image');
    expect(detectFileCategory('icon.svg')).toBe('image');
    expect(detectFileCategory('unknown.file', 'image/jpeg')).toBe('image');
  });

  it('detects text and code files correctly', () => {
    expect(detectFileCategory('script.boi')).toBe('text');
    expect(detectFileCategory('test.txt')).toBe('text');
    expect(detectFileCategory('Main.java')).toBe('text');
    expect(detectFileCategory('index.ts')).toBe('text');
    expect(detectFileCategory('query.sql')).toBe('text');
    expect(detectFileCategory('data.csv')).toBe('text');
    expect(detectFileCategory('Dockerfile')).toBe('text');
    expect(detectFileCategory('Makefile')).toBe('text');
  });

  it('detects excel files and marks them invalid for text compare', () => {
    expect(detectFileCategory('financials.xlsx')).toBe('excel');
    expect(detectFileCategory('report.xls')).toBe('excel');
    
    const result = validateDroppedFile('budget.xlsx');
    expect(result.valid).toBe(false);
    expect(result.category).toBe('excel');
    expect(result.errorMessage).toContain('Excel spreadsheet');
  });

  it('detects binary files and marks them invalid', () => {
    expect(detectFileCategory('app.exe')).toBe('binary');
    expect(detectFileCategory('lib.dll')).toBe('binary');
    expect(detectFileCategory('bundle.zip')).toBe('binary');
    expect(detectFileCategory('document.pdf')).toBe('binary');
    
    const result = validateDroppedFile('program.exe');
    expect(result.valid).toBe(false);
    expect(result.category).toBe('binary');
    expect(result.errorMessage).toContain('Binary file');
  });

  it('detects binary content containing null bytes', () => {
    const textContent = 'Hello world! This is normal text\nLine 2\tTabbed';
    expect(isBinaryContent(textContent)).toBe(false);

    const binaryContent = 'GIF89a\x00\x01\x00\x01\x00\x80';
    expect(isBinaryContent(binaryContent)).toBe(true);

    const validated = validateDroppedFile('unknown.dat', undefined, binaryContent);
    expect(validated.valid).toBe(false);
    expect(validated.category).toBe('binary');
  });

  it('allows text content even with unknown extension if content is plain text', () => {
    const textContent = 'key=value\nfoo=bar';
    const validated = validateDroppedFile('custom.conf123', undefined, textContent);
    expect(validated.valid).toBe(true);
    expect(validated.category).toBe('text');
  });
});
