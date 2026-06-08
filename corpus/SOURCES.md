# corpus/ -- public-domain reference texts

A small, curated set of complete public-domain works, kept as **style and craft reference only**.
See `docs/inspiration.md` for the full source bible and `docs/style-cards.md` for the distilled
technique notes these texts illustrate.

## How to use this folder

- **Read for cadence, structure, and atmosphere -- never copy.** These are here so an author (human
  or the `author-episode` skill) can study how dread is built, not to lift phrasing. The brief and
  the law both forbid verbatim reuse of any protected expression; for these PD works the law allows
  copying, but the project's no-pastiche rule does not. Echo the method, write your own words.
- **Do not feed whole files into a generator as "write something like this."** That invites
  verbatim echo and 1900s pastiche, which reads as its own tell. Prefer the distilled style cards.
- These files keep the original authors' punctuation (em-dashes, curly quotes). Episodes must NOT
  copy that -- episode prose follows the ASCII house style the linter enforces.
- This folder is reference material. It is not read by the engine or the build (`tools/build.mjs`
  only reads `episodes/` and `engine/`), and nothing here ships in `dist/`.

## What's here, and why it's license-free

US public domain is by publication date; everything below was published well before the 1930
cutoff. Texts were taken from Project Gutenberg editions with the PG license header/footer removed
(so no Project Gutenberg trademark is used here); the underlying works are public domain.

| File | Work | Author | First pub. | Why it's here |
|---|---|---|---|---|
| `the-willows__blackwood-1907.txt` | The Willows | Algernon Blackwood | 1907 | The model for attention-based horror: the menace is never described, only inferred; survival is keeping still and not thinking. |
| `the-yellow-wallpaper__gilman-1892.txt` | The Yellow Wallpaper | Charlotte Perkins Gilman | 1892 | Sanity erosion in an enclosing room that seems to watch -- the template for degrading, sanity-keyed narration. |
| `rime-of-the-ancient-mariner__coleridge-1834.txt` | The Rime of the Ancient Mariner | Samuel Taylor Coleridge | 1798 (text from the 1834 final version) | The doomed-vessel arc: becalmed ship, crew dead one by one, a lone guilt-ridden survivor. |

## Referenced but deliberately NOT bundled

Verified public domain, but left out to keep this folder small (and, for the multi-story volumes,
to avoid shipping a whole anthology). Get them from a clean PD source when needed:

- **Guy de Maupassant, "The Horla" (1887)** -- use a PD English translation: Jonathan Sturges
  (1890) or the McMaster/Henderson/Quesada translation (in Gutenberg "Original Short Stories,
  Vol. 04", ebook 3080). NOT a modern translation.
- **Edgar Allan Poe, "MS. Found in a Bottle" / "A Descent into the Maelstrom"** -- in Poe
  collected editions; PD (Poe d. 1849).
- **William Hope Hodgson** -- sea/cosmic novels 1907-1912; PD by publication date. Long-form, so
  reference rather than bundle.
- **M.R. James** -- the four collections (1904, 1911, 1919, 1925) are PD; EXCLUDE the three
  post-1930 stories ("The Experiment" 1931, "The Malice of Inanimate Objects" 1933, "A Vignette"
  1936).

For visual mood (PD by age / publication): Gustave Dore's *Rime* engravings, Piranesi's *Carceri*,
Caspar David Friedrich, Ernst Haeckel's *Kunstformen der Natur*, Goya's Black Paintings, Odilon
Redon's *noirs*, Frank Hurley's *Endurance* photographs (1914-17), and NASA imagery/audio (avoid
the NASA insignia and any third-party-marked asset).
