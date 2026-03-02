const lines = [
    "2 3 4 5 , 6",
    "08:30 REINALDO DA COSTA FERREIRA -",
    "COSTA FERREIRA:",
    "15 ANTONIO CHAGAS BARBOS.",
    "9 10 un 12 3",
    "[1 DEBORA SIMONE RODRIGU",
    "TO JULIANA MELO NERI OLIV",
    "14 MARIA OROZINA MOTA RAN",
    "fssosMARNAZENA MARQUES"
];

const items = [];
for (let line of lines) {
    if (!line || line.trim().length <= 3) continue;

    let cleanLine = line.trim();

    cleanLine = cleanLine.replace(/^\[1\s+/i, "11 ");
    cleanLine = cleanLine.replace(/^TO\s+/i, "10 ");
    cleanLine = cleanLine.replace(/^[lI\|]1\s+/i, "11 ");
    cleanLine = cleanLine.replace(/^O(\d)\s+/i, "0$1 ");

    const dateMatch = cleanLine.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/);

    const timeMatch = cleanLine.match(/\b(\d{1,2}:\d{2})\b/) ||
        cleanLine.match(/\b(\d{1,2}h(?:[0-5][0-9])?)\b/i) ||
        cleanLine.match(/^(\d{1,2})(?=\s+[A-ZÀ-Ÿ\[])/i);

    let hora = "";
    if (timeMatch) {
        hora = timeMatch[1].toLowerCase().replace("h", ":");
        if (hora.length <= 2 || hora.endsWith(":")) hora = hora.replace(":", "") + ":00";
        if (hora.length === 4 && hora.includes(":")) hora = "0" + hora;
    }

    if (dateMatch) cleanLine = cleanLine.replace(dateMatch[0], "");
    if (timeMatch) cleanLine = cleanLine.replace(timeMatch[0], "");
    cleanLine = cleanLine.replace(/^[-\|\s:]+|[-\|\s:]+$/g, "").trim();
    cleanLine = cleanLine.replace(/^(Seg|Ter|Qua|Qui|Sex|Sab|Sáb|Dom),?\s*/i, "");

    if (/bloqueio:/i.test(cleanLine)) continue;

    let cliente = cleanLine.replace(/[^A-Za-zÀ-ÿ\s\.]/g, "").trim();
    if (!cliente && cleanLine.length >= 5) {
        cliente = cleanLine;
    }

    const lettersOnly = cliente.replace(/[^a-zA-ZÀ-ÿ]/g, "");
    if (lettersOnly.length < 5) {
        continue;
    }

    items.push({ cliente, hora, original: line });
}

console.log(JSON.stringify(items, null, 2));
