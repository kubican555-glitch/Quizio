import React, { useState, useRef, useEffect } from "react";

export function SubjectSelector({ onSelectSubject, onUploadFile, menuSelection = 0, isKeyboardMode = false, setIsKeyboardMode = () => {} }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const subjectButtonsRef = useRef([]);

  useEffect(() => {
    if (subjectButtonsRef.current && subjectButtonsRef.current[menuSelection]) {
      setTimeout(() => {
        subjectButtonsRef.current[menuSelection]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    }
  }, [menuSelection]);

  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) throw new Error("CSV soubor musí mít záhlaví a alespoň jednu otázku");

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const numberIdx = headers.indexOf('number');
    const questionIdx = headers.indexOf('question');
    const correctIdx = headers.indexOf('correctindex');

    if (numberIdx === -1 || questionIdx === -1 || correctIdx === -1) {
      throw new Error("CSV musí mít sloupce: number, question, correctIndex a options (option0, option1, ...)");
    }

    const questions = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length < 4) continue;

      const optionHeaders = headers.filter(h => h.startsWith('option'));
      const options = optionHeaders.map(h => parts[headers.indexOf(h)] || '').filter(o => o);

      if (options.length < 2) {
        throw new Error(`Otázka ${i} musí mít alespoň 2 možnosti odpovědi.`);
      }

      questions.push({
        number: parts[numberIdx],
        question: parts[questionIdx],
        options: options,
        correctIndex: parseInt(parts[correctIdx]) || 0
      });
    }

    if (questions.length === 0) throw new Error("Žádné otázky nenalezeny");
    return questions;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isJSON = file.name.endsWith(".json");
    const isCSV = file.name.endsWith(".csv");

    if (!isJSON && !isCSV) {
      setUploadError("Prosím nahraj JSON nebo CSV soubor.");
      return;
    }

    setUploading(true);
    setUploadError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let questions = [];
        if (isJSON) {
          const json = JSON.parse(event.target.result);
          if (!Array.isArray(json)) throw new Error("JSON musí být pole otázek.");
          questions = json;
        } else if (isCSV) {
          questions = parseCSV(event.target.result);
        }
        onUploadFile(questions);
        setUploading(false);
      } catch (err) {
        setUploadError("Chyba při čtení souboru: " + err.message);
        setUploading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="subjectSelectorContainer fadeIn">
      <div className="subjectContent">
        
        <div className="subjectGrid">
          <button
            ref={(el) => subjectButtonsRef.current[0] = el}
            className={`subjectButton ${menuSelection === 0 && isKeyboardMode ? "selected" : ""}`}
            onClick={() => { setIsKeyboardMode(false); onSelectSubject("sps"); }}
          >
            <div className="subjectIcon">📚</div>
            <div className="subjectName">SPS</div>
            <div className="subjectDesc">Stavba a provoz strojů</div>
          </button>

          <button
            ref={(el) => subjectButtonsRef.current[1] = el}
            className={`subjectButton ${menuSelection === 1 && isKeyboardMode ? "selected" : ""}`}
            onClick={() => { setIsKeyboardMode(false); onSelectSubject("stt"); }}
          >
            <div className="subjectIcon">⚙️</div>
            <div className="subjectName">STT</div>
            <div className="subjectDesc">Strojírenská technologie</div>
          </button>

          <button
            ref={(el) => subjectButtonsRef.current[2] = el}
            className={`subjectButton uploadButton ${menuSelection === 2 && isKeyboardMode ? "selected" : ""}`}
            onClick={() => { setIsKeyboardMode(false); onSelectSubject("CUSTOM"); }}
          >
            <div className="subjectIcon">📤</div>
            <div className="subjectName">Vlastní soubor</div>
            <div className="subjectDesc">JSON nebo CSV</div>
          </button>
        </div>

        {uploadError && <div className="uploadError">{uploadError}</div>}
      </div>
    </div>
  );
}