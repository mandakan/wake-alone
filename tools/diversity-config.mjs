// diversity-config.mjs — the dials for the cross-episode diversity check, in one
// place (mirrors spec.mjs). Imported by tools/diversity.mjs, its self-tests, and
// the validate.mjs corpus pass. The check is ADVISORY ONLY: it emits warnings and
// never errors, so it can never gate the build.
//
// To turn the whole thing off (incl. in CI): set `enabled` to false.
// To tune sensitivity: adjust the thresholds below.

export const DIVERSITY = {
  enabled: true,         // master switch — false removes the check everywhere, incl. CI
  shingleN: 4,           // Signal 1: phrase length (n-gram size) for shared-phrase detection
  phraseMinEpisodes: 2,  // Signal 1: flag a distinctive shingle shared by >= this many episodes
  phraseMinContentWords: 2, // Signal 1: a shingle must carry >= this many non-stopword words to count
                            //   (filters common phrasing like "for as long as" that share one content word)
  openingWords: 120,     // Signal 2: how many words from the start count as "the opening"
  openingWarnAt: 0.55,   // Signal 2: cosine threshold for "openings too similar" (calibrate vs corpus)
};
