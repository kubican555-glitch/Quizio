import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cesty k souborům
const csvFile = path.join(__dirname, "database.csv");
const outputSPS = path.join(__dirname, "src/questionsSPS.json");
const outputSTT = path.join(__dirname, "src/questionsSTT.json");

// Funkce pro parsování řádku CSV (oddělovač TABULÁTOR)
function parseLine(line) {
  // Rozdělí podle tabulátoru, odstraní uvozovky a mezery okolo
  // Pokud by to nefungovalo, zkus místo "\t" vrátit původní ";"
  return line.split("\t").map(val => val.trim().replace(/^"|"$/g, ''));
}

try {
  // 1. Kontrola existence souboru
  if (!fs.existsSync(csvFile)) {
    throw new Error(`Soubor 'database.csv' nebyl nalezen v kořenové složce.`);
  }

  // 2. Načtení dat
  const data = fs.readFileSync(csvFile, "utf-8");
  // Rozdělení na řádky a odstranění prázdných
  const lines = data.split("\n").filter(l => l.trim() !== "");

  const questionsSPS = [];
  const questionsSTT = [];
  let skippedCount = 0;

  console.log(`🔄 Zpracovávám ${lines.length} řádků...`);

  // 3. Procházení řádků
  lines.forEach((line, index) => {
    // Přeskočení prázdných řádků
    if (!line) return;

    const cols = parseLine(line);

    // Přeskočit záhlaví (pokud první sloupec zní jako "Předmět" nebo "Subject")
    if (index === 0 && (cols[0].match(/^(Subject|Předmět|Predmet)/i))) {
      return;
    }

    // Validace: Musí mít alespoň 8 sloupců (Obrázek je 9. a je nepovinný)
    if (cols.length < 8) {
      // Zkusíme detekovat, zda nejde o rozdělený řádek (někdy se to stává u copy-paste)
      // Pokud je to jen část dat, přeskočíme, ale vypíšeme varování jen pokud to vypadá jako data
      if (line.length > 10) { 
          console.warn(`⚠️ Řádek ${index + 1} přeskočen (málo sloupců - nalezeno ${cols.length}): ${line.substring(0, 50)}...`);
          skippedCount++;
      }
      return;
    }

    // 4. Mapování sloupců
    // [0] Předmět | [1] Číslo | [2] Otázka | [3] Správná | [4-7] Možnosti A-D | [8] Obrázek
    const subject = cols[0].toUpperCase().trim();
    const number = parseInt(cols[1], 10);
    const questionText = cols[2];
    const correctLetter = cols[3].toUpperCase().trim(); // A, B, C, D
    const options = [cols[4], cols[5], cols[6], cols[7]];

    // Převod písmene na index (0-3)
    const letterMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const correctIndex = letterMap[correctLetter];

    // Validace dat
    if (isNaN(number)) {
      // Ignorujeme řádky, kde není číslo (často smetí v CSV)
      return;
    }
    if (correctIndex === undefined) {
      console.warn(`⚠️ Otázka ${number}: Neplatná odpověď '${cols[3]}' (očekáváno A, B, C, D).`);
      skippedCount++;
      return;
    }

    // Vytvoření objektu otázky
    const questionObj = {
      number: number,
      question: questionText,
      options: options,
      correctIndex: correctIndex
    };

    // Rozřazení podle předmětu
    if (subject === 'SPS') {
      questionsSPS.push(questionObj);
    } else if (subject === 'STT') {
      questionsSTT.push(questionObj);
    } else {
      // Pokud předmět nesedí, ignorujeme (nebo můžeš přidat logiku)
    }
  });

  // 5. Uložení do JSON
  fs.writeFileSync(outputSPS, JSON.stringify(questionsSPS, null, 2), "utf-8");
  fs.writeFileSync(outputSTT, JSON.stringify(questionsSTT, null, 2), "utf-8");

  // 6. Výpis výsledků
  console.log("------------------------------------------------");
  console.log(`✅ ÚSPĚŠNĚ DOKONČENO`);
  console.log(`📘 SPS otázek: ${questionsSPS.length}`);
  console.log(`📙 STT otázek: ${questionsSTT.length}`);
  if (skippedCount > 0) console.log(`⚠️ Přeskočeno chybových řádků: ${skippedCount}`);
  console.log("------------------------------------------------");

} catch (error) {
  console.error("\n❌ CHYBA:", error.message);
}