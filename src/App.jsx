import { useState, useEffect } from "react";
import { QUESTIONS } from "./questions";

// --- Inline fallback obrázek (1x1 px průhledný PNG) ---
const fallbackImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

// --- Vite: bezpečné načtení všech obrázků z /src/images ---
const images = import.meta.glob('./images/*.png', { eager: true, as: 'url' });
const IMAGES = {};
for (const path in images) {
  const fileName = path.match(/\/(\d+)\.png$/)?.[1];
  if (fileName) IMAGES[fileName] = images[path];
}

export default function App() {
  const [mode, setMode] = useState(null);
  const [questionSet, setQuestionSet] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [fade, setFade] = useState(true);
  const [maxSeenIndex, setMaxSeenIndex] = useState(0);

  useEffect(() => {
    let timer;
    if (mode === 'mock' && !finished) {
      timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timer);
            submitMockTest();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [mode, finished]);

  const changeQuestion = (idx) => {
    setFade(false);
    setTimeout(() => {
      goToQuestion(idx);
      setFade(true);
      if (idx > maxSeenIndex) setMaxSeenIndex(idx);
    }, 100);
  };

  const startRandomMode = () => {
    const prepared = [...QUESTIONS].sort(() => Math.random() - 0.5)
      .map(q => ({ ...q, options: [...q.options] }));
    setQuestionSet(prepared);
    setCurrentIndex(0);
    setScore(0);
    setMode('random');
    setShowResult(false);
    setSelectedAnswer(null);
    setFinished(false);
    setFade(true);
  };

  const startMockTest = () => {
    const prepared = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0,40)
      .map(q => ({ ...q, options: [...q.options], userAnswer: undefined }));
    setQuestionSet(prepared);
    setCurrentIndex(0);
    setScore(0);
    setMode('mock');
    setShowResult(false);
    setSelectedAnswer(null);
    setTimeLeft(1800); // 30 minut
    setFinished(false);
    setFade(true);
  };

  const startTrainingMode = () => {
    const prepared = QUESTIONS.map(q => ({ ...q, options: [...q.options], userAnswer: undefined }));
    setQuestionSet(prepared);
    setCurrentIndex(0);
    setScore(0);
    setMode('training');
    setShowResult(false);
    setSelectedAnswer(null);
    setFinished(false);
    setMaxSeenIndex(0);
    setFade(true);
  };

  const startReviewMode = () => {
    const prepared = QUESTIONS.map(q => ({ ...q, options: [...q.options] }));
    setQuestionSet(prepared);
    setMode('review');
    setSelectedAnswer(null);
    setFade(true);
  };

  const handleAnswer = (index) => {
    if (mode === 'random' && !showResult) {
      setSelectedAnswer(index);
    } else if (mode === 'mock' || mode === 'training') {
      const newSet = [...questionSet];
      newSet[currentIndex].userAnswer = index;
      setQuestionSet(newSet);
      setSelectedAnswer(index);
    }
  };

  const submitRandomAnswer = () => {
    if (selectedAnswer !== null) {
      setShowResult(true);
      if (selectedAnswer === currentQuestion.correctIndex) setScore(s => s + 1);
    }
  };

  const goToQuestion = (idx) => {
    setCurrentIndex(idx);
    setSelectedAnswer(questionSet[idx]?.userAnswer ?? null);
    setShowResult(false);
  };

  const submitMockTest = () => {
    let calculatedScore = 0;
    questionSet.forEach(q => {
      if (q.userAnswer === q.correctIndex) calculatedScore++;
    });
    setScore(calculatedScore);
    setFinished(true);
  };

  const submitTraining = () => {
    let calculatedScore = 0;
    questionSet.forEach(q => {
      if (q.userAnswer === q.correctIndex) calculatedScore++;
    });
    setScore(calculatedScore);
    setFinished(true);
  };

  const returnToMenu = () => {
    setMode(null);
    setQuestionSet([]);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setFinished(false);
    setMaxSeenIndex(0);
  };

  const currentQuestion = questionSet[currentIndex] || { question:'', options:[], correctIndex:0, number:0 };
  const getQuestionImage = (question) => IMAGES[question.number] || fallbackImg;

  const isTraining = mode === 'training';
  const isMock = mode === 'mock';
  const isRandom = mode === 'random';

  if (!mode) {
    return (
      <div className="container">
        <h1 className="title">Uzavřené otázky SPS - Procvičení</h1>
        <div className="menu">
          <button className="menuButton" onClick={startRandomMode}>Náhodný výběr otázek</button>
          <button className="menuButton" onClick={startMockTest}>Test nanečisto (40 otázek, 30 minut)</button>
          <button className="menuButton" onClick={startTrainingMode}>Tréninkový mód</button>
          <button className="menuButton" onClick={startReviewMode}>Prohlížení všech otázek</button>
        </div>
      </div>
    );
  }

  if (mode === 'review') {
    return (
      <div className="container">
        <h1 className="title">Prohlížení všech otázek</h1>
        <button className="menuBackButton" onClick={returnToMenu}>↩ Návrat do menu</button>
        <div className="reviewList">
          {questionSet.map(q => (
            <div key={q.number} className="reviewQuestion">
              <strong>{q.number}. {q.question}</strong>
              <img src={getQuestionImage(q)} alt="" className="questionImage"/>
              <div>Možnosti: {q.options.join(', ')}</div>
              <div>Správná odpověď: {q.options[q.correctIndex]}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 className="title">Uzavřené otázky SPS - Procvičení</h1>
      <button className="menuBackButton" onClick={returnToMenu}>↩ Návrat do menu</button>

      {(isMock || (isTraining && !finished)) && (
        <div className="timer">
          {isMock ? `Čas: ${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}` : 'Tréninkový mód - neomezený čas'}
        </div>
      )}

      <div className="progress">Otázka {currentIndex + 1} / {questionSet.length}</div>

      <div className={`card ${fade ? 'fadeIn' : 'fadeOut'}`}>
        {!finished ? (
          <>
            <div className="questionHeader">
              <h2 className="questionText">
                {isRandom ? `#${currentQuestion.number} ` : ''}{currentQuestion.question}
              </h2>
              <img src={getQuestionImage(currentQuestion)} alt="" className="questionImage"/>
            </div>

            <div className="options" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentQuestion.options.map((opt, idx) => {
                let style = {};
                if (isRandom && showResult) {
                  if (idx === currentQuestion.correctIndex) {
                    style = { 
                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(22, 163, 74, 0.3) 100%)',
                      borderColor: 'rgba(34, 197, 94, 0.6)',
                      color: '#86efac'
                    };
                  }
                  if (selectedAnswer === idx && idx !== currentQuestion.correctIndex) {
                    style = { 
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.3) 100%)',
                      borderColor: 'rgba(239, 68, 68, 0.6)',
                      color: '#fca5a5'
                    };
                  }
                } else if (selectedAnswer === idx) {
                  style = { 
                    background: 'rgba(59, 130, 246, 0.3)',
                    borderColor: 'rgba(59, 130, 246, 0.6)',
                    color: '#93c5fd'
                  };
                }
                return (
                  <button
                    key={idx}
                    className="optionButton"
                    style={style}
                    onClick={() => handleAnswer(idx)}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>

            {isRandom && !showResult && (
              <div className="actionButtons">
                <button className="navButton" onClick={submitRandomAnswer}>Odeslat odpověď</button>
              </div>
            )}

            {isRandom && showResult && currentIndex < questionSet.length - 1 && (
              <div className="actionButtons">
                <button className="navButton" onClick={() => changeQuestion(currentIndex+1)}>Další otázka →</button>
              </div>
            )}

            {(isMock || isTraining) && (
              <>
                <div className="actionButtons spaced">
                  <button
                    className="navButton"
                    onClick={() => changeQuestion(Math.max(0, currentIndex-1))}
                    disabled={currentIndex === 0}
                  >
                    ← Předchozí
                  </button>
                  <button
                    className="navButton"
                    onClick={() => {
                      if (currentIndex < questionSet.length - 1) {
                        changeQuestion(currentIndex + 1);
                      } else {
                        isMock ? submitMockTest() : submitTraining();
                      }
                    }}
                  >
                    {currentIndex < questionSet.length - 1 ? 'Další →' : 'Odevzdat test'}
                  </button>
                </div>

                <div className="questionNavigator">
                  {(isMock ? questionSet : questionSet.slice(0, maxSeenIndex+1)).map((q, idx) => (
                    <button
                      key={idx}
                      className={`navNumber ${currentIndex===idx?'current':''} ${q.userAnswer!==undefined?'answered':''}`}
                      onClick={() => changeQuestion(idx)}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div>
            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: '#60a5fa' }}>✅ Test dokončen!</h2>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem', color: '#86efac' }}>
              Skóre: {score} / {questionSet.length}
            </p>
            <p style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#cbd5e1' }}>
              Procenta: {Math.round(score/questionSet.length*100)}%
            </p>
            <div className="reviewList">
              {questionSet.map((q, idx) => (
                <div
                  key={idx}
                  className={`reviewQuestion ${q.userAnswer === q.correctIndex ? 'correct' : 'wrong'}`}
                >
                  <strong>Otázka {idx + 1}: {q.question}</strong>
                  <img src={getQuestionImage(q)} alt="" className="questionImage"/>
                  <div>Správná odpověď: {q.options[q.correctIndex]}</div>
                  <div>Vaše odpověď: {q.userAnswer!==undefined ? q.options[q.userAnswer] : 'nezodpovězeno'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
