// Körs efter bliss-data.js och före src/glosor.js (ett eget skript, så att sidan klarar sig utan inline-skript).
// bliss-data.js deklarerar `const BLISS_DATA` i skript-scopet — src/glosor.js läser den från window.
window.BLISS_DATA = BLISS_DATA;
// Bildmakaren lånar bara kortleken: glosprogrammets sparade framsteg läses inte och skrivs aldrig.
window.GLOSOR_UTAN_SPARNING = true;
