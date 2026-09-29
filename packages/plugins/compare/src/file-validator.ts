/**
 * File detection and validation utilities for Compare tab.
 * Detects whether dropped files are text/code, images, Excel, or unsupported binary.
 */

export type FileCategory = 'text' | 'image' | 'excel' | 'binary' | 'unknown';

export interface FileValidationResult {
  valid: boolean;
  category: FileCategory;
  fileName: string;
  extension: string;
  errorMessage?: string;
  actionMessage?: string;
}

export const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif', 'avif'
]);

export const EXCEL_EXTENSIONS = new Set([
  'xls', 'xlsx', 'xlsm', 'xlsb'
]);

export const BINARY_EXTENSIONS = new Set([
  'exe', 'dll', 'so', 'dylib', 'bin', 'iso', 'img', 'dmg',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'cab',
  'pdf', 'doc', 'docx', 'ppt', 'pptx',
  'class', 'jar', 'war', 'ear', 'pyc', 'pyo', 'pyd',
  'o', 'obj', 'lib', 'a', 'wasm',
  'mp3', 'mp4', 'avi', 'mkv', 'mov', 'wav', 'flac', 'ogg', 'webm', 'm4a', 'wma',
  'apk', 'aab', 'msi', 'deb', 'rpm'
]);

export const KNOWN_TEXT_EXTENSIONS = new Set([
  'txt', 'text', 'boi', 'csv', 'tsv', 'json', 'xml', 'html', 'htm', 'xhtml',
  'css', 'scss', 'sass', 'less', 'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx',
  'java', 'sql', 'md', 'markdown', 'yaml', 'yml', 'py', 'pyw',
  'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hh', 'hxx', 'cs', 'go', 'rs',
  'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'ini', 'cfg', 'conf', 'env',
  'properties', 'log', 'diff', 'patch', 'vue', 'svelte', 'php', 'rb',
  'lua', 'r', 'dart', 'toml', 'proto', 'graphql', 'gql', 'swift', 'kt', 'kts',
  'gradle', 'vim', 'dockerfile', 'makefile'
]);

export function getFileExtension(fileNameOrPath: string): string {
  if (!fileNameOrPath) return '';
  const clean = fileNameOrPath.split(/[/\\]/).pop() || '';
  const dotIndex = clean.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === clean.length - 1) return '';
  return clean.slice(dotIndex + 1).toLowerCase().trim();
}

export function isBinaryContent(sample: string): boolean {
  if (!sample) return false;
  const len = Math.min(sample.length, 4096);
  let controlChars = 0;
  for (let i = 0; i < len; i++) {
    const code = sample.charCodeAt(i);
    // Null byte is a definitive binary indicator
    if (code === 0) return true;
    // Check for control characters (except common whitespace \t=9, \n=10, \r=13)
    if (code < 9 || (code > 10 && code < 13) || (code > 13 && code < 32)) {
      controlChars++;
    }
  }
  return len > 0 && (controlChars / len) > 0.1;
}

export function detectFileCategory(
  fileName: string,
  mimeType?: string,
  contentSample?: string
): FileCategory {
  const ext = getFileExtension(fileName);

  if (mimeType && mimeType.startsWith('image/')) {
    return 'image';
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    return 'image';
  }

  if (EXCEL_EXTENSIONS.has(ext)) {
    return 'excel';
  }

  if (BINARY_EXTENSIONS.has(ext)) {
    return 'binary';
  }

  if (KNOWN_TEXT_EXTENSIONS.has(ext)) {
    return 'text';
  }

  if (mimeType && (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml'))) {
    return 'text';
  }

  // Check common filenames without extension
  if (!ext && fileName) {
    const baseName = fileName.split(/[/\\]/).pop()?.toLowerCase() || '';
    if (['dockerfile', 'makefile', 'readme', 'license', 'hosts', 'gemfile', 'procfile'].includes(baseName)) {
      return 'text';
    }
  }

  // If content sample is provided, check for binary signatures
  if (contentSample !== undefined) {
    return isBinaryContent(contentSample) ? 'binary' : 'text';
  }

  // By default, any non-binary extension is treated as text
  return 'text';
}

export function validateDroppedFile(
  fileName: string,
  mimeType?: string,
  contentSample?: string
): FileValidationResult {
  const extension = getFileExtension(fileName);
  const category = detectFileCategory(fileName, mimeType, contentSample);

  switch (category) {
    case 'image':
      return {
        valid: true,
        category: 'image',
        fileName,
        extension,
        actionMessage: `Image file detected (${extension || 'image'}). Switched to Image Compare.`
      };
    case 'excel':
      return {
        valid: false,
        category: 'excel',
        fileName,
        extension,
        errorMessage: `Excel spreadsheet (.${extension}) is not supported in Text Compare. Please export to CSV or TSV.`
      };
    case 'binary':
      return {
        valid: false,
        category: 'binary',
        fileName,
        extension,
        errorMessage: `Binary file (.${extension || 'bin'}) is not supported. Please drop text/code files or images.`
      };
    case 'text':
    default:
      if (contentSample !== undefined && isBinaryContent(contentSample)) {
        return {
          valid: false,
          category: 'binary',
          fileName,
          extension,
          errorMessage: `File "${fileName}" contains binary data and cannot be compared.`
        };
      }
      return {
        valid: true,
        category: 'text',
        fileName,
        extension,
        actionMessage: `Text file (${extension || 'plain text'}) validated.`
      };
  }
}
