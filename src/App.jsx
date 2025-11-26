import React, { useState, useEffect, useRef } from "react";
import { QUESTIONS_SPS } from "./questionsSPS.js";
import { QUESTIONS_STT } from "./questionsSTT.js";
import { SubjectSelector } from "./components/SubjectSelector.jsx";

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
  const wrapperRef = React.useRef(null);
  const dragStateRef = React.useRef({ isDragging: false, startX: 0, scrollLeft: 0, moved: 0 });

  React.useEffect(() => {
    if (!wrapperRef.current) return;
    const wrapper = wrapperRef.current;
    const buttons = wrapper.querySelectorAll('.navNumber');
    const currentButton = buttons[currentIndex];
    if (currentButton) {
      const buttonLeft = currentButton.offsetLeft;
      const buttonWidth = currentButton.offsetWidth;
      const wrapperWidth = wrapper.clientWidth;
      const targetScroll = buttonLeft + buttonWidth / 2 - wrapperWidth / 2;
      wrapper.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  }, [currentIndex]);

  const handleMouseDown = (e) => {
    if (!wrapperRef.current) return;
    dragStateRef.current.isDragging = true;
    dragStateRef.current.startX = e.pageX;
    dragStateRef.current.scrollLeft = wrapperRef.current.scrollLeft;
    dragStateRef.current.moved = 0;
  };

  const handleMouseMove = (e) => {
    if (!dragStateRef.current.isDragging || !wrapperRef.current) return;
    const diff = e.pageX - dragStateRef.current.startX;
    dragStateRef.current.moved = Math.abs(diff);
    wrapperRef.current.scrollLeft = dragStateRef.current.scrollLeft - diff;
  };

  const handleMouseUp = () => {
    dragStateRef.current.isDragging = false;
  };

  const handleTouchStart = (e) => {
    if (!wrapperRef.current) return;
    dragStateRef.current.isDragging = true;
    dragStateRef.current.startX = e.touches[0].pageX;
    dragStateRef.current.scrollLeft = wrapperRef.current.scrollLeft;
    dragStateRef.current.moved = 0;
  };

  const handleTouchMove = (e) => {
    if (!dragStateRef.current.isDragging || !wrapperRef.current) return;
    const diff = e.touches[0].pageX - dragStateRef.current.startX;
    dragStateRef.current.moved = Math.abs(diff);
    wrapperRef.current.scrollLeft = dragStateRef.current.scrollLeft - diff;
  };

  const handleTouchEnd = () => {
    dragStateRef.current.isDragging = false;
  };

  const handleButtonClick = (i) => {
    if (dragStateRef.current.moved < 5) {
      setCurrentIndex(i);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={`navigatorWrapper ${mode === "training" ? "noAutoScroll" : ""} ${dragStateRef.current.isDragging ? "dragging" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="compactNavigator">
        {questionSet.map((_, i) => {
          if (mode === "training" && i > maxSeenIndex) return null;
          const isAnswered = questionSet[i]?.userAnswer !== undefined;
          return (
            <button
              key={i}
              className={`navNumber ${currentIndex === i ? "current" : ""} ${isAnswered ? "answered" : ""}`}
              onClick={() => handleButtonClick(i)}
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
      <div className="questionHeader">
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
          const isCorrect = showResult && i === currentQuestion.correctIndex;
          const isSelected = selectedAnswer === i;
          const isWrong = showResult && isSelected && i !== currentQuestion.correctIndex;
          const style = isCorrect ? { backgroundColor: "#10b981", borderColor: "#059669" } : isWrong ? { backgroundColor: "#ef4444", borderColor: "#dc2626" } : {};
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

function formatTime(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/* ---------- Main App ---------- */

export default function App() {
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [mode, setMode] = useState(null);
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

  const optionRefsForCurrent = useRef({});
  const scrollRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    questions.forEach((q, i) => { q._localIndex = i; });
  }, [questions]);

  useEffect(() => {
    const setVH = () => document.documentElement.style.setProperty("--vh", `${window.innerHeight}px`);
    setVH();
    window.addEventListener("resize", setVH);
    return () => window.removeEventListener("resize", setVH);
  }, []);

  useEffect(() => {
    if (mode !== "training") return;
    if (currentIndex > maxSeenIndex) {
      setMaxSeenIndex(currentIndex);
    }
  }, [currentIndex, mode]);

  useEffect(() => {
    if (!cardRef.current || mode === "training") return;
    cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentIndex, mode]);

  useEffect(() => {
    if (mode !== "training" || finished) return;
    const t = setInterval(() => setTrainingTime((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [mode, finished]);

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

  useEffect(() => {
    if (mode === "mock" && timeLeft === 0 && !finished) {
      submitTest();
    }
  }, [mode, timeLeft, finished]);

  useEffect(() => {
    if (!mode || mode === "review") return;

    const onKey = (e) => {
      const curQ = questions[currentIndex] || { options: [] };
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
        if (mode !== "random") {
          const newIdx = Math.max(0, currentIndex - 1);
          moveToQuestion(newIdx);
        }
      }
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        if (mode !== "random") {
          const newIdx = currentIndex + 1;
          moveToQuestion(newIdx);
        }
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (mode === "random" && !showResult) confirmRandomAnswer();
        if (mode === "random" && showResult) nextRandomQuestion();
        if ((mode === "mock" || mode === "training") && !finished) {
          if (currentIndex < questions.length - 1) moveToQuestion(currentIndex + 1);
        }
      }
      if (e.key === "Backspace") {
        if (mode === "random") {
          if (showResult) {
            setShowResult(false);
            setSelectedAnswer(null);
          }
        } else {
          setQuestionSet(q => q.map((x, i) => i === currentIndex ? { ...x, userAnswer: undefined } : x));
        }
      }
      if (e.key === "Escape") {
        if (mode === "random" && showResult) {
          setShowResult(false);
          setSelectedAnswer(null);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, currentIndex, selectedAnswer, showResult, questions, finished]);

  /* ---------- Logic ---------- */

  const handleSelectSubject = (subject) => {
    if (subject === "sps") {
      setQuestions([...QUESTIONS_SPS]);
      setSelectedSubject("sps");
    } else if (subject === "stt") {
      setQuestions([...QUESTIONS_STT]);
      setSelectedSubject("stt");
    }
  };

  const handleUploadFile = (uploadedQuestions) => {
    setQuestions([...uploadedQuestions]);
    setSelectedSubject("custom");
  };

  const [questionSet, setQuestionSet] = useState([]);

  const startRandomMode = () => {
    const qs = questions.map((q, i) => ({ ...q, userAnswer: undefined, _localIndex: i }));
    setQuestionSet(qs);
    setMode("random");
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore({ correct: 0, total: 0 });
    optionRefsForCurrent.current = {};
  };

  const startMockTest = () => {
    const qs = questions.slice(0, 40).map((q, i) => ({ ...q, userAnswer: undefined, _localIndex: i }));
    setQuestionSet(qs);
    setMode("mock");
    setCurrentIndex(0);
    setTimeLeft(1800);
    setFinished(false);
    optionRefsForCurrent.current = {};
  };

  const startTrainingMode = () => {
    const qs = questions.map((q, i) => ({ ...q, userAnswer: undefined, _localIndex: i }));
    setQuestionSet(qs);
    setMode("training");
    setCurrentIndex(0);
    setMaxSeenIndex(0);
    setTrainingTime(0);
    setFinished(false);
    optionRefsForCurrent.current = {};
  };

  const startReviewMode = () => {
    setMode("review");
  };

  const selectRandomAnswer = (idx) => {
    setSelectedAnswer(idx);
  };

  const clickRandomAnswer = (idx) => {
    setSelectedAnswer(idx);
  };

  const confirmRandomAnswer = () => {
    if (selectedAnswer === null) return;
    const correct = questionSet[currentIndex].userAnswer === undefined ? selectedAnswer === questionSet[currentIndex].correctIndex : true;
    const newQS = [...questionSet];
    newQS[currentIndex].userAnswer = selectedAnswer;
    setQuestionSet(newQS);
    setShowResult(true);
    if (correct) setScore(s => ({ ...s, correct: s.correct + 1 }));
    setScore(s => ({ ...s, total: s.total + 1 }));
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
    setTimeout(() => {
      const refs = optionRefsForCurrent.current?.[questionSet[nextIdx]._localIndex] || [];
      if (refs[0]) refs[0].focus();
    }, 50);
  };

  const handleAnswer = (idx) => {
    const newQS = [...questionSet];
    newQS[currentIndex].userAnswer = idx;
    setQuestionSet(newQS);
  };

  const moveToQuestion = (idx) => {
    const bounded = Math.max(0, Math.min(idx, questionSet.length - 1));
    setCurrentIndex(bounded);
    if (mode === "training" && bounded > maxSeenIndex) {
      setMaxSeenIndex(bounded);
    }
  };

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
    else resetToMode();
  };

  const confirmExit = () => { resetToMode(); setShowConfirmExit(false); };

  const resetToMode = () => {
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

  const resetToSubject = () => {
    setSelectedSubject(null);
    resetToMode();
  };

  /* ---------- Render ---------- */

  if (!selectedSubject) {
    return <SubjectSelector onSelectSubject={handleSelectSubject} onUploadFile={handleUploadFile} />;
  }

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
        <button className="menuBackButton" onClick={resetToSubject} style={{ marginTop: "2rem" }}>Změnit předmět</button>
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
          {questions.map((q) => (
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
                  <button className="navButton" onClick={() => {
                    const newIdx = Math.max(0, currentIndex - 1);
                    moveToQuestion(newIdx);
                  }} disabled={currentIndex === 0}>Předchozí</button>
                  <button className="navButton" onClick={() => {
                    const newIdx = currentIndex + 1;
                    moveToQuestion(newIdx);
                  }} disabled={currentIndex === questionSet.length - 1}>Další</button>
                </div>

                <div className="navigatorWrapper" ref={scrollRef}>
                  <Navigator questionSet={questionSet} currentIndex={currentIndex} setCurrentIndex={moveToQuestion} mode={mode} maxSeenIndex={maxSeenIndex} />
                </div>
              </>
            )}
          </>
        ) : (
          <ResultScreen mode={mode} score={score} trainingTime={trainingTime} questionSet={questionSet} maxSeenIndex={maxSeenIndex} onBack={resetToMode} />
        )}
      </div>

      {fullscreenImage && (
        <div className="fullscreenOverlay" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="Fullscreen" className="fullscreenImage" />
          <button className="closeFullscreen" onClick={() => setFullscreenImage(null)}>×</button>
        </div>
      )}

      {showConfirmSubmit && (
        <ConfirmModal title={`Opravdu chceš ${mode === "mock" ? "odevzdat test" : "vyhodnotit otázky"}?`} message={`Tato akce je nevratná.`} onCancel={cancelSubmit} onConfirm={submitTest} />
      )}

      {showConfirmExit && (
        <ConfirmModal title={`Opravdu chceš opustit test?`} message={`Všechen pokrok bude ztracen.`} onCancel={() => setShowConfirmExit(false)} onConfirm={confirmExit} confirmText="Opustit" cancelText="Zůstat" />
      )}
    </div>
  );
}
