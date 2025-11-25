// App.jsx
import React, { useState, useEffect, useRef } from "react";
import { QUESTIONS } from "./questions";

// Načtení obrázků (vite)
const images = import.meta.glob("./images/*.png", { eager: true, as: "url" });
const IMAGES = {};
for (const path in images) {
  const fileName = path.match(/\/(\d+)\.png$/)?.[1];
  if (fileName) IMAGES[fileName] = images[path];
}

/* ---------- Small components ---------- */

function ConfirmModal({ title, message, onCancel, onConfirm, confirmText = "Ano, pokračovat", cancelText = "Zrušit" }) {
  return (
    <div className="modalOverlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modalButtons">
          <button className="navButton" onClick={onCancel}>{cancelText}</button>
          <button className="navButton primary" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ mode, score, trainingTime, questionSet, maxSeenIndex, onBack }) {
  const list = mode === "training" ? questionSet.slice(0, maxSeenIndex + 1) : questionSet;
  return (
    <div className="resultScreen fadeIn">
      <h2>{mode === "mock" ? "Test dokončen!" : "Vyhodnocení tréninku"}</h2>
      <p className="bigScore">{score.correct} / {score.total}</p>
      <p className="bigPercent">{score.total === 0 ? 0 : Math.round((score.correct / score.total) * 100)} % správně</p>
      {mode === "training" && <p className="timeSpent">Čas: {formatTime(trainingTime)}</p>}

      <div className="reviewList">
        {list.map((q, i) => (
          <div key={i} className={`reviewQuestion ${q.userAnswer === q.correctIndex ? "correct" : q.userAnswer !== undefined ? "wrong" : "unanswered"}`}>
            <strong>{i + 1}. {q.question}</strong>
            {IMAGES[q.number] && <img src={IMAGES[q.number]} alt="" className="questionImage small" onClick={() => window.open(IMAGES[q.number], "_blank")} />}
            <div><strong>Správná odpověď:</strong> {q.options[q.correctIndex]}</div>
            {q.userAnswer !== undefined && (
              <div><strong>Tvá odpověď:</strong> {q.options[q.userAnswer]} {q.userAnswer === q.correctIndex ? "(správně)" : "(špatně)"}</div>
            )}
          </div>
        ))}
      </div>

      <button className="navButton primary" style={{ marginTop: "2rem" }} onClick={onBack}>Zpět do menu</button>
    </div>
  );
}

function Navigator({ questionSet, currentIndex, setCurrentIndex, mode, maxSeenIndex }) {
  return (
    <div className="navigatorWrapper">
      <div className="compactNavigator">
        {questionSet.map((_, i) => {
          if (mode === "training" && i > maxSeenIndex) return null;
          const isAnswered = questionSet[i]?.userAnswer !== undefined;
          return (
            <button
              key={i}
              className={`navNumber ${currentIndex === i ? "current" : ""} ${isAnswered ? "answered" : ""}`}
              onClick={() => setCurrentIndex(i)}
              aria-label={`Otázka ${i + 1}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionCard({ currentQuestion, mode, showResult, selectedAnswer, onSelect, optionRefsForCurrent, disabled }) {
  return (
    <div>
      <div className="questionHeader slideIn">
        <h2 className="questionText">
          {mode === "random" && `#${currentQuestion.number} `}
          {currentQuestion.question}
        </h2>
        {IMAGES[currentQuestion.number] && (
          <div className="imageWrapper">
            <img src={IMAGES[currentQuestion.number]} alt="Otázka" className="questionImage" onClick={() => window.open(IMAGES[currentQuestion.number], "_blank")} />
            <div className="fullscreenHint">Klikni pro zvětšení</div>
          </div>
        )}
      </div>

      <div className="options">
        {currentQuestion.options.map((opt, i) => {
          let style = {};
          if (mode === "random" && showResult) {
            if (i === currentQuestion.correctIndex) style = { background: "rgba(34,197,94,0.35)", borderColor: "#22c55e", color: "#ecfdf5" };
            if (selectedAnswer === i && i !== currentQuestion.correctIndex) style = { background: "rgba(239,68,68,0.35)", borderColor: "#ef4444", color: "#fee2e2" };
          } else if (mode === "random" && !showResult && selectedAnswer === i) {
            style = { background: "rgba(59,130,246,0.35)", borderColor: "#60a5fa" };
          } else if ((mode === "mock" || mode === "training") && currentQuestion.userAnswer === i) {
            style = { background: "rgba(59,130,246,0.35)", borderColor: "#60a5fa" };
          }

          return (
            <button
              key={i}
              ref={(el) => {
                if (!optionRefsForCurrent.current) optionRefsForCurrent.current = {};
                if (!optionRefsForCurrent.current[currentQuestion._localIndex]) optionRefsForCurrent.current[currentQuestion._localIndex] = [];
                optionRefsForCurrent.current[currentQuestion._localIndex][i] = el;
              }}
              className="optionButton"
              style={style}
              onClick={() => {
                if (!disabled) onSelect(i);
              }}
              disabled={disabled}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Utilities ---------- */

function formatTime(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/* ---------- Main App (refactored) ---------- */

export default function App() {
  const [mode, setMode] = useState(null); // null | random | mock | training | review
  const [questionSet, setQuestionSet] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [timeLeft, setTimeLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [maxSeenIndex, setMaxSeenIndex] = useState(0);
  const [trainingTime, setTrainingTime] = useState(0);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  // refs: per-question refs so keyboard selection always maps to the current question
  const optionRefsForCurrent = useRef({});
  const scrollRef = useRef(null);
  const cardRef = useRef(null);

  // attach stable _localIndex to QUESTIONS once (non-invasive)
  useEffect(() => {
    QUESTIONS.forEach((q, i) => { q._localIndex = i; });
  }, []);

  // mobile vh fix
  useEffect(() => {
    const setVH = () => document.documentElement.style.setProperty("--vh", `${window.innerHeight}px`);
    setVH();
    window.addEventListener("resize", setVH);
    return () => window.removeEventListener("resize", setVH);
  }, []);

  // auto scroll navigator to current
  useEffect(() => {
    if (!scrollRef.current) return;
    const activeBtn = scrollRef.current.querySelector(".navNumber.current");
    if (activeBtn) activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentIndex]);

  // auto scroll card into view for flashcards
  useEffect(() => {
    if (mode !== "random" || !cardRef.current) return;
    setTimeout(() => {
      if (cardRef.current) {
        cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  }, [currentIndex, showResult, mode]);

  // auto focus selected answer for keyboard nav
  useEffect(() => {
    if (mode !== "random" || selectedAnswer === null) return;
    const refs = optionRefsForCurrent.current?.[currentQuestion._localIndex] || [];
    if (refs[selectedAnswer]) {
      setTimeout(() => {
        if (refs[selectedAnswer]) {
          refs[selectedAnswer].scrollIntoView({ behavior: "smooth", block: "nearest" });
          refs[selectedAnswer].focus();
        }
      }, 100);
    }
  }, [selectedAnswer, currentIndex, mode]);

  // training timer
  useEffect(() => {
    if (mode !== "training" || finished) return;
    const t = setInterval(() => setTrainingTime((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [mode, finished]);

  // mock timer
  useEffect(() => {
    if (mode !== "mock" || finished) return;
    const t = setInterval(() => {
      setTimeLeft((x) => {
        if (x <= 1) return 0;
        return x - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [mode, finished]);

  // auto-submit when time runs out
  useEffect(() => {
    if (mode === "mock" && timeLeft === 0 && !finished) {
      submitTest();
    }
  }, [mode, timeLeft, finished]);

  // Keyboard handling (centralized)
  useEffect(() => {
    if (!mode || mode === "review") return;

    const onKey = (e) => {
      const curQ = questionSet[currentIndex] || { options: [] };
      const opts = curQ.options.length;

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();

      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        if (mode === "random" && !showResult) {
          const newIdx = selectedAnswer === null ? opts - 1 : (selectedAnswer - 1 + opts) % opts;
          selectRandomAnswer(newIdx);
        } else if (mode !== "random") {
          const newIdx = curQ.userAnswer === undefined ? opts - 1 : (curQ.userAnswer - 1 + opts) % opts;
          handleAnswer(newIdx);
        }
      }
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        if (mode === "random" && !showResult) {
          const newIdx = selectedAnswer === null ? 0 : (selectedAnswer + 1) % opts;
          selectRandomAnswer(newIdx);
        } else if (mode !== "random") {
          const newIdx = curQ.userAnswer === undefined ? 0 : (curQ.userAnswer + 1) % opts;
          handleAnswer(newIdx);
        }
      }

      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        if (mode === "random" && showResult) nextRandomQuestion();
        else setCurrentIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        if (mode === "random" && showResult) nextRandomQuestion();
        else if (mode === "random" && !showResult) confirmRandomAnswer();
        else {
          const max = mode === "training" ? maxSeenIndex : questionSet.length - 1;
          setCurrentIndex((i) => Math.min(i + 1, max));
        }
      }

      if (e.key === " ") {
        if (mode === "random" && showResult) nextRandomQuestion();
        else if (mode === "random" && !showResult) confirmRandomAnswer();
        else if (!finished && (mode === "mock" || mode === "training")) setShowConfirmSubmit(true);
      }

      if (e.key === "Enter") {
        if (showConfirmSubmit) submitTest();
        else if (showConfirmExit) confirmExit();
        else if (mode === "random" && showResult) nextRandomQuestion();
        else if (mode === "random" && !showResult) confirmRandomAnswer();
      }

      if (e.key === "Backspace") {
        if (curQ.userAnswer !== undefined) clearAnswer();
        else tryReturnToMenu();
      }

      if (e.key === "Escape") {
        if (fullscreenImage) setFullscreenImage(null);
        else if (showConfirmSubmit) setShowConfirmSubmit(false);
        else if (showConfirmExit) setShowConfirmExit(false);
        else if (mode === "random" && showResult) clearAnswer();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, questionSet, currentIndex, showResult, showConfirmSubmit, showConfirmExit, fullscreenImage, maxSeenIndex, finished, selectedAnswer]);

  /* ---------- Mode starters ---------- */

  const startRandomMode = () => {
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, options: [...q.options], userAnswer: undefined, _localIndex: idx }));
    setQuestionSet(shuffled);
    setMode("random");
    setCurrentIndex(0);
    setScore({ correct: 0, total: 0 });
    setFinished(false);
    setSelectedAnswer(null);
    setShowResult(false);
    optionRefsForCurrent.current = {};
  };

  const startMockTest = () => {
    const sel = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 40).map((q, idx) => ({ ...q, options: [...q.options], userAnswer: undefined, _localIndex: idx }));
    setQuestionSet(sel);
    setTimeLeft(1800);
    setMode("mock");
    setCurrentIndex(0);
    setMaxSeenIndex(0);
    setFinished(false);
    optionRefsForCurrent.current = {};
  };

  const startTrainingMode = () => {
    const all = QUESTIONS.map((q, idx) => ({ ...q, options: [...q.options], userAnswer: undefined, _localIndex: idx }));
    setQuestionSet(all);
    setMode("training");
    setCurrentIndex(0);
    setMaxSeenIndex(0);
    setTrainingTime(0);
    setFinished(false);
    optionRefsForCurrent.current = {};
  };

  const startReviewMode = () => setMode("review");

  /* ---------- Answer logic ---------- */

  const selectRandomAnswer = (idx) => {
    if (finished || mode !== "random" || showResult) return;
    setSelectedAnswer(idx);
  };

  const clickRandomAnswer = (idx) => {
    if (finished || mode !== "random" || showResult) return;
    
    const currentQ = questionSet[currentIndex];
    if (!currentQ) return;

    setQuestionSet((prev) => {
      const copy = [...prev];
      const q = { ...copy[currentIndex] };
      q.userAnswer = idx;
      copy[currentIndex] = q;
      return copy;
    });

    setSelectedAnswer(idx);
    setShowResult(true);
    setScore((s) => {
      let correct = s.correct;
      let total = s.total;
      if (idx === currentQ.correctIndex) correct += 1;
      total += 1;
      return { correct, total };
    });
  };

  const confirmRandomAnswer = () => {
    if (finished || mode !== "random") return;

    const currentQ = questionSet[currentIndex];
    if (!currentQ) return;

    const answerToSave = selectedAnswer !== null ? selectedAnswer : -1;

    setQuestionSet((prev) => {
      const copy = [...prev];
      const q = { ...copy[currentIndex] };
      q.userAnswer = answerToSave;
      copy[currentIndex] = q;
      return copy;
    });

    setShowResult(true);
    if (selectedAnswer !== null) {
      setScore((s) => {
        let correct = s.correct;
        let total = s.total;
        if (selectedAnswer === currentQ.correctIndex) correct += 1;
        total += 1;
        return { correct, total };
      });
    } else {
      setSelectedAnswer(-1);
    }
  };

  const handleAnswer = (idx) => {
    if (finished || mode === "review") return;

    setQuestionSet((prev) => {
      const copy = [...prev];
      const q = { ...copy[currentIndex] };
      q.userAnswer = idx;
      copy[currentIndex] = q;

      if (mode === "training") {
        if (currentIndex === maxSeenIndex) setMaxSeenIndex((m) => Math.min(m + 1, copy.length - 1));
      }

      return copy;
    });
  };

  const clearAnswer = () => {
    setQuestionSet((prev) => {
      const copy = [...prev];
      if (!copy[currentIndex]) return prev;
      copy[currentIndex] = { ...copy[currentIndex], userAnswer: undefined };
      return copy;
    });
    setSelectedAnswer(null);
    setShowResult(false);
    // we intentionally do not auto-decrement score to avoid complexity; user can retake.
  };

  const nextRandomQuestion = () => {
    if (!questionSet.length) return;
    let nextIdx;
    let attempts = 0;
    do {
      nextIdx = Math.floor(Math.random() * questionSet.length);
      attempts++;
    } while (nextIdx === currentIndex && questionSet.length > 1 && attempts < 10);

    setCurrentIndex(nextIdx);
    setSelectedAnswer(null);
    setShowResult(false);
    // focus first option of the new question so keyboard works immediately
    setTimeout(() => {
      const refs = optionRefsForCurrent.current?.[questionSet[nextIdx]._localIndex] || [];
      if (refs[0]) refs[0].focus();
    }, 50);
  };

  /* ---------- Submit / exit ---------- */

  const confirmSubmit = () => setShowConfirmSubmit(true);
  const cancelSubmit = () => setShowConfirmSubmit(false);

  const submitTest = () => {
    const questionsToEval = mode === "training" ? questionSet.slice(0, maxSeenIndex + 1) : questionSet;
    const correct = questionsToEval.filter((q) => q.userAnswer === q.correctIndex).length;
    setScore({ correct, total: questionsToEval.length });
    setFinished(true);
    setShowConfirmSubmit(false);
  };

  const tryReturnToMenu = () => {
    if ((mode === "mock" || mode === "training") && !finished) setShowConfirmExit(true);
    else resetToMenu();
  };

  const confirmExit = () => { resetToMenu(); setShowConfirmExit(false); };

  const resetToMenu = () => {
    setMode(null);
    setQuestionSet([]);
    setCurrentIndex(0);
    setFinished(false);
    setFullscreenImage(null);
    optionRefsForCurrent.current = {};
    setScore({ correct: 0, total: 0 });
    setShowResult(false);
    setSelectedAnswer(null);
    setMaxSeenIndex(0);
  };

  /* ---------- Render ---------- */

  if (!mode) {
    return (
      <div className="container fadeIn" style={{ minHeight: "var(--vh)" }}>
        <h1 className="title">SPS – Uzavřené otázky</h1>
        <div className="menuColumn">
          <button className="menuButton" onClick={startRandomMode}>Flashcards</button>
          <button className="menuButton" onClick={startMockTest}>Test nanečisto (40 otázek, 30 min)</button>
          <button className="menuButton" onClick={startTrainingMode}>Tréninkový režim</button>
          <button className="menuButton" onClick={startReviewMode}>Prohlížení otázek</button>
        </div>
        <div style={{ marginTop: "2rem", fontSize: "0.9rem", color: "#888", textAlign: "center", lineHeight: "1.6" }}>
          Klávesy: W/S ↑↓ – výběr • A/D ←→ – otázky<br />
          Mezerník – další/odevzdání • Backspace – odznačit / menu • Enter – potvrzení • Esc – zrušit
        </div>
      </div>
    );
  }

  if (mode === "review") {
    return (
      <div className="container fadeIn" style={{ minHeight: "var(--vh)" }}>
        <h1 className="title">Prohlížení všech otázek</h1>
        <button className="menuBackButton" onClick={tryReturnToMenu}>Zpět</button>
        <div className="reviewGrid">
          {QUESTIONS.map((q) => (
            <div key={q.number} className="reviewCard">
              <div className="reviewHeader"><strong>#{q.number}.</strong> {q.question}</div>
              {IMAGES[q.number] && <img src={IMAGES[q.number]} alt="" className="reviewImage" onClick={() => window.open(IMAGES[q.number], "_blank")} />}
              <div className="reviewAnswer"><strong>Správná:</strong> <span className="correctText">{q.options[q.correctIndex]}</span></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentQuestion = questionSet[currentIndex] || { question: "", options: [], correctIndex: 0, number: 0, _localIndex: currentIndex };

  return (
    <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
      <div className="topBarRight">
        <button className="menuBackButton" onClick={tryReturnToMenu}>Zpět</button>
        <div className="topControls">
          {mode === "mock" && <div className={`timer ${timeLeft <= 300 ? "timerWarning" : ""} ${timeLeft <= 60 ? "timerDanger" : ""}`}>{formatTime(timeLeft)}</div>}
          {mode === "training" && !finished && <div className="timer" style={{ color: "#a3a3a3" }}>{formatTime(trainingTime)}</div>}
          {(mode === "mock" || mode === "training") && !finished && <button className="submitTopButton" onClick={confirmSubmit}>{mode === "training" ? "Vyhodnotit" : "Odevzdat"}</button>}
        </div>
      </div>

      <h1 className="title">{mode === "random" ? "Flashcards" : mode === "mock" ? "Test nanečisto" : "Tréninkový režim"}</h1>

      <div className="progress">
        {mode === "random"
          ? `Zodpovězeno: ${questionSet.filter(q => q.userAnswer !== undefined).length} | Správně: ${score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0} %`
          : `Otázka ${currentIndex + 1} / ${mode === "training" ? maxSeenIndex + 1 : questionSet.length}`}
      </div>

      <div className="card" ref={cardRef}>
        {!finished ? (
          <>
            <QuestionCard currentQuestion={currentQuestion} mode={mode} showResult={showResult} selectedAnswer={selectedAnswer} onSelect={(i) => mode === "random" ? clickRandomAnswer(i) : handleAnswer(i)} optionRefsForCurrent={optionRefsForCurrent} disabled={mode === "random" && showResult} />

            {mode === "random" && !showResult && (
              <div className="actionButtons right">
                <button className="navButton primary" onClick={confirmRandomAnswer}>Potvrdit</button>
              </div>
            )}

            {mode === "random" && showResult && (
              <div className="actionButtons right">
                <button className="navButton" onClick={nextRandomQuestion}>Další otázka</button>
              </div>
            )}

            {(mode === "mock" || mode === "training") && (
              <>
                <div className="actionButtons spaced">
                  <button className="navButton" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>Předchozí</button>
                  <button className="navButton" onClick={() => setCurrentIndex(Math.min((mode === "training" ? maxSeenIndex : questionSet.length - 1), currentIndex + 1))} disabled={currentIndex === (mode === "training" ? maxSeenIndex : questionSet.length - 1)}>Další</button>
                </div>

                <div className="navigatorWrapper" ref={scrollRef}>
                  <Navigator questionSet={questionSet} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} mode={mode} maxSeenIndex={maxSeenIndex} />
                </div>
              </>
            )}
          </>
        ) : (
          <ResultScreen mode={mode} score={score} trainingTime={trainingTime} questionSet={questionSet} maxSeenIndex={maxSeenIndex} onBack={resetToMenu} />
        )}
      </div>

      {/* Fullscreen obrázek */}
      {fullscreenImage && (
        <div className="fullscreenOverlay" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="Fullscreen" className="fullscreenImage" />
          <button className="closeFullscreen" onClick={() => setFullscreenImage(null)}>×</button>
        </div>
      )}

      {/* Dialogy */}
      {showConfirmSubmit && (
        <ConfirmModal title={`Opravdu chceš ${mode === "mock" ? "odevzdat test" : "vyhodnotit otázky"}?`} message={`Tato akce je nevratná.`} onCancel={cancelSubmit} onConfirm={submitTest} />
      )}

      {showConfirmExit && (
        <ConfirmModal title={`Opravdu chceš opustit test?`} message={`Všechen pokrok bude ztracen.`} onCancel={() => setShowConfirmExit(false)} onConfirm={confirmExit} confirmText="Opustit" cancelText="Zůstat" />
      )}
    </div>
  );
}
