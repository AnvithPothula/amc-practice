# Trivial

This website provides tools for more efficiently getting and working with problems on the [Art of Problem Solving Wiki](https://artofproblemsolving.com/wiki/), either as a single problem or a practice batch, with solutions shown in a separate section. Numerous filtering & display options are supported, and custom problem batches or individual problems & tests can also be displayed. Attractive article display is also supported, with full search & history functionality. All of this can be viewed in the browser with a convenient layout or printed out.

## Maintenance

The only parts of this project that will need regular manual updating are the [allpages.json](public/data/allpages.json) and [allproblems.json](public/data/allproblems.json) page lists for the wiki. To download updated copies that can then be committed, run [downloadlists.js](downloadlists.js) with Node.

## AoPS access

AoPS now puts the wiki behind a Cloudflare check, so the browser can't call its API directly.

- **Development** (`npm run dev`): AoPS requests go through [aops-chrome.js](aops-chrome.js), which opens a separate Chrome window and runs each request inside an AoPS tab (set `CHROME_PATH` if Chrome isn't at the macOS default location). If AoPS asks you to "Verify you are human", click it there once.
- **Production** builds read a static snapshot of every wiki page and image in `public/data/wiki/` and `public/data/images/`. Refresh it with `npm run snapshot` (resumable; AoPS rate-limits it to about 15 pages a minute). AMC/AIME/olympiad and tournament problems come from the bundled archives instead (see `buildaops.js`, `buildtournaments.js`).

## License

This project is copyrighted by Andi Chang and licensed under the terms of the [Mozilla Public License v2.0](https://www.mozilla.org/en-US/MPL/2.0/).
