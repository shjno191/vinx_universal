const lines = [
    '	$drop_item_id = 0',
    '	if $arglv < 30',
    '		$drop_item_id = 60319',
    '	endif',
    '	if $arglv >= 30',
    '		if $arglv < 45',
    '			$drop_item_id = 60320',
    '		endif',
    '	endif',
    '	$indexW = 0',
    '	while $indexW < 6',
    '		$member_id = GetTeamMemberID( -1, $indexW )',
    '		$indexW = $indexW + 1',
    '		if $member_id != -1',
    '			$dis = GetPlayerDistance( -1, $member_id )',
    '			if $dis >= 0',
    '				if $dis <= 30',
    '					if $drop_item_id > 0',
    '						DropMonsterItems( $member_id, $drop_item_id )',
    '					endif',
];
const word = '$drop_item_id';
const positionLine = 20; // DropMonsterItems( $member_id, $drop_item_id )

const escapedWord = word.replace('$', '\\$').replace('#', '\\#');
console.log('Escaped:', escapedWord);
const regex = new RegExp(`(?:int|string|float)\\s+${escapedWord}\\b|${escapedWord}\\s*=(?!=)`);
console.log('Regex:', regex);

let targetLine = -1;
let targetCol = -1;

for (let i = positionLine - 1; i >= 0; i--) {
    const match = lines[i].match(regex);
    if (match) {
        targetLine = i + 1;
        targetCol = match.index + 1;
        console.log('MATCHED AT LINE', targetLine, lines[i]);
        break;
    }
}
console.log('Result:', targetLine, targetCol);
