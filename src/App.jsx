import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { useUserProfile } from "./hooks/useUserProfile"; 
import { useActivityDetection } from "./hooks/useActivityDetection";
import { useGlobalKeyboard } from "./hooks/useGlobalKeyboard";

import { SubjectSelector } from "./components/SubjectSelector.jsx";
import { AdminPanel } from "./components/AdminPanel.jsx";
import { TestManager } from "./components/TestManager.jsx"; 

import { SessionBlockedScreen } from "./components/SessionBlockedScreen.jsx";
import { CloudLoginScreen } from "./components/CloudLoginScreen.jsx";
import { CustomImageModal } from "./components/CustomImageModal.jsx";
import { HighlightedText } from "./components/HighlightedText.jsx";
import { MainMenu } from "./components/MainMenu.jsx";
import { ScheduledTestsList } from "./components/ScheduledTestsList.jsx";
import { RealTestMode } from "./components/RealTestMode.jsx";

import { 
    formatTime, 
    removeAccents, 
    getSmartRegex, 
    isFlashcardStyle 
} from "./utils/formatting.js";
import { getImageUrl } from "./utils/images.js";
import { 
    fetchQuestionsLightweight, 
    clearImageCache, 
    getCachedImage, 
    fetchQuestionImage,
    preloadTestImages 
} from "./utils/dataManager.js"; 

import { SubjectBadge } from "./components/SubjectBadge.jsx";
import { UserBadgeDisplay } from "./components/UserBadgeDisplay.jsx";
import { HistoryView } from "./components/HistoryView.jsx";
import { ResultScreen } from "./components/ResultScreen.jsx";
import { QuestionCard } from "./components/QuestionCard.jsx";
import { Navigator } from "./components/Navigator.jsx";
import { ThemeToggle } from "./components/ThemeToggle.jsx";
import { HiddenPreloader } from "./components/HiddenPreloader.jsx";
import { ConfirmModal, SmartSettingsModal } from "./components/Modals.jsx"; 
import { NoMistakesScreen } from "./components/NoMistakesScreen.jsx"; 
import { ReportModal } from "./components/ReportModal.jsx";

import { CustomImportGuide } from "./components/CustomImportGuide.jsx";

/* ---------- Main App ---------- */

const ReviewImage = ({ q, subject, setFullscreenImage }) => {
    const [imgUrl, setImgUrl] = useState(() => {
        return q.image_base64 || (q.id ? getCachedImage(q.id) : null) || getImageUrl(subject, q.number) || (q.image && q.image.length > 5 ? q.image : null);
    });

    useEffect(() => {
        if (q.id && !imgUrl) {
            fetchQuestionImage(q.id).then(url => {
                if (url) setImgUrl(url);
            });
        }
    }, [q.id, imgUrl]);

    if (!imgUrl) return null;

    return (
        <div className="reviewImageWrapper" onClick={() => setFullscreenImage(imgUrl)}>
            <img 
                src={imgUrl} 
                alt="" 
                className="reviewImage" 
                onError={(e) => e.target.style.display = 'none'}
            />
        </div>
    );
};

export default function App() {
    const {
        user, dbId, loading, syncing, isSessionBlocked,
        mistakes, history, testPracticeStats, totalTimeMap, totalQuestionsMap,
        login, logout, takeOverSession, saveData, refreshData, triggerFakeSync,
        setMistakes, setHistory
    } = useUserProfile();

    const [subject, setSubject] = useState(null);
    const [customQuestions, setCustomQuestions] = useState(null);

    const [theme, setTheme] = useState(() => localStorage.getItem("quizio_theme") || "dark");
    const [activeQuestionsCache, setActiveQuestionsCache] = useState([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [menuSelection, setMenuSelection] = useState(-1);
    const [mode, setMode] = useState(null);

    const [showSmartSettings, setShowSmartSettings] = useState(false);
    const [showClearMistakesConfirm, setShowClearMistakesConfirm] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [reviewPage, setReviewPage] = useState(0);
    const [questionSet, setQuestionSet] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showResult, setShowResult] = useState(false);
    const [score, setScore] = useState({ correct: 0, total: 0 });
    const [combo, setCombo] = useState(0);
    const [shake, setShake] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [finished, setFinished] = useState(false);

    const [maxSeenIndex, setMaxSeenIndex] = useState(0); 
    const [trainingTime, setTrainingTime] = useState(0); 

    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [showConfirmExit, setShowConfirmExit] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [timeLeftAtSubmit, setTimeLeftAtSubmit] = useState(0);

    const { isKeyboardMode, setIsKeyboardMode } = useGlobalKeyboard();
    const { sessionTime, setSessionTime, isAfk } = useActivityDetection(mode, isSessionBlocked);

    const [direction, setDirection] = useState("right");
    const [exitDirection, setExitDirection] = useState(null);

    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [questionToReport, setQuestionToReport] = useState(null);

    const [scheduledTests, setScheduledTests] = useState([]);
    const [activeTest, setActiveTest] = useState(null);
    const [completedTestIds, setCompletedTestIds] = useState([]);
    const [testToStart, setTestToStart] = useState(null);

    const optionRefsForCurrent = useRef({});
    const cardRef = useRef(null);
    const containerRef = useRef(null);

    const [sessionQuestionsCount, setSessionQuestionsCount] = useState(0);
    const [readyQuestionId, setReadyQuestionId] = useState(null);
    const [loadingProgress, setLoadingProgress] = useState(0);

    const currentQuestion = questionSet[currentIndex] || { question: "", options: [], correctIndex: 0, number: 0, _localIndex: currentIndex };
    const currentQuestionId = currentQuestion.id || currentQuestion.number || currentIndex;
    const isContentReady = readyQuestionId === currentQuestionId;
    const isTeacher = user === 'admin' || user === 'Ucitel';

    useEffect(() => {
        const savedCode = localStorage.getItem("quizio_user_code");
        if (savedCode && !user && !loading) {
             login(savedCode);
        }
    }, []);

    const saveDataToCloud = async (newMistakes, newHistory, timeToAdd = 0, questionsToAdd = 0, newTestStats = null) => {
        const updates = {};

        if (newMistakes !== undefined) updates.mistakes = newMistakes;
        if (newHistory !== undefined) updates.history = newHistory;
        if (newTestStats !== null) updates.test_practice_stats = newTestStats;

        if (timeToAdd > 0 && subject) {
            const currentSubjectTime = totalTimeMap[subject] || 0;
            updates.subject_times = { ...totalTimeMap, [subject]: currentSubjectTime + timeToAdd };
            setSessionTime(0); 
        }

        if (questionsToAdd > 0 && subject) {
            const currentCount = totalQuestionsMap[subject] || 0;
            updates.question_counts = { ...totalQuestionsMap, [subject]: currentCount + questionsToAdd };
            setSessionQuestionsCount(0); 
        }

        if (Object.keys(updates).length > 0) {
            await saveData(updates);
        }
    };

    const flushSessionStats = () => {
        if (sessionTime > 0 || sessionQuestionsCount > 0) {
            saveDataToCloud(undefined, undefined, sessionTime, sessionQuestionsCount);
        }
    };

    const fetchScheduledTests = async () => {
        if (!subject || subject === 'CUSTOM') return;
        const { data } = await supabase.from('scheduled_tests').select('*').eq('subject', subject).order('close_at', { ascending: true });
        if (data) setScheduledTests(data);
    };

    const fetchCompletedTests = async () => {
        if (!user || !dbId) { setCompletedTestIds([]); return; }
        const { data } = await supabase.from('test_results').select('test_id').eq('user_id', dbId);
        if (data) {
            const ids = [...new Set(data.map(item => item.test_id))];
            setCompletedTestIds(ids);
        }
    };

    useEffect(() => {
        if (!subject || subject === 'CUSTOM') return;
        fetchScheduledTests();
        const sub = supabase.channel('tests_update').on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_tests' }, fetchScheduledTests).subscribe();
        return () => supabase.removeChannel(sub);
    }, [subject]);

    useEffect(() => {
        if (!user || !dbId) { setCompletedTestIds([]); return; }
        fetchCompletedTests();
        const sub = supabase.channel('my_results_update')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'test_results', filter: `user_id=eq.${dbId}` }, (payload) => setCompletedTestIds(prev => [...prev, payload.new.test_id]))
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'test_results' }, fetchCompletedTests)
            .subscribe();
        return () => supabase.removeChannel(sub);
    }, [user, dbId]);

    const handleManualRefresh = async () => {
        await Promise.all([
            fetchScheduledTests(),
            fetchCompletedTests(),
            refreshData()
        ]);
    };

    const handleTestCompletion = (testId) => {
        setCompletedTestIds(prev => prev.includes(testId) ? prev : [...prev, testId]);
    };

    const triggerHaptic = (type) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
             if (type === 'success') navigator.vibrate(50);
             else if (type === 'error') navigator.vibrate([50, 100, 50]);
             else if (type === 'light') navigator.vibrate(10);
        }
    };

    useEffect(() => { if (containerRef.current) containerRef.current.scrollTop = 0; }, [subject, mode]);

    const updateMistakes = (newValOrFn) => {
        const next = typeof newValOrFn === "function" ? newValOrFn(mistakes) : newValOrFn;
        setMistakes(next);
        saveDataToCloud(next, undefined);
    };

    const updateHistory = (newValOrFn) => {
        const next = typeof newValOrFn === "function" ? newValOrFn(history) : newValOrFn;
        setHistory(next);
        saveDataToCloud(undefined, next);
    };

    const handleLogout = () => {
        flushSessionStats();
        setSubject(null); 
        setMode(null);
        logout(); 
    };

    const openHistoryWithRefresh = async () => {
        flushSessionStats();
        setMode("history"); 
        await refreshData();
    };

    useEffect(() => {
        if (sessionTime >= 60 || sessionQuestionsCount >= 10) saveDataToCloud(undefined, undefined, sessionTime, sessionQuestionsCount);
    }, [sessionTime, sessionQuestionsCount]);

    useEffect(() => { localStorage.setItem("quizio_theme", theme); document.body.className = theme === "light" ? "light-mode" : ""; }, [theme]);
    const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    const prepareQuestionSet = (baseQuestions, shouldShuffleOptions = false) => {
        if (!Array.isArray(baseQuestions)) return [];
        return baseQuestions.map((q, idx) => {
            let options = [...(q.options || [])];
            let correctIndex = q.correctIndex;

            if (shouldShuffleOptions) {
                const optionsWithMeta = options.map((opt, i) => ({
                    text: opt,
                    isCorrect: i === correctIndex
                }));
                // Fisher-Yates shuffle
                for (let i = optionsWithMeta.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [optionsWithMeta[i], optionsWithMeta[j]] = [optionsWithMeta[j], optionsWithMeta[i]];
                }
                options = optionsWithMeta.map(o => o.text);
                correctIndex = optionsWithMeta.findIndex(o => o.isCorrect);
            }

            return { 
                ...q, 
                options, 
                correctIndex,
                userAnswer: undefined, 
                _localIndex: idx, 
            };
        });
    };

    useEffect(() => {
        const fetchQuestions = async () => {
            if (!subject) { setActiveQuestionsCache([]); return; }
            if (subject === "CUSTOM") { setActiveQuestionsCache(prepareQuestionSet(customQuestions || [])); return; }

            setIsLoadingQuestions(true);
            const minDelay = new Promise(resolve => setTimeout(resolve, 500));

            try {
                const { data, error } = await fetchQuestionsLightweight(subject);
                await minDelay;
                if (error) throw error;
                if (data && data.length > 0) {
                    const mappedData = data.map((item) => ({ ...item, correctIndex: item.correct_index, options: Array.isArray(item.options) ? item.options : [] }));
                    setActiveQuestionsCache(prepareQuestionSet(mappedData));
                } else { setActiveQuestionsCache([]); }
            } catch (err) {
                console.error("Chyba při stahování otázek:", err); 
                alert("Nepodařilo se stáhnout otázky z cloudu."); 
                setActiveQuestionsCache([]);
            } finally { setIsLoadingQuestions(false); }
        };
        fetchQuestions();
    }, [subject, customQuestions]);

    const startTestPractice = async (test) => {
        const pool = activeQuestionsCache.filter(q => q.number >= test.topic_range_start && q.number <= test.topic_range_end);
        if (pool.length === 0) { alert("Žádné otázky v rozsahu."); return; }
        const shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        
        setMode("loading");
        setLoadingProgress(0);
        await preloadTestImages(shuffled, (progress) => {
            setLoadingProgress(progress);
        });
        
        setReadyQuestionId(null); setQuestionSet(shuffled); setMode("test_practice"); setActiveTest(test); setCurrentIndex(0); setScore({ correct: 0, total: 0 }); setFinished(false); setSelectedAnswer(null); setShowResult(false); setCombo(0);
    };

    const confirmStartTest = async () => {
        if (!testToStart) return;
        setTestToStart(null); 

        const test = testToStart;
        const pool = activeQuestionsCache.filter(q => q.number >= test.topic_range_start && q.number <= test.topic_range_end);
        const selected = [...pool].sort(() => Math.random() - 0.5).slice(0, test.question_count);
        const prepared = prepareQuestionSet(selected, true);

        setMode("loading");
        setLoadingProgress(0);
        await preloadTestImages(prepared, (progress) => {
            setLoadingProgress(progress);
        });

        setQuestionSet(prepared); 
        setActiveTest(test); 
        setMode("real_test"); 
    };

    const startGradedTest = async (test) => {
        const now = new Date();
        if (!test.open_at || !test.close_at) { alert("Tento test nemá stanovený termín."); return; }
        if (now < new Date(test.open_at)) { alert("Test ještě není otevřen."); return; }
        if (now > new Date(test.close_at)) { alert("Test je již uzavřen."); return; }
        if (completedTestIds.includes(test.id)) { alert("Tento test jste již vypracovali."); return; }

        setTestToStart(test); 
    };

    const startRandomMode = () => {
        const pool = activeQuestionsCache;
        if (!pool || pool.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        const shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        setReadyQuestionId(null); setQuestionSet(shuffled); setMode("random"); setCurrentIndex(0); setScore({ correct: 0, total: 0 }); setFinished(false); setSelectedAnswer(null); setShowResult(false); setIsKeyboardMode(false); setCombo(0);
    };
    const startMockTest = async () => {
        const pool = activeQuestionsCache;
        if (!pool || pool.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        const sel = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(40, pool.length));
        const prepared = prepareQuestionSet(sel, true);
        
        // Přednačtení obrázků
        setMode("loading"); // Dočasný stav pro preloading
        setLoadingProgress(0);
        await preloadTestImages(prepared, (progress) => {
            setLoadingProgress(progress);
        });
        
        setReadyQuestionId(null); setQuestionSet(prepared); setTimeLeft(1800); setMode("mock"); setCurrentIndex(0); setMaxSeenIndex(0); setFinished(false); setIsKeyboardMode(false); setCombo(0);
    };
    const startMistakesMode = () => {
        const all = activeQuestionsCache;
        if (!all || all.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        const userMistakes = mistakes[subject] || [];
        const filtered = all.filter((q) => userMistakes.includes(q.number));
        if (filtered.length === 0) { setMode("no_mistakes"); return; }
        const shuffled = [...filtered].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        setReadyQuestionId(null); setQuestionSet(shuffled); setMode("mistakes"); setCurrentIndex(0); setScore({ correct: 0, total: 0 }); setFinished(false); setSelectedAnswer(null); setShowResult(false); setIsKeyboardMode(false); setTrainingTime(0); setCombo(0);
    };
    const startSmartMode = (count) => {
        setShowSmartSettings(false);
        let pool = activeQuestionsCache;
        if (!pool || pool.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        let shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        if (count !== "all" && typeof count === "number") shuffled = shuffled.slice(0, count);
        setReadyQuestionId(null); setQuestionSet(shuffled); setMode("smart"); setCurrentIndex(0); setScore({ correct: 0, total: 0 }); setFinished(false); setSelectedAnswer(null); setShowResult(false); setIsKeyboardMode(false); setTrainingTime(0); setCombo(0);
    };
    const startReviewMode = () => {
        const all = activeQuestionsCache;
        if (!all || all.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        setQuestionSet(all); setMode("review"); setCombo(0); setReviewPage(0); setSearchTerm("");
    };

    const addMistake = (qNumber) => updateMistakes((prev) => { const cur = prev[subject] || []; return !cur.includes(qNumber) ? { ...prev, [subject]: [...cur, qNumber] } : prev; });
    const removeMistake = (qNumber) => updateMistakes((prev) => { const cur = prev[subject] || []; return cur.includes(qNumber) ? { ...prev, [subject]: cur.filter((n) => n !== qNumber) } : prev; });
    const clearMistakes = () => { updateMistakes((prev) => ({ ...prev, [subject]: [] })); setShowClearMistakesConfirm(false); };
    const handleSelectSubject = (subj) => { 
        if (subj === "CUSTOM") {
            setShowCustomImport(true);
            return;
        }
        setSubject(subj.toUpperCase()); 
        setMenuSelection(0);
        setMode(null);
    };
    const handleStartMode = (startFn, modeName) => { if (modeName === "smart") { setShowSmartSettings(true); return; } startFn(); };

    const handleReportClick = (questionNumber) => { setQuestionToReport(questionNumber); setReportModalOpen(true); };

    const [visualSelection, setVisualSelection] = useState(null);
    const [shuffledMapping, setShuffledMapping] = useState([]);

    useEffect(() => {
        const updateHeight = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        updateHeight();
        window.addEventListener('resize', updateHeight);
        window.addEventListener('orientationchange', updateHeight);
        return () => {
            window.removeEventListener('resize', updateHeight);
            window.removeEventListener('orientationchange', updateHeight);
        };
    }, []);

    useEffect(() => {
        window.setShuffledMappingForKeyboard = (mapping) => {
            setShuffledMapping(mapping);
            setVisualSelection(null);
        };
        return () => delete window.setShuffledMappingForKeyboard;
    }, []);

    const handleAnswer = (idx) => {
        if (finished || mode === "review") return;
        setIsKeyboardMode(true); document.body.classList.add("keyboard-mode-active");

        setQuestionSet((prev) => { const c = [...prev]; if (c[currentIndex]) c[currentIndex] = { ...c[currentIndex], userAnswer: idx }; return c; });
        if (idx !== questionSet[currentIndex].correctIndex) { triggerHaptic('error'); addMistake(questionSet[currentIndex].number); } else { triggerHaptic('success'); triggerFakeSync(); }
    };

    const clickFlashcardAnswer = (idx) => {
        if (finished || showResult) return;
        if (idx === null) return;
        const currentQ = questionSet[currentIndex];
        const isCorrect = idx === currentQ.correctIndex;
        const newSet = [...questionSet];
        if (newSet[currentIndex]) newSet[currentIndex] = { ...newSet[currentIndex], userAnswer: idx };
        setQuestionSet(newSet); setSelectedAnswer(idx); setShowResult(true); setSessionQuestionsCount(prev => prev + 1);
        setVisualSelection(null);

        if (mode === 'test_practice' && activeTest) {
            const currentStats = testPracticeStats[activeTest.id] || [];
            const newStats = [...currentStats, isCorrect].slice(-20);
            saveDataToCloud(undefined, undefined, 0, 0, { ...testPracticeStats, [activeTest.id]: newStats });
        }

        if (isCorrect) {
            triggerHaptic('success'); setScore((s) => ({ correct: s.correct + 1, total: s.total + 1 })); setCombo((c) => c + 1);
            if (mode === "mistakes") removeMistake(currentQ.number); else triggerFakeSync();
        } else {
            triggerHaptic('error'); setScore((s) => ({ ...s, total: s.total + 1 })); addMistake(currentQ.number);
            if (combo >= 3) { setShake(true); setTimeout(() => setShake(false), 500); }
            setCombo(0);
        }
    };
    const nextFlashcardQuestion = () => {
        if (mode === "random" || mode === "test_practice") {
            if (currentIndex >= questionSet.length - 1) setFinished(true);
            else { setCurrentIndex((prev) => prev + 1); setSelectedAnswer(null); setShowResult(false); }
        } else if (mode === "smart" || mode === "mistakes") {
            const currentQ = questionSet[0];
            const isCorrect = selectedAnswer === currentQ.correctIndex;
            let newSet = [...questionSet];
            if (isCorrect) newSet.shift();
            else {
                const qToMove = newSet.shift(); qToMove.userAnswer = undefined; newSet.splice(Math.min(newSet.length, 3 + Math.floor(Math.random() * 3)), 0, qToMove);
            }
            if (newSet.length === 0) { setFinished(true); addToHistory(score); }
            else { 
                setQuestionSet(newSet); setSelectedAnswer(null); setShowResult(false); 
                // Mobilní zarovnání pro smart/mistakes mode
                if (window.innerWidth <= 768) {
                    setTimeout(() => {
                        const container = document.querySelector('.container');
                        if (container) container.scrollTo({ top: 0, behavior: 'instant' });
                    }, 50);
                }
            }
        }
    };
    const confirmFlashcardAnswer = () => { if (!finished && !showResult) clickFlashcardAnswer(selectedAnswer !== null ? selectedAnswer : -1); };
    const selectRandomAnswer = (idx) => { 
        if (!finished && !showResult) { 
            triggerHaptic('light'); 
            setVisualSelection(idx); 
            setIsKeyboardMode(true); 
            document.body.classList.add("keyboard-mode-active"); 
        } 
    };
    const clearAnswer = () => { setQuestionSet((prev) => { const c = [...prev]; if (c[currentIndex]) c[currentIndex] = { ...c[currentIndex], userAnswer: undefined }; return c; }); setSelectedAnswer(null); setShowResult(false); };

    const moveToQuestion = (newIdx) => {
        const b = Math.max(0, Math.min(newIdx, questionSet.length - 1));
        if (b < currentIndex) setDirection("left"); else setDirection("right");
        
        // Reset content ready state synchronously to prevent Navigator flash
        setReadyQuestionId(null);
        setCurrentIndex(b); setSelectedAnswer(null);
    };

    const handleSwipe = (dir) => {
        if (finished || showConfirmExit || showConfirmSubmit || exitDirection || isSessionBlocked) return;
        
        const isFlashcard = isFlashcardStyle(mode) || mode === 'test_practice';
        
        const performAction = () => {
             if (dir === "left") {
                 if (isFlashcard) {
                     if (showResult) nextFlashcardQuestion();
                     else if (selectedAnswer !== null) confirmFlashcardAnswer();
                 } else if (currentIndex < questionSet.length - 1) {
                     moveToQuestion(currentIndex + 1);
                 }
             } else if (dir === "right") {
                 if (!isFlashcard && currentIndex > 0) {
                     moveToQuestion(currentIndex - 1);
                 }
             }
        };

        if (isFlashcard) {
            performAction();
        } else {
            setExitDirection(dir); 
            setTimeout(() => { 
                performAction(); 
                setExitDirection(null); 
            }, 80);
        }
    };

    const submitTest = () => {
        const qEval = questionSet; const cor = qEval.filter((q) => q.userAnswer === q.correctIndex).length; const finalScore = { correct: cor, total: qEval.length }; const answeredCount = qEval.filter(q => q.userAnswer !== undefined).length;
        setSessionQuestionsCount(prev => prev + answeredCount); setScore(finalScore); setTimeLeftAtSubmit(timeLeft); setFinished(true); setShowConfirmSubmit(false); addToHistory(finalScore);
    };
    const addToHistory = (s) => {
        if (mode !== "mock") return;
        const newRec = { date: new Date().toISOString(), mode: mode, score: s, subject: subject, id: Date.now() + "-" + Math.random(), };
        updateHistory((prev) => [...prev, newRec]);
    };
    const tryReturnToMenu = () => { 
        if (mode === "test_practice") {
            setMode("scheduled_list"); // This MUST match the state that shows ScheduledTestsList
            setCombo(0);
            setShowResult(false);
            setSelectedAnswer(null);
            setVisualSelection(null);
            setShuffledMapping([]);
            setMenuSelection(1);
            setActiveTest(null); 
            return;
        }
        if (mode === "mock" && !finished) {
            setShowConfirmExit(true); 
        } else { 
            setMode(null); 
            setCombo(0); 
            setShowResult(false);
            setSelectedAnswer(null);
            setVisualSelection(null);
            setShuffledMapping([]);
            setMenuSelection(0);
        } 
    };
    const confirmExit = () => { 
        setShowConfirmExit(false); 
        const wasPractice = mode === "test_practice";
        setMode(wasPractice ? "scheduled_list" : null); 
        setCombo(0); 
        setShowResult(false);
        setSelectedAnswer(null);
        setVisualSelection(null);
        setShuffledMapping([]);
        setMenuSelection(wasPractice ? 1 : 0);
        if (wasPractice) setActiveTest(null); 
    };
    const handleFileUpload = (questions) => {
        if (!questions) return;
        const norm = questions.map((q, i) => ({ number: q.number ?? i + 1, question: q.question ?? `Otázka ${i + 1}`, options: q.options || [], correctIndex: q.correctIndex ?? 0, }));
        setCustomQuestions(norm); setSubject("CUSTOM");
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isSessionBlocked) return;
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.repeat) return;
            if ((e.key === "Enter" || e.key === " ") && e.target.tagName === "BUTTON") return;

            if (!isKeyboardMode) { setIsKeyboardMode(true); document.body.classList.add("keyboard-mode-active"); }
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "f", "F"].includes(e.key)) e.preventDefault();
            if (showConfirmExit || showConfirmSubmit || showSmartSettings || showClearMistakesConfirm || recordToDelete || reportModalOpen || testToStart) {
                if (e.key === "Escape") {
                    setShowConfirmExit(false);
                    setShowConfirmSubmit(false);
                    setShowSmartSettings(false);
                    setShowClearMistakesConfirm(false);
                    setRecordToDelete(null);
                    setReportModalOpen(false);
                    setTestToStart(null);
                    return;
                }
                if (e.key === "Enter") {
                    if (showConfirmExit) tryReturnToMenu();
                    if (showConfirmSubmit) submitTest();
                    if (showClearMistakesConfirm) clearMistakes();
                    if (recordToDelete) handleDeleteRecordConfirm();
                    if (testToStart) confirmStartTest();
                    return;
                }
                return;
            }

            // --- UPRAVENÁ LOGIKA PRO f/F (Globální toggle) ---
            if (e.key === "f" || e.key === "F") {
                // 1. Vždy zavřít, pokud je otevřeno (globálně)
                // Otevírání řeší samotná komponenta QuestionCard, která ví, jaký obrázek má.
                if (fullscreenImage) {
                    setFullscreenImage(null);
                }
                return;
            }

            if (fullscreenImage) {
                if (e.key === "Escape" || e.key === "f" || e.key === "F" || e.key === "Enter") {
                    setFullscreenImage(null);
                }
                return;
            }
            if (finished || mode === "no_mistakes") { 
                if (["Backspace", "Enter", "ArrowLeft", "a", "A", "Escape"].includes(e.key)) {
                    setMode(null);
                    setMenuSelection(0);
                }
                return; 
            }

            if (!mode) {
                const k = e.key.toLowerCase(); 
                
                if (!subject) {
                    // Subject Selection Mode
                    const subjectCount = 3;
                    if (k === "w" || k === "arrowup") setMenuSelection((p) => (p - 1 + subjectCount) % subjectCount);
                    else if (k === "s" || k === "arrowdown") setMenuSelection((p) => (p + 1) % subjectCount);
                    else if (k === "d" || k === "arrowright" || e.key === "Enter" || e.key === " ") {
                        const subjects = ["sps", "stt", "CUSTOM"];
                        handleSelectSubject(subjects[menuSelection]);
                    }
                    return;
                }

                // Main Menu Mode
                const hasScheduled = scheduledTests.length > 0;
                const menuMapping = [];
                menuMapping.push({ id: 'mock', index: 0 });
                if (hasScheduled) menuMapping.push({ id: 'scheduled', index: 1 });
                menuMapping.push({ id: 'smart', index: 2 });
                menuMapping.push({ id: 'random', index: 3 });
                menuMapping.push({ id: 'mistakes', index: 4 });
                menuMapping.push({ id: 'review', index: 5 });
                if (isTeacher) menuMapping.push({ id: 'teacher', index: 6 });
                menuMapping.push({ id: 'history', index: 7 });

                const modeCount = 8;
                const getNextIndex = (current, dir) => { 
                    let next = current; 
                    let safety = 0;
                    do { 
                        next = (next + dir + modeCount) % modeCount; 
                        safety++;
                        const isVisible = (next === 0) || // Mock is always visible
                                        (next === 1 && hasScheduled) || 
                                        (next === 2) || // Smart always visible
                                        (next === 3) || // Random always visible
                                        (next === 4) || // Mistakes always visible
                                        (next === 5) || // Review always visible
                                        (next === 6 && isTeacher) || 
                                        (next === 7); // History always visible
                        if (isVisible) return next;
                    } while (safety < 20); 
                    return next; 
                };
                
                if (k === "w" || k === "arrowup") setMenuSelection((p) => getNextIndex(p, -1));
                else if (k === "s" || k === "arrowdown") setMenuSelection((p) => getNextIndex(p, 1));
                else if (k === "a" || k === "arrowleft") {
                    if (subject) setSubject(null);
                }
                else if (k === "d" || k === "arrowright" || e.key === "Enter") {
                    if (!subject) {
                        if (menuSelection === 0) handleSelectSubject("SPS");
                        else if (menuSelection === 1) handleSelectSubject("STT");
                        else if (menuSelection === 2) document.querySelector("input[type='file']")?.click();
                        else if (menuSelection === 3 && user === "admin") setMode('admin');
                    } else {
                        let selection = menuSelection % modeCount; if (selection < 0) selection += modeCount;
                        if (selection === 0) handleStartMode(startMockTest, "mock");
                        else if (selection === 1 && hasScheduled) setMode('scheduled_list');
                        else if (selection === 2) handleStartMode(startSmartMode, "smart");
                        else if (selection === 3) handleStartMode(startRandomMode, "random");
                        else if (selection === 4) handleStartMode(startReviewMode, "review");
                        else if (selection === 5) { if(isTeacher) setMode('teacher_manager'); }
                        else if (selection === 6) handleStartMode(startMistakesMode, "mistakes");
                        else if (selection === 7) openHistoryWithRefresh();
                    }
                } else if (k === "a" || k === "arrowleft" || k === "backspace") { if (subject) setSubject(null); }
                return;
            }
            if (!mode || mode === 'real_test') return;
            const opts = questionSet[currentIndex]?.options?.length || 4;
            const isFlashcardInput = isFlashcardStyle(mode) || mode === 'test_practice';
            const k = e.key.toLowerCase();

            if (k === "w" || e.key === "ArrowUp") {
                if (isFlashcardInput && !showResult) {
                    const nextVisual = visualSelection === null ? opts - 1 : (visualSelection - 1 + opts) % opts;
                    selectRandomAnswer(nextVisual);
                }
                else if (!isFlashcardInput) handleAnswer(questionSet[currentIndex].userAnswer === undefined ? opts - 1 : (questionSet[currentIndex].userAnswer - 1 + opts) % opts);
            }
            if (k === "s" || e.key === "ArrowDown") {
                if (isFlashcardInput && !showResult) {
                    const nextVisual = visualSelection === null ? 0 : (visualSelection + 1) % opts;
                    selectRandomAnswer(nextVisual);
                }
                else if (!isFlashcardInput) handleAnswer(questionSet[currentIndex].userAnswer === undefined ? 0 : (questionSet[currentIndex].userAnswer + 1) % opts);
            }
            if (k === "a" || e.key === "ArrowLeft") { 
                if (isFlashcardInput) return; 
                if (mode === 'history') { setMode(null); return; }
                moveToQuestion(currentIndex - 1); 
            }
            if (k === "d" || e.key === "ArrowRight" || e.key === "Enter") {
                if (mode === 'history') return; 
                if (isFlashcardInput) { 
                    if (showResult) nextFlashcardQuestion(); 
                    else {
                        const finalIdx = visualSelection !== null ? (shuffledMapping[visualSelection] ?? selectedAnswer) : selectedAnswer;
                        clickFlashcardAnswer(finalIdx);
                    }
                } else moveToQuestion(currentIndex + 1);
            }
            if (e.key === " ") {
                if (mode === 'history') return;
                if (isFlashcardInput && !showResult) {
                    const finalIdx = visualSelection !== null ? (shuffledMapping[visualSelection] ?? selectedAnswer) : selectedAnswer;
                    clickFlashcardAnswer(finalIdx);
                }
                else if (!finished && mode === "mock") setShowConfirmSubmit(true); 
            }
            if (e.key === "Backspace") {
                if (mode === 'history') { setMode(null); return; }
                clearAnswer();
            }
            if (e.key === "Escape") {
                if (mode === 'history') { setMode(null); return; }
                tryReturnToMenu();
            }
        };
        window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown);
    }, [mode, questionSet, currentIndex, showResult, selectedAnswer, showConfirmSubmit, showConfirmExit, finished, menuSelection, subject, user, fullscreenImage, reportModalOpen, isSessionBlocked, testToStart, visualSelection, shuffledMapping]);

    useEffect(() => {
        if (finished || (mode !== "mock" && mode !== "smart" && mode !== "mistakes")) return;
        const interval = setInterval(() => {
            if (mode === "mock") setTimeLeft((p) => Math.max(0, p - 1));
            else setTrainingTime((t) => t + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [mode, finished]);
    useEffect(() => { if ((mode === "mock") && timeLeft === 0 && !finished) submitTest(); }, [timeLeft, mode, finished]);

    const [showCustomImport, setShowCustomImport] = useState(false);

    useEffect(() => {
        window.handleCustomImport = (questions) => {
            handleFileUpload(questions);
            setShowCustomImport(false);
        };
        return () => delete window.handleCustomImport;
    }, [activeQuestionsCache]);

    if (showCustomImport) {
        return <CustomImportGuide onBack={() => setShowCustomImport(false)} />;
    }

    if (!user) return (
        <>
            <div style={{ position: "absolute", top: "1rem", right: "1rem", zIndex: 100 }}>
                <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
            </div>
            <CloudLoginScreen onLogin={login} loading={loading} />
        </>
    );

    if (isSessionBlocked) return <SessionBlockedScreen onTakeOver={takeOverSession} />;

    if (mode === 'teacher_manager') {
        if (!isTeacher) { setMode(null); return null; }
        return <TestManager onBack={() => setMode(null)} subject={subject} isTeacher={isTeacher} />;
    }

    if (mode === 'scheduled_list') {
        return (
            <>
                <ScheduledTestsList 
                    scheduledTests={scheduledTests} onBack={() => setMode(null)} subject={subject} user={user} syncing={syncing} theme={theme} toggleTheme={toggleTheme}
                    onStartGradedTest={startGradedTest} onStartPractice={startTestPractice} completedTestIds={completedTestIds} testPracticeStats={testPracticeStats} onRefresh={handleManualRefresh}
                />
                {testToStart && (
                    <ConfirmModal 
                        title={`Spustit test "${testToStart.title}"?`}
                        message={
                            <div style={{ textAlign: 'left' }}>
                                <p style={{ marginBottom: '1rem' }}>Chystáte se spustit ostrý test.</p>
                                <ul style={{ paddingLeft: '1.2rem', color: 'var(--color-text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                    <li>Do testu lze vstoupit <strong>pouze jednou</strong>.</li>
                                    <li>Jakmile test spustíte, začne běžet časový limit ({testToStart.time_limit} min).</li>
                                    <li>Test nelze přerušit ani se k němu vrátit později.</li>
                                    <li>Ujistěte se, že máte stabilní připojení k internetu.</li>
                                </ul>
                            </div>
                        }
                        onCancel={() => setTestToStart(null)} onConfirm={confirmStartTest} confirmText="Spustit test" danger={false}
                    />
                )}
            </>
        );
    }

    if (mode === 'real_test') {
        return (
            <RealTestMode
                test={activeTest} initialQuestions={questionSet} user={user} userId={dbId}
                onExit={() => setMode(null)} onFinish={() => setMode(null)}
                theme={theme} toggleTheme={toggleTheme} syncing={syncing} onReport={handleReportClick} onTestCompleted={handleTestCompletion}
            />
        );
    }

    if (!mode) {
        if (!subject) return (
            <div className="container fadeIn" style={{ minHeight: "var(--vh)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: 'space-between', paddingBottom: "1.5rem" }}>
                {!isLoadingQuestions && (
                    <div className="top-navbar" style={{ width: "100%" }}>
                        <div className="navbar-group">
                            {user === 'admin' && <button className="menuBackButton" onClick={() => setMode('admin')} title="Admin Panel">🛠️ Admin</button>}
                            <SubjectBadge subject={subject} compact />
                        </div>
                        <div className="navbar-group"><UserBadgeDisplay user={user} syncing={syncing} onLogout={handleLogout} alwaysShowFullName={true} /><ThemeToggle currentTheme={theme} toggle={toggleTheme} /></div>
                    </div>
                )}
                {isLoadingQuestions ? (
                    <div style={{ margin: "2rem", fontSize: "1.2rem", color: "#888", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>Načítám otázky z databáze...
                    </div>
                ) : (
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', maxWidth: '800px' }}>
                        <SubjectSelector menuSelection={menuSelection} onSelectSubject={handleSelectSubject} onUploadFile={handleFileUpload} isKeyboardMode={isKeyboardMode} setIsKeyboardMode={setIsKeyboardMode} />
                    </div>
                )}
                <div style={{ height: '1px' }}></div>
            </div>
        );

        const mistakesCount = mistakes[subject]?.length || 0;
        return (
            <>
                <ReportModal 
                    isOpen={reportModalOpen} onClose={() => { setReportModalOpen(false); setQuestionToReport(null); }} theme={theme}
                    {...(() => {
                        let activeReportQuestion = currentQuestion; 
                        if (questionToReport) { const found = questionSet.find(q => q.number === questionToReport); if (found) activeReportQuestion = found; }
                        const qForModal = activeReportQuestion || {};
                        return { questionText: qForModal.question, questionId: qForModal.id, subject: qForModal.subject, questionNumber: qForModal.number, options: qForModal.options, correctIndex: qForModal.correctIndex, userAnswer: qForModal.userAnswer, };
                    })()}
                    mode={mode} username={user} userId={dbId} isExiting={!!exitDirection}
                />
                {showSmartSettings && <SmartSettingsModal onStart={startSmartMode} onCancel={() => setShowSmartSettings(false)} totalQuestions={activeQuestionsCache.length} />}
                {showClearMistakesConfirm && <ConfirmModal title="Vynulovat opravnu?" message="Smazat chyby z cloudu?" onCancel={() => setShowClearMistakesConfirm(false)} onConfirm={clearMistakes} confirmText="Smazat" danger={true} />}

                <div ref={containerRef} className="container fadeIn" style={{ minHeight: "var(--vh)", display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center" }}>
                    {!isLoadingQuestions && (
                        <div className="top-navbar" style={{ width: "100%" }}>
                            <div className="navbar-group">
                                <div className="navbar-group">
                                    <button className="menuBackButton" onClick={() => { flushSessionStats(); clearImageCache(); setSubject(null); }}>← <span className="mobile-hide-text">Změnit předmět</span></button>
                                    <SubjectBadge subject={subject} compact />
                                </div>
                            </div>
                            <div className="navbar-group"><UserBadgeDisplay user={user} syncing={syncing} onLogout={handleLogout} /><ThemeToggle currentTheme={theme} toggle={toggleTheme} /></div>
                        </div>
                    )}
                    {isLoadingQuestions || mode === "loading" ? (
                        <div style={{ margin: "2rem", fontSize: "1.2rem", color: "#888", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>Načítám otázky a obrázky...
                        </div>
                    ) : (
                        <MainMenu
                            scheduledTests={scheduledTests} completedTestIds={completedTestIds} menuSelection={menuSelection} isKeyboardMode={isKeyboardMode} isTeacher={isTeacher} mistakesCount={mistakesCount}
                            onOpenScheduled={() => setMode('scheduled_list')} onStartMock={() => handleStartMode(startMockTest, "mock")} onStartSmart={() => handleStartMode(startSmartMode, "smart")}
                            onStartRandom={() => handleStartMode(startRandomMode, "random")} onStartReview={() => handleStartMode(startReviewMode, "review")} onOpenTeacherManager={() => setMode('teacher_manager')}
                            onStartMistakes={() => handleStartMode(startMistakesMode, "mistakes")} onClearMistakes={() => setShowClearMistakesConfirm(true)} onOpenHistory={openHistoryWithRefresh}
                        />
                    )}
                </div>
            </>
        );
    }

    if (mode === "admin") return <AdminPanel onBack={() => setMode(null)} />;
    if (mode === "no_mistakes") return <NoMistakesScreen onBack={() => setMode(null)} subject={subject} />;

    if (mode === "history") return (
        <>
            <HistoryView
                history={history} totalTimeMap={totalTimeMap} sessionTime={sessionTime} totalQuestionsMap={totalQuestionsMap} sessionQuestionsCount={sessionQuestionsCount}
                onBack={() => setMode(null)} currentSubject={subject} onDeleteRecord={setRecordToDelete} user={user} syncing={syncing}
            />
            {recordToDelete && <ConfirmModal title="Smazat záznam?" message="Smazat tento záznam?" onCancel={() => setRecordToDelete(null)} onConfirm={() => { updateHistory((prev) => prev.filter((h) => h.id !== recordToDelete)); setRecordToDelete(null); }} confirmText="Smazat" danger={true} />}
        </>
    );

    if (mode === "review") {
        const REVIEW_COLUMNS = window.innerWidth > 768 ? 2 : 1;
        const REVIEW_ROWS = 5;
        const REVIEW_ITEMS_PER_PAGE = REVIEW_COLUMNS * REVIEW_ROWS;
        const normalizedSearch = removeAccents(searchTerm);
        const filteredQuestions = questionSet.filter((q) => removeAccents(q.question).includes(normalizedSearch) || String(q.number).includes(normalizedSearch));
        const highlightRegex = getSmartRegex(searchTerm);
        const totalReviewPages = Math.ceil(filteredQuestions.length / REVIEW_ITEMS_PER_PAGE);
        const paginatedQuestions = filteredQuestions.slice(reviewPage * REVIEW_ITEMS_PER_PAGE, (reviewPage + 1) * REVIEW_ITEMS_PER_PAGE);

        const scrollToTop = () => {
            if (containerRef.current) {
                containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        return (
            <>
                <CustomImageModal src={fullscreenImage} onClose={() => setFullscreenImage(null)} />
                {(() => {
                    let activeReportQuestion = currentQuestion; 
                    if (questionToReport) { const found = activeQuestionsCache.find(q => q.number === questionToReport); if (found) activeReportQuestion = found; }
                    const qForModal = activeReportQuestion || {};
                    return (
                        <ReportModal 
                            isOpen={reportModalOpen} onClose={() => { setReportModalOpen(false); setQuestionToReport(null); }} theme={theme}
                            questionText={qForModal.question} questionId={qForModal.id} subject={qForModal.subject || subject} questionNumber={qForModal.number}
                            mode={mode} options={qForModal.options} correctIndex={qForModal.correctIndex} userAnswer={qForModal.userAnswer} username={user} userId={dbId} isExiting={!!exitDirection}
                        />
                    );
                })()}
                <div className="container fadeIn" style={{ minHeight: "var(--vh)" }}>
                    <div className="top-navbar" style={{ width: "100%" }}>
                        <div className="navbar-group">
                            <button className="menuBackButton" onClick={() => { flushSessionStats(); tryReturnToMenu(); }}>← <span className="mobile-hide-text">Zpět</span></button>
                            <SubjectBadge subject={subject} compact />
                        </div>
                        <div className="navbar-group"><UserBadgeDisplay user={user} syncing={syncing} /><ThemeToggle currentTheme={theme} toggle={toggleTheme} /></div>
                    </div>
                    <h1 className="title">Prohlížení otázek</h1>
                    <div className="reviewControls">
                        <input type="text" placeholder="Hledat..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setReviewPage(0); }} className="reviewSearchInput" />
                        {totalReviewPages > 1 && (
                            <div className="reviewPageInfo">
                                Strana {reviewPage + 1} z {totalReviewPages} ({filteredQuestions.length} otázek)
                            </div>
                        )}
                    </div>
                    <div className="reviewGrid">
                        {paginatedQuestions.length === 0 ? (
                            <p style={{ textAlign: "center", color: "#888", gridColumn: "1/-1" }}>Nic nenalezeno.</p>
                        ) : (
                            paginatedQuestions.map((q) => {
                                const imageUrl = q.image_base64 || (q.id ? getCachedImage(q.id) : null) || getImageUrl(subject, q.number) || (q.image && q.image.length > 5 ? q.image : null);
                                return (
                                    <div key={`${q.number}-${reviewPage}`} className="reviewCard">
                                        <div className="reviewHeader" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', position: 'relative' }}>
                                            <div style={{ flex: 1 }}>
                                                <strong>#{q.number}.</strong> <HighlightedText text={q.question} highlightRegex={highlightRegex} />
                                            </div>
                                            <button 
                                                className="report-btn-flash" 
                                                onClick={() => handleReportClick(q.number)}
                                                style={{ 
                                                    background: 'transparent', 
                                                    border: 'none', 
                                                    padding: '4px', 
                                                    width: '32px', 
                                                    height: '32px', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    cursor: 'pointer', 
                                                    fontSize: '1.1rem', 
                                                    flexShrink: 0,
                                                    opacity: 0.7,
                                                    marginTop: '-2px'
                                                }}
                                                title="Nahlásit chybu v této otázce"
                                            >
                                                🏳️
                                            </button>
                                        </div>
                                        <ReviewImage q={q} subject={subject} setFullscreenImage={setFullscreenImage} />
                                        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                            {q.options.map((opt, idx) => (
                                                <div key={idx} style={{ fontSize: "0.9rem", color: idx === q.correctIndex ? "var(--color-review-correct)" : "var(--color-text-secondary)", fontWeight: idx === q.correctIndex ? "bold" : "normal" }}>
                                                    <span>{idx === q.correctIndex ? "✅" : "•"}</span> <span><HighlightedText text={opt} highlightRegex={highlightRegex} /></span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    {totalReviewPages > 1 && (
                        <div className="reviewPagination">
                            <button className="reviewPaginationBtn" onClick={() => { setReviewPage(0); scrollToTop(); }} disabled={reviewPage === 0}>⏮</button>
                            <button className="reviewPaginationBtn" onClick={() => { setReviewPage(p => p - 1); scrollToTop(); }} disabled={reviewPage === 0}>← Předchozí</button>
                            <span className="reviewPaginationCurrent">{reviewPage + 1} / {totalReviewPages}</span>
                            <button className="reviewPaginationBtn" onClick={() => { setReviewPage(p => p + 1); scrollToTop(); }} disabled={reviewPage === totalReviewPages - 1}>Další →</button>
                            <button className="reviewPaginationBtn" onClick={() => { setReviewPage(totalReviewPages - 1); scrollToTop(); }} disabled={reviewPage === totalReviewPages - 1}>⏭</button>
                        </div>
                    )}
                </div>
            </>
        );
    }

    let comboClass = combo >= 10 ? "combo-high" : combo >= 5 ? "combo-med" : combo >= 3 ? "combo-low" : "";
    let remainingCards = 0;
    if (mode === "smart" || mode === "mistakes") remainingCards = questionSet.length;
    else if (mode === "random" || mode === "test_practice") remainingCards = questionSet.length - currentIndex;

    // --- OPRAVA: Posun indexu pro stacked cards ---
    // Pokud zbývá 1 karta (ta aktuální), neměly by být vidět žádné karty vzadu (stack-level-0).
    // Pokud zbývají 2 karty (aktuální + 1 vzadu), měla by být vidět 1 karta vzadu (stack-level-1).
    let stackLevelClass = "";
    if (remainingCards <= 1) stackLevelClass = "stack-level-0";
    else if (remainingCards === 2) stackLevelClass = "stack-level-1";

    return (
        <>
            <CustomImageModal src={fullscreenImage} onClose={() => setFullscreenImage(null)} />
            {(() => {
                let activeReportQuestion = currentQuestion; 
                if (questionToReport) { const found = activeQuestionsCache.find(q => q.number === questionToReport); if (found) activeReportQuestion = found; }
                const qForModal = activeReportQuestion || {};
                return (
                    <ReportModal 
                        isOpen={reportModalOpen} onClose={() => { setReportModalOpen(false); setQuestionToReport(null); }} theme={theme}
                        questionText={qForModal.question} questionId={qForModal.id} subject={qForModal.subject || subject} questionNumber={qForModal.number}
                        mode={mode} options={qForModal.options} correctIndex={qForModal.correctIndex} userAnswer={qForModal.userAnswer} username={user} userId={dbId} isExiting={!!exitDirection}
                    />
                );
            })()}

            <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
                {showConfirmSubmit && <ConfirmModal title={mode==='real_test'?"Odevzdat test?":"Odevzdat?"} message={mode==='real_test'?"Po odevzdání už nepůjde odpovědi změnit.":"Opravdu odevzdat?"} onCancel={() => setShowConfirmSubmit(false)} onConfirm={mode==='real_test'?()=>{}:submitTest} confirmText={mode==='real_test'?"ODEVZDAT":"Ano"} danger={mode==='real_test'} />}
                {showConfirmExit && <ConfirmModal title="Ukončit?" message="Ztracené odpovědi nebudou uloženy." onCancel={() => setShowConfirmExit(false)} onConfirm={confirmExit} confirmText="Ukončit" />}

                {finished && (
                    <ResultScreen
                        mode={mode} score={score} trainingTime={trainingTime} questionSet={questionSet} maxSeenIndex={maxSeenIndex} onBack={() => { setMode(null); setCombo(0); }} currentSubject={subject} timeLeftAtSubmit={timeLeftAtSubmit} onZoom={setFullscreenImage} user={user} syncing={syncing} onReport={handleReportClick}
                    />
                )}

                {mode === "loading" && (
                    <div className="loadingScreen">
                        <div className="loadingCard">
                            <div className="loadingSpinner"></div>
                            <h2>Příprava testu...</h2>
                            <p>Načítám obrázky a otázky pro plynulý průběh.</p>
                            <div className="loadingProgressBarContainer">
                                <div className="loadingProgressBarFill" style={{ width: `${loadingProgress}%` }}></div>
                            </div>
                            <span className="loadingProgressText">{Math.round(loadingProgress)}%</span>
                        </div>
                    </div>
                )}
                {!finished && mode !== "loading" && (
                    <>
                        <div className="top-navbar" style={{ width: "100%" }}>
                            <div className="navbar-group">
                                {mode === 'real_test' ? <span style={{fontWeight:'bold', color:'var(--color-error)'}}>⚠️ TEST: NEOPOUŠTĚJ OKNO!</span> : <button className="menuBackButton" onClick={tryReturnToMenu}>← <span className="mobile-hide-text">Zpět</span></button>}
                                <div className="mobile-hidden"><SubjectBadge subject={subject} compact /></div>
                            </div>
                            <div className="navbar-group">
                                {(mode === "mock") && <div className={`timer ${timeLeft <= 300 ? "timerWarning" : ""} ${timeLeft <= 60 ? "timerDanger" : ""}`}>{formatTime(timeLeft)}</div>}
                                {(mode === "training" || mode === "smart" || mode === "mistakes") && <div className="timer">{formatTime(trainingTime)}</div>}
                                <UserBadgeDisplay user={user} syncing={syncing} compactOnMobile={true} />
                                <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                            </div>
                        </div>
                        <div className="quizContentWrapper">
                            <h1 className="title">
                                {mode === "real_test" ? activeTest?.title : (mode === "random" ? "Flashcards" : mode === "mock" ? "Test nanečisto" : mode === "mistakes" ? "Opravna chyb" : (mode === "smart" || mode === "test_practice") ? "Procvičování" : "Tréninkový režim")}
                            </h1>

                            {isFlashcardStyle(mode) || mode === 'test_practice' ? (
                                <div className={`flashcardHeader ${comboClass}`}>
                                    {mode !== 'test_practice' && (
                                        <div className="statItem">
                                            <span className="statLabel">{mode === "random" ? "Zodpovězeno" : "Zbývá"}</span>
                                            <span className="statValue">{mode === "random" ? currentIndex : remainingCards}</span>
                                        </div>
                                    )}
                                    {combo >= 3 && <div className="comboContainer"><div className="comboFlame">🔥</div><div className="comboCount">{combo}x</div></div>}
                                    <div className="statItem" style={{ textAlign: 'right', marginLeft: 'auto' }}>
                                        <span className="statLabel">Úspěšnost</span>
                                        <span className="statValue">
                                            {mode === 'test_practice' && activeTest ? (() => {
                                                const stats = testPracticeStats[activeTest.id] || [];
                                                if (stats.length === 0) return "0%";
                                                return Math.round((stats.filter(Boolean).length / stats.length) * 100) + "%";
                                            })() : (score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0) + "%"}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="progressBarContainer"><div className="progressBarFill" style={{ width: `${((currentIndex + 1) / questionSet.length) * 100}%` }}></div></div>
                                    <div className="progressText">Otázka {currentIndex + 1} / {questionSet.length}</div>
                                </>
                            )}

                            <div className={`card ${isFlashcardStyle(mode) || mode==='test_practice' ? `stacked-card ${stackLevelClass}` : ""} ${shake ? "shake" : ""}`} ref={cardRef} style={{ minHeight: '200px' }}>
                                <div key={currentQuestion.id || currentQuestion.number || currentIndex} className={exitDirection ? (exitDirection === 'left' ? "card-exit-left" : "card-exit-right") : ((isFlashcardStyle(mode) || mode==='test_practice') ? "" : (direction === "left" ? "slide-in-left" : "slide-in-right"))} style={{width: '100%'}}>
                                    <QuestionCard
                                        currentQuestion={currentQuestion} mode={mode} showResult={showResult} selectedAnswer={selectedAnswer} visualSelection={visualSelection}
                                        onSelect={(i) => (isFlashcardStyle(mode) || mode==='test_practice') ? clickFlashcardAnswer(i) : handleAnswer(i)}
                                        optionRefsForCurrent={optionRefsForCurrent} disabled={(isFlashcardStyle(mode) || mode==='test_practice') && showResult}
                                        isKeyboardMode={isKeyboardMode} currentSubject={subject} onZoom={setFullscreenImage} onSwipe={handleSwipe} score={score} onReport={handleReportClick} isExiting={!!exitDirection}
                                        onContentReady={setReadyQuestionId}
                                    />
                                </div>
                                {(isFlashcardStyle(mode) || mode==='test_practice') && !showResult && (
                                    <div className="actionButtons right card-enter-animation" key={`btn-confirm-${currentIndex}`}>
                                        <button className="navButton primary" onClick={confirmFlashcardAnswer}>Potvrdit</button>
                                    </div>
                                )}
                                {(isFlashcardStyle(mode) || mode==='test_practice') && showResult && (
                                    <div className="actionButtons right card-enter-animation" key={`btn-next-${currentIndex}`}>
                                        <button className="navButton" onClick={nextFlashcardQuestion}>Další otázka</button>
                                    </div>
                                )}
                                {!(isFlashcardStyle(mode) || mode==='test_practice') && (
                                    <div style={{ opacity: isContentReady ? 1 : 0, transition: 'opacity 0.1s ease-in' }}>
                                        <div className="actionButtons spaced">
                                            <button className="navButton" onClick={() => moveToQuestion(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>Předchozí</button>
                                            <button className="navButton" onClick={() => moveToQuestion(currentIndex + 1)} disabled={currentIndex >= questionSet.length - 1}>Další</button>
                                        </div>
                                        <div className="navigatorPlaceholder">
                                            <Navigator questionSet={questionSet} currentIndex={currentIndex} setCurrentIndex={moveToQuestion} mode={mode} maxSeenIndex={mode === 'real_test' ? questionSet.length : maxSeenIndex} />
                                            {(mode === "mock") && (
                                                <div style={{ marginTop: "2rem", width: "100%", display: "flex", justifyContent: "center" }}>
                                                    <button className="navButton primary" style={{ padding: "10px 30px", fontSize: "0.95rem", minWidth: "150px" }} onClick={() => setShowConfirmSubmit(true)}>Odevzdat test</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
                <HiddenPreloader questionSet={questionSet} currentIndex={currentIndex} subject={subject} mode={mode} />
                <div className="footer"></div>
            </div>
        </>
    );
}