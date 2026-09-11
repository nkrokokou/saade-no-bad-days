const XLSX = require("xlsx");
console.log("xlsx version:", XLSX.version);

// Simulation exacte du pipeline de la fonction Edge
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
  ["Indicateur", "Valeur"],
  ["Chiffre d'affaires", 142450],
  ["Résumé", "é è ê à ç"],
]), "Résumé");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["A", "B"], [1, 2]]), "Lignes de vente");

const wbOut = XLSX.write(wb, { type: "array", bookType: "xlsx" });
console.log("Type retour:", Object.prototype.toString.call(wbOut),
  "| Uint8Array?", wbOut instanceof Uint8Array,
  "| ArrayBuffer?", wbOut instanceof ArrayBuffer,
  "| string?", typeof wbOut);

let bytes;
if (wbOut instanceof Uint8Array) bytes = wbOut;
else if (wbOut instanceof ArrayBuffer) bytes = new Uint8Array(wbOut);
else if (typeof wbOut === "string") {
  bytes = new Uint8Array(wbOut.length);
  for (let i = 0; i < wbOut.length; i++) bytes[i] = wbOut.charCodeAt(i) & 0xff;
} else bytes = new Uint8Array(wbOut);

const sig = String.fromCharCode(bytes[0], bytes[1]);
console.log("Signature:", sig, "| Taille:", bytes.length,
  "| Valide:", sig === "PK" && bytes.length >= 100);

const wb2 = XLSX.read(bytes, { type: "array" });
console.log("Round-trip OK, feuilles:", wb2.SheetNames.join(", "));

// Test bytesToBase64 identique à la fonction (chunk 0x1000, apply)
function bytesToBase64(bytes) {
  let bin = "";
  const chunk = 0x1000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    bin += String.fromCharCode.apply(null, sub);
  }
  return Buffer ? Buffer.from(bin, "binary").toString("base64") : btoa(bin);
}
const b64 = bytesToBase64(bytes);
const dec = Buffer.from(b64, "base64");
console.log("Base64 round-trip:", dec.equals(bytes) ? "OK" : "ÉCHEC",
  "| b64 length:", b64.length);
