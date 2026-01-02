import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { QuestionCard } from './QuestionCard';
import { Navigator } from './Navigator';
import { ConfirmModal } from './Modals';
import { CustomImageModal } from './CustomImageModal';
import { SubjectBadge } from './SubjectBadge';
import { UserBadgeDisplay } from './UserBadgeDisplay';
import { ThemeToggle } from './ThemeToggle';
import { formatTime } from '../utils/formatting';
import { ResultScreen } from './ResultScreen'; 

export function RealTestMode({ 
    test, 
    initialQuestions, 
    user, 
    userId, 
    onExit, 
    onFinish,
    theme,
    toggleTheme,
    syncing,
    onReport,
    onTestCompleted
}) {
    // --- STATE ---
    const [questionSet, setQuestionSet] = useState(initialQuestions);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [readyQuestionId, setReadyQuestionId] = useState(null);
    const [timeLeft, setTimeLeft] = useState(test.time_limit * 60);
    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [direction, setDirection] = useState('right');
    const [finalResult, setFinalResult] = useState(null);
    const [showAutoSubmitModal, setShowAutoSubmitModal] = useState(false);

    // Refs
    const cardRef = useRef(null);
    const optionRefsForCurrent = useRef({});
    const questionSetRef = useRef(questionSet);
    const timeLeftRef = useRef(timeLeft);
    
    // Čas začátku testu pro přesný výpočet na mobilech
    const testStartTimeRef = useRef(Date.now());
    const testDurationMs = test.time_limit * 60 * 1000;

    // Udržování aktuálních hodnot v refs
    useEffect(() => {
        questionSetRef.current = questionSet;
    }, [questionSet]);
    
    useEffect(() => {
        timeLeftRef.current = timeLeft;
    }, [timeLeft]);

    const currentQuestion = questionSet[currentIndex];
    const currentQuestionId = currentQuestion?.id || currentQuestion?.number || currentIndex;
    const isContentReady = readyQuestionId === currentQuestionId;
    const selectedAnswer = currentQuestion?.userAnswer !== undefined ? currentQuestion.userAnswer : null;

    // Globální tracking pro QuestionCard swipe logiku
    useEffect(() => {
        window.currentTestIndex = currentIndex;
        window.totalTestQuestions = questionSet.length;
        
        // Cleanup při unmountu
        return () => {
            window.currentTestIndex = undefined;
            window.totalTestQuestions = undefined;
        };
    }, [currentIndex, questionSet.length]);

    // Ref pro funkci vypršení času (aby timer měl vždy aktuální verzi)
    const handleTimeExpiredRef = useRef(null);
    
    // Funkce volaná při vypršení času
    const executeAutoSubmit = () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setShowConfirmSubmit(false);

        // Použití refs pro aktuální hodnoty
        const currentQuestions = questionSetRef.current;

        const correctCount = currentQuestions.filter(q => q.userAnswer === q.correctIndex).length;
        const totalCount = currentQuestions.length;
        const answersToSave = currentQuestions.map(q => ({
            qNum: q.number,
            user: q.userAnswer,
            correct: q.correctIndex
        }));

        const timeSpent = test.time_limit * 60; // Celý čas byl využit

        // DŮLEŽITÉ: Nejprve nastavíme UI stav OKAMŽITĚ (bez čekání na databázi)
        // To zajistí zobrazení modálu na mobilu i při pomalém připojení
        setFinalResult({
            score: { correct: correctCount, total: totalCount },
            timeSpent: timeSpent,
            timeLeft: 0
        });
        setShowAutoSubmitModal(true);

        // Po 3 sekundách automaticky zavřeme modál a ukážeme výsledky
        setTimeout(() => {
            setShowAutoSubmitModal(false);
        }, 3000);

        if (onTestCompleted) onTestCompleted(test.id);

        // Ukládání do databáze provedeme ASYNCHRONNĚ na pozadí
        (async () => {
            try {
                await supabase.from('test_results').insert([{
                    test_id: test.id,
                    student_name: user,
                    user_id: userId,
                    score_correct: correctCount,
                    score_total: totalCount,
                    answers: answersToSave,
                    time_spent: timeSpent,
                    cheat_score: 0 
                }]);
                console.log("Test úspěšně uložen do databáze.");
            } catch (error) {
                console.error("Chyba při ukládání do databáze:", error);
            } finally {
                setIsSubmitting(false);
            }
        })();
    };

    handleTimeExpiredRef.current = executeAutoSubmit;

    // --- ČASOVAČ (s podporou pro mobily a pozastavené browsery) ---
    useEffect(() => {
        if (finalResult) return;
        
        // Funkce pro výpočet zbývajícího času na základě skutečného času
        const calculateRemainingTime = () => {
            const elapsed = Date.now() - testStartTimeRef.current;
            const remaining = Math.max(0, Math.ceil((testDurationMs - elapsed) / 1000));
            return remaining;
        };
        
        // Kontrola při návratu do aplikace (mobil)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !isSubmittingRef.current && !finalResult) {
                const remaining = calculateRemainingTime();
                if (remaining <= 0) {
                    if (handleTimeExpiredRef.current) {
                        handleTimeExpiredRef.current();
                    }
                } else {
                    setTimeLeft(remaining);
                }
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        const timer = setInterval(() => {
            const remaining = calculateRemainingTime();
            
            if (remaining <= 0) {
                clearInterval(timer);
                if (handleTimeExpiredRef.current && !isSubmittingRef.current) {
                    handleTimeExpiredRef.current();
                }
                setTimeLeft(0);
            } else {
                setTimeLeft(remaining);
            }
        }, 1000);
        
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [finalResult, testDurationMs]);

    // --- LOGIKA ---
    const handleAnswer = (answerIndex) => {
        if (finalResult) return;
        setQuestionSet(prev => {
            const newSet = [...prev];
            newSet[currentIndex] = { ...newSet[currentIndex], userAnswer: answerIndex };
            return newSet;
        });
    };

    const moveToQuestion = (index) => {
        if (index < 0 || index >= questionSet.length) return;
        setReadyQuestionId(null);
        setDirection(index < currentIndex ? 'left' : 'right');
        setCurrentIndex(index);
    };

    // Ruční odeslání testu
    const submitTest = async () => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setShowConfirmSubmit(false);

        const currentQuestions = questionSet;
        const currentTimeLeft = timeLeft;

        const correctCount = currentQuestions.filter(q => q.userAnswer === q.correctIndex).length;
        const totalCount = currentQuestions.length;
        const answersToSave = currentQuestions.map(q => ({
            qNum: q.number,
            user: q.userAnswer,
            correct: q.correctIndex
        }));

        try {
            const timeSpent = (test.time_limit * 60) - Math.max(0, currentTimeLeft);
            
            await supabase.from('test_results').insert([{
                test_id: test.id,
                student_name: user,
                user_id: userId,
                score_correct: correctCount,
                score_total: totalCount,
                answers: answersToSave,
                time_spent: timeSpent,
                cheat_score: 0 
            }]);

            if (onTestCompleted) onTestCompleted(test.id);

            setFinalResult({
                score: { correct: correctCount, total: totalCount },
                timeSpent: timeSpent,
                timeLeft: Math.max(0, currentTimeLeft)
            });

        } catch (error) {
            console.error("Chyba při ukládání:", error);
            isSubmittingRef.current = false;
            alert("Chyba při ukládání výsledků. Zkuste to prosím znovu.");
            setIsSubmitting(false);
        }
    };

    // --- KLÁVESNICE ---
    useEffect(() => {
        if (finalResult) return;
        const handleKeyDown = (e) => {
            if (showConfirmSubmit || isSubmitting) return;
            const optsCount = currentQuestion?.options?.length || 4;

            switch(e.key) {
                case "ArrowUp":
                case "w":
                case "W":
                    if (selectedAnswer === null) handleAnswer(optsCount - 1);
                    else handleAnswer((selectedAnswer - 1 + optsCount) % optsCount);
                    break;
                case "ArrowDown":
                case "s":
                case "S":
                    if (selectedAnswer === null) handleAnswer(0);
                    else handleAnswer((selectedAnswer + 1) % optsCount);
                    break;
                case "ArrowLeft":
                case "a":
                case "A":
                    moveToQuestion(currentIndex - 1);
                    break;
                case "ArrowRight":
                case "d":
                case "D":
                case "Enter":
                    moveToQuestion(currentIndex + 1);
                    break;
                case " ": 
                    setShowConfirmSubmit(true);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, selectedAnswer, showConfirmSubmit, isSubmitting, currentQuestion, finalResult]);


    const handleSwipe = (dir) => {
        if (finalResult || showConfirmSubmit || isSubmitting) return;
        
        if (dir === "left") {
            if (currentIndex < questionSet.length - 1) {
                moveToQuestion(currentIndex + 1);
            }
        } else if (dir === "right") {
            if (currentIndex > 0) {
                moveToQuestion(currentIndex - 1);
            }
        }
    };

    // --- RENDER ---
    // Na mobilu chceme vidět modál i přes ResultScreen, pokud byl vyvolán automaticky
    const renderContent = () => {
        if (finalResult && !showAutoSubmitModal) {
            return (
                <ResultScreen 
                    mode="real_test"
                    score={finalResult.score}
                    trainingTime={0} 
                    timeLeftAtSubmit={finalResult.timeLeft} 
                    questionSet={questionSet}
                    maxSeenIndex={questionSet.length}
                    onBack={onExit} 
                    currentSubject={test.subject}
                    onZoom={setFullscreenImage}
                    user={user}
                    syncing={syncing}
                    onReport={onReport}
                />
            );
        }

        return (
            <>
                <div className="top-navbar">
                    <div className="navbar-group">
                        <span style={{fontWeight:'bold', color:'var(--color-primary)', display:'flex', alignItems:'center', gap:'0.5rem', fontSize: '0.9rem'}}>
                            📝 TEST PROBÍHÁ
                        </span>
                        <div className="mobile-hidden">
                            <SubjectBadge subject={test.subject} compact />
                        </div>
                    </div>
                    <div className="navbar-group">
                        <div className={`timer ${timeLeft <= 300 ? "timerWarning" : ""} ${timeLeft <= 60 ? "timerDanger" : ""}`}>
                            {formatTime(timeLeft)}
                        </div>
                        <UserBadgeDisplay user={user} syncing={syncing} compactOnMobile={true} />
                        <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                    </div>
                </div>

                <div className="quizContentWrapper">
                    <h1 className="title">{test.title}</h1>
                    <div className="progressBarContainer">
                        <div className="progressBarFill" style={{ width: `${((currentIndex + 1) / questionSet.length) * 100}%` }}></div>
                    </div>
                    <div className="progressText">Otázka {currentIndex + 1} / {questionSet.length}</div>

                    <div className="card" ref={cardRef}>
                        <div key={currentIndex} className={direction === 'left' ? "slide-in-left" : "slide-in-right"} style={{width: '100%', visibility: isContentReady ? 'visible' : 'hidden'}}>
                            <QuestionCard
                                currentQuestion={currentQuestion}
                                mode="real_test" 
                                showResult={false}
                                selectedAnswer={selectedAnswer}
                                onSelect={handleAnswer}
                                optionRefsForCurrent={optionRefsForCurrent}
                                disabled={finalResult !== null}
                                isKeyboardMode={true}
                                currentSubject={test.subject}
                                onZoom={setFullscreenImage}
                                onSwipe={handleSwipe}
                                score={{correct:0, total:0}}
                                onReady={() => setReadyQuestionId(currentQuestionId)}
                            />
                        </div>

                        {!isContentReady && (
                            <div className="card-loading-overlay">
                                <div className="loadingSpinner small"></div>
                            </div>
                        )}

                        <div className="actionButtons spaced">
                            <button 
                                className="navButton" 
                                onClick={() => moveToQuestion(currentIndex - 1)} 
                                disabled={currentIndex === 0 || finalResult !== null}
                            >
                                Předchozí
                            </button>

                            {currentIndex < questionSet.length - 1 ? (
                                <button 
                                    className="navButton" 
                                    onClick={() => moveToQuestion(currentIndex + 1)}
                                    disabled={finalResult !== null}
                                >
                                    Další
                                </button>
                            ) : (
                                <button 
                                    className="navButton" 
                                    style={{ opacity: 0.5, cursor: 'not-allowed' }}
                                    disabled={true}
                                >
                                    Další
                                </button>
                            )}
                        </div>

                        <div className="navigatorPlaceholder">
                            <Navigator 
                                questionSet={questionSet} 
                                currentIndex={currentIndex} 
                                setCurrentIndex={moveToQuestion} 
                                mode="real_test" 
                                maxSeenIndex={questionSet.length}
                            />
                            <div style={{ marginTop: "2rem", width: "100%", display: "flex", justifyContent: "center" }}>
                                <button 
                                    className="navButton primary" 
                                    style={{ padding: "10px 30px", fontSize: "0.95rem", minWidth: "150px" }} 
                                    onClick={() => setShowConfirmSubmit(true)}
                                    disabled={finalResult !== null}
                                >
                                    Odevzdat test
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    // --- RENDER ---
    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
            <CustomImageModal src={fullscreenImage} onClose={() => setFullscreenImage(null)} />

            {showAutoSubmitModal && (
                <ConfirmModal 
                    title="Čas vypršel" 
                    message="Časový limit pro tento test vypršel. Vaše odpovědi byly automaticky uloženy a odeslány k vyhodnocení."
                    onCancel={() => setShowAutoSubmitModal(false)} 
                    onConfirm={() => setShowAutoSubmitModal(false)} 
                    confirmText="Zobrazit výsledky" 
                    danger={false} 
                    hideButtons={true}
                />
            )}

            {showConfirmSubmit && (
                <ConfirmModal 
                    title="Odevzdat test?" 
                    message="Opravdu chcete test ukončit a odevzdat? Tuto akci nelze vrátit."
                    onCancel={() => setShowConfirmSubmit(false)} 
                    onConfirm={() => submitTest()} 
                    confirmText="ODEVZDAT" 
                    danger={true} 
                />
            )}

            {renderContent()}
            <div className="footer"></div>
        </div>
    );
}