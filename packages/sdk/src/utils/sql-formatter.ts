/**
 * SQL Formatter Utility
 * Handles cleaning Java/StringBuilder noise and formatting SQL with nested indentation.
 */

export function cleanAndFormatSql(input: string): string {
  let sql = input;
  if (!sql) return '';

  // 1. Pre-cleaning (Java append / concatenations)
  const isJavaStyle = sql.includes('.append(') || (sql.includes('"') && (sql.includes('+') || sql.includes(';')));
  if (isJavaStyle) {
    const lines = sql.split('\n');
    sql = lines.map(line => {
      let l = line.trim();
      l = l.replace(/^.*\.?append\s*\(\s*"/i, '');
      l = l.replace(/^.*?\+?=\s*"/i, '');
      l = l.replace(/"\s*\)\s*;?$/, '');
      l = l.replace(/"\s*;?$/, '');
      l = l.replace(/"\s*\+\s*[^"\+]+\s*\+\s*"/g, ' ? ');
      l = l.replace(/"\s*\+\s*[^"\+]+$/g, ' ?');
      l = l.replace(/^[^"\+]+\s*\+\s*"/g, '? ');
      return l;
    }).join(' ');
  }

  // 2. Tokenize
  sql = sql.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').replace(/,/g, ' , ').replace(/\s+/g, ' ').trim();
  const tokens = sql.split(' ');
  
  // 3. Keywords & Formatting Logic
  const majorKeywords = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'UPDATE', 'SET', 'INSERT INTO', 'DELETE FROM', 'UNION', 'UNION ALL', 'VALUES'];
  const minorKeywords = ['AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'ON', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'];
  
  let result = '';
  let indentLevel = 0;
  const tab = '\t';

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const upperToken = token.toUpperCase();
    
    // Check for multi-word keywords
    let combinedToken = token;
    
    if (upperToken === 'GROUP' || upperToken === 'ORDER') {
      if (tokens[i+1]?.toUpperCase() === 'BY') { combinedToken += ' ' + tokens[++i]; }
    } else if (upperToken === 'INSERT' && tokens[i+1]?.toUpperCase() === 'INTO') {
      combinedToken += ' ' + tokens[++i];
    } else if (upperToken === 'DELETE' && tokens[i+1]?.toUpperCase() === 'FROM') {
      combinedToken += ' ' + tokens[++i];
    } else if (upperToken === 'UNION' && tokens[i+1]?.toUpperCase() === 'ALL') {
      combinedToken += ' ' + tokens[++i];
    } else if (['LEFT', 'RIGHT', 'INNER', 'OUTER'].includes(upperToken) && tokens[i+1]?.toUpperCase() === 'JOIN') {
      combinedToken += ' ' + tokens[++i];
    }

    const upperCombined = combinedToken.toUpperCase();

    if (majorKeywords.includes(upperCombined)) {
      // Start a new line at current indent
      if (result.length > 0) result = result.trimEnd() + '\n' + tab.repeat(indentLevel);
      result += upperCombined + '\n' + tab.repeat(indentLevel + 1);
    } else if (minorKeywords.includes(upperCombined)) {
      // Indent minor keywords
      result = result.trimEnd() + '\n' + tab.repeat(indentLevel + 1) + upperCombined + ' ';
    } else if (token === '(') {
      result = result.trimEnd() + ' (\n' + tab.repeat(++indentLevel + 1);
    } else if (token === ')') {
      indentLevel = Math.max(0, indentLevel - 1);
      result = result.trimEnd() + '\n' + tab.repeat(indentLevel + 1) + ') ';
    } else if (token === ',') {
      result = result.trimEnd() + ',\n' + tab.repeat(indentLevel + 1);
    } else {
      result += token + ' ';
    }
  }

  // Cleanup: remove any triple newlines or extra spaces at end of lines
  return result.trim()
    .replace(/\n\s*\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
}
