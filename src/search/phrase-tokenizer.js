import fs from "fs";
var phrasesModel = JSON.parse(
  fs.readFileSync("./data/wiki-world-model.json", "utf8")
);

/**
 * Query Resolution to Phrase & Topic Tokenization -
 * returns a list of phrases that are found in
 * the WikiWorldModel that match the input phrase, 
 * or just the single word if found
 * @param {string} phrase
 * @returns {Array}
 */
export default function queryPhraseTokenizer(phrase) {
  //strip non-alphanumeric characters from query
  phrase = phrase.replace(/[^a-zA-Z0-9\s]/g, "");

  //split into words
  var words = phrase.toLowerCase().split(/\W+/);
  var topics = [];
  for (var i = 0; i < words.length; i++) {
    var word = words[i];

    //Find next word phrase completion list 
    var firstTwoLetters = word.slice(0, 2);
    var possiblePhrases = phrasesModel[firstTwoLetters]
      ? phrasesModel[firstTwoLetters][word]
      : null;

    if (possiblePhrases) {
      var maxPhraseLength = 1;
      var singleWordObj = null;
      var isPhraseFound = false;

      //calculate max possible length of phrase of next words
      for (var p of possiblePhrases)
        if (p.n?.length > maxPhraseLength) 
          maxPhraseLength = p.n.length;

      //grab that length of text from next words
      var nextWords = "";
      for (var j = 1; j < words.length - i; j++) {
        nextWords += (words[i + j] || "") + " ";

        if (nextWords.length >= maxPhraseLength) break;
      }

      for (var phrase of possiblePhrases) {
        //if no next phrase, preserve the single word
        //it culd also be not in the dict first word
        if (phrase && !phrase.n) {
          phrase.full = word;
          singleWordObj = phrase;
        } else {
          //add next word to the phrase up to maxPhraseLength
          if (!isPhraseFound && nextWords.startsWith(phrase.n)) {
            phrase.full = word + " " + phrase.n;
            topics.push(phrase);

            //skip looping thru the next words added to phrase
            i += phrase.n?.split(" ").length; //TODO fi

            //suppress single-word "red" if "red wine" is found
            isPhraseFound = true;

            break;
          }
        }
      }

      //if no phrases then add the single word
      if (!isPhraseFound) {
        singleWordObj = singleWordObj || { full: word }; // could be not in dict but starter of hrases
        topics.push(singleWordObj);
      }
    }

    //if word not in dict, add it as a single word
    if (!possiblePhrases) {
      topics.push({ notDict: 1, full: word });
    }
  }

  return topics;
}

/**
 * Calculate overall domain-speicificity after Query Resolution to Phrases
 * @param {string} phrase
 * @returns {number} domain specificity 0-12~
 */
export function calculatePhraseSpecificity(phrase) {
  var tokensWithFreq = queryPhraseTokenizer(phrase).filter((r) => r.u);

  return ( 
    tokensWithFreq.reduce((acc, r) => acc + r.u, 0) / tokensWithFreq.length
  );
}