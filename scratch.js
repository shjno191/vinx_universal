const lines = [
    "    if $arglv >= 75",
    "        $drop_item_id = 60324",
    "    endif",
    "    if $drop_item_id > 0"
];
const escapedWord = "\\\\$drop_item_id";
const regex = new RegExp("(?:int|string|float)\\\\s+" + escapedWord + "\\\\b|" + escapedWord + "\\\\s*=(?!=)");
console.log(regex);
for (let i = 3; i >= 0; i--) {
    const match = lines[i].match(regex);
    console.log("line " + i + " match:", match);
}
