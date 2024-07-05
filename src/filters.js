import wikiTermFrequency from "../data/wiki-word-freq-1m.js";
import fs from "fs";

function removeNonEnglish(text) {
    // This regex keeps English letters, numbers, common punctuation, and spaces
    // const regex = /[^\p{Script=Latin}\p{N}\p{P}\s]/gu;

    const regex = /^[\d\p{P}\p{S}]+$/u;
    return regex.test(text);
}


var words = Object.keys(wikiTermFrequency);
for (let term of words) {
    if (removeNonEnglish(term)) {
        console.log(term);

        delete wikiTermFrequency[term];
    }
}

console.log(Object.keys(wikiTermFrequency).length);

fs.writeFileSync("./data/wiki-word-freq-862580.js", 
    "export default " +JSON.stringify(wikiTermFrequency));
