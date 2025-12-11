import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFile = path.join(__dirname, "database.csv");
const outputSPS = path.join(__dirname, "src/questionsSPS.json");
const outputSTT = path.join(__dirname, "src/questionsSTT.json");

try {
    if (!fs.existsSync(csvFile)) {
        throw new Error(`Soubor 'database.csv' nebyl nalezen.`);
    }

    let data = fs.readFileSync(csvFile, "utf-8");

    // Odstranění BOM (neviditelné znaky na začátku)
    if (data.charCodeAt(0) === 0xFEFF) {
        data = data.slice(1);
    }

    // Rozdělení na řádky
    const lines = data.split("\n").filter(l => l.trim() !== "");

    const questionsSPS = [];
    const questionsSTT = [];

    console.log(`🔄 Zpracovávám ${lines.length} řádků...`);

    lines.forEach((line, index) => {
        // Jednoduché rozdělení podle tabulátoru a ořezání mezer
        const cols = line.split("\t").map(c => c.trim());

        // Kontrola, zda má řádek dostatek sloupců (SPS/STT, číslo, otázka, písmeno, 4 možnosti)
        // Očekáváme min 8 sloupců: [Předmět, Číslo, Otázka, Písmeno, Odp1, Odp2, Odp3, Odp4]
        if (cols.length < 8) return;

        const subject = cols[0];
        const number = cols[1];
        const questionText = cols[2];
        const correctLetter = cols[3]; // A, B, C, D

        // Možnosti jsou v dalších sloupcích
        const options = cols.slice(4, 8); 

        // Pouze pokud je to SPS nebo STT
        if (subject === "SPS" || subject === "STT") {

            // Převod písmene na index (A=0, B=1...)
            const letterMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
            const correctIndex = letterMap[correctLetter] !== undefined ? letterMap[correctLetter] : 0;

            const questionObj = {
                number: number,
                question: questionText,
                options: options,
                correctIndex: correctIndex
            };

            if (subject === "SPS") {
                questionsSPS.push(questionObj);
            } else {
                questionsSTT.push(questionObj);
            }
        }
    });

    // Uložení do souborů
    fs.writeFileSync(outputSPS, JSON.stringify(questionsSPS, null, 2), "utf-8");
    fs.writeFileSync(outputSTT, JSON.stringify(questionsSTT, null, 2), "utf-8");

    console.log("------------------------------------------------");
    console.log(`✅ HOTOVO!`);
    console.log(`📘 SPS: ${questionsSPS.length} otázek`);
    console.log(`📙 STT: ${questionsSTT.length} otázek`);
    console.log("------------------------------------------------");

} catch (error) {
    console.error("CHYBA SKRIPTU:", error.message);
}