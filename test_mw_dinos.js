// test_mw_dinos.js — LetterLoot Item 2/5 measurement (Sep 3 2026)
// Queries the SAME Collegiate endpoint + key the app uses, for the dinosaur batch, and
// classifies each response into the buckets that decide Item 2 (validator drops real
// entries) vs Item 3 (words genuinely absent -> seed the whitelist).
// Run:  node test_mw_dinos.js
const KEY = "6c41ef2c-8c1d-440a-b04a-24e623cf68e1";
const WORDS = ["brachiosaurus","tyrannosaurus","stegosaurus","brontosaurus","triceratops",
"velociraptor","allosaurus","apatosaurus","diplodocus","ankylosaurus","pterodactyl",
"parasaurolophus","iguanodon","spinosaurus","archaeopteryx","pachycephalosaurus"];

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const rows = [];
  for (const w of WORDS) {
    try {
      const r = await fetch(`https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(w)}?key=${KEY}`);
      const d = await r.json();
      let bucket, detail = "";
      if (!Array.isArray(d) || d.length === 0) bucket = "EMPTY (absent)";
      else if (typeof d[0] === "string") { bucket = "SUGGESTIONS (absent)"; detail = d.slice(0,3).join(", "); }
      else if (typeof d[0] === "object" && d[0].shortdef && d[0].shortdef.length) { bucket = "OBJECT+shortdef (app says VALID)"; detail = (d[0].shortdef[0]||"").slice(0,60); }
      else { bucket = ">>> OBJECT NO-shortdef (Item 2 SMOKING GUN - app says INVALID) <<<"; detail = JSON.stringify(Object.keys(d[0]||{})).slice(0,80); }
      rows.push([w, bucket, detail]);
    } catch (e) { rows.push([w, "FETCH ERROR", String(e).slice(0,60)]); }
    await sleep(300); // gentle on the API
  }
  console.log("");
  for (const [w,b,x] of rows) console.log(w.padEnd(20), b.padEnd(50), x);
  const gun = rows.filter(r => r[1].includes("SMOKING")).length;
  const absent = rows.filter(r => r[1].includes("absent")).length;
  const valid = rows.filter(r => r[1].includes("VALID")).length;
  console.log(`\nSummary: ${valid} valid via app logic | ${absent} genuinely absent (seed candidates) | ${gun} Item-2 smoking guns`);
})();
