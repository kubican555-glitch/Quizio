import React, { useState } from "react";

export function SubjectSelector({ onSelectSubject, onUploadFile }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setUploadError("Prosím nahraj JSON soubor.");
      return;
    }

    setUploading(true);
    setUploadError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!Array.isArray(json)) {
          throw new Error("JSON musí být pole otázek.");
        }
        onUploadFile(json);
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
        <h1 className="subjectTitle">SPS – Uzavřené otázky</h1>
        <p className="subjectSubtitle">Vyber předmět, který chceš procvičovat</p>

        <div className="subjectGrid">
          <button
            className="subjectButton"
            onClick={() => onSelectSubject("sps")}
          >
            <div className="subjectIcon">📚</div>
            <div className="subjectName">SPS</div>
            <div className="subjectDesc">Základní sada otázek</div>
          </button>

          <button
            className="subjectButton"
            onClick={() => onSelectSubject("stt")}
          >
            <div className="subjectIcon">⚙️</div>
            <div className="subjectName">STT</div>
            <div className="subjectDesc">Technické otázky</div>
          </button>

          <label className="subjectButton uploadButton">
            <div className="subjectIcon">📤</div>
            <div className="subjectName">Vlastní soubor</div>
            <div className="subjectDesc">Nahraj svůj JSON</div>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {uploadError && (
          <div className="uploadError">{uploadError}</div>
        )}

        <div className="uploadHint">
          💡 Tip: Vlastní soubor musí být JSON pole s otázkami
          <br />
          Format: [{"{ number, question, options: [], correctIndex }"}, ...]
        </div>
      </div>
    </div>
  );
}
