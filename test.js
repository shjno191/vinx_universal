const word = '$drop_item_id';
const escapedWord = word.replace('$', '\\$');
console.log('escapedWord length:', escapedWord.length, escapedWord); 
const regex = new RegExp('(?:int|string|float)\\\\s+' + escapedWord + '\\\\b|' + escapedWord + '\\\\s*=(?!=)');
console.log('regex:', regex); 
console.log('test:', regex.test('    $drop_item_id = 0')); 

