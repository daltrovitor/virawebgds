const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function extractName(line) {
    // simplified for test
    return line.replace(/^\d+/, "").replace(/[-:]+$/, "").trim();
}

function extractAppointments(lines) {
    const items = [];
    let currentDay = "";
    let currentMonth = 2; // Fevereiro
    let currentYear = 2025;

    for (const line of lines) {
        if (!line || line.trim().length <= 1) continue;
        const trimmed = line.trim();

        const monthMatch = monthNames.find(m => trimmed.toLowerCase().includes(m));
        if (monthMatch) currentMonth = monthNames.indexOf(monthMatch) + 1;

        const dayHeaderMatch = trimmed.match(/^(Seg|Ter|Qua|Qui|Sex|Sab|Sáb|Dom),?\s*(\d{1,2})$/i) ||
            trimmed.match(/^(\d{1,2})$/);

        if (dayHeaderMatch) {
            const dayNum = parseInt(dayHeaderMatch[dayHeaderMatch.length - 1]);
            if (dayNum >= 1 && dayNum <= 31) {
                currentDay = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                // console.log("New Day detected:", currentDay);
                continue;
            }
        }

        // Split multiple markers
        const appointmentBlocks = trimmed.split(/(?=\b\d{1,2}[:h]\d{2}\b|\b\d{1,2}h\b|^\d{1,2}\s+[A-ZÀ-Ÿ])/g)
            .map(s => s.trim()).filter(s => s.length > 5);

        for (const block of appointmentBlocks) {
            let cleanLine = block;
            const timeMatch = cleanLine.match(/\b(\d{1,2}[:h]\d{2})\b/i) ||
                cleanLine.match(/\b(\d{1,2}h)\b/i) ||
                cleanLine.match(/^(\d{1,2})(?=\s+[A-ZÀ-Ÿ\[])/i);

            let hora = "";
            if (timeMatch) {
                hora = timeMatch[1].toLowerCase().replace("h", ":");
                if (hora.length <= 2 || hora.endsWith(":")) hora = hora.replace(":", "") + ":00";
                if (hora.length === 4 && hora.includes(":")) hora = "0" + hora;
            }

            if (timeMatch) cleanLine = cleanLine.replace(timeMatch[0], "");
            cleanLine = cleanLine.replace(/^[-\|\s:]+|[-\|\s:]+$/g, "").trim();

            let cliente = extractName(cleanLine);

            items.push({
                cliente,
                data: currentDay,
                hora,
                source: block
            });
        }
    }
    return items;
}

const testData = [
    "Fevereiro 2025",
    "Seg 2",
    "09 MARIA APARECIDA SCARTEZINI -",
    "10 UBIRAJARA ANTÔNIO DOS SANTOS -",
    "Ter 3",
    "08 LEANDRO JOSE DE OLIVEIRA -",
    "Qua 4",
    "08:30 REINALDO DA COSTA FERREIRA -",
    "14 MARIA ANGELICA BRETAS NETTO BARBOZA -",
    "Qui 5",
    "09:30 REINALDO DA COSTA FERREIRA -",
    "15 RANIERY SANTANA DE OLIVEIRA COSTA -",
    "Sex 6",
    "10:30 MARILIA CRISTINA GOULART MESQUITA -"
];

const results = extractAppointments(testData);
console.log(JSON.stringify(results, null, 2));
