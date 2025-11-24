import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFile = path.join(__dirname, "questions.csv");
const outputFile = path.join(__dirname, "src/questions.js"); // výstup přímo do src/

function parseCSV(text) {
  return text
    .trim()
    .split("\n")
    .map((line) => line.split(";")); // změna na středník
}

const csvText = fs.readFileSync(csvFile, "utf-8");
const rows = parseCSV(csvText);

const questions = rows.map((row) => {
  const number = row[0].trim();
  const question = row[1].trim();
  const correctLetter = row[2].trim().toUpperCase();
  const options = [row[3].trim(), row[4].trim(), row[5].trim(), row[6].trim()];
  const correctIndex = { A: 0, B: 1, C: 2, D: 3 }[correctLetter];
  return { number, question, options, correctIndex };
});

const output = `export const QUESTIONS = ${JSON.stringify(questions, null, 2)};\n`;

fs.writeFileSync(outputFile, output, "utf-8");
console.log(`✅ src/questions.js vygenerován s ${questions.length} otázkami.`);
