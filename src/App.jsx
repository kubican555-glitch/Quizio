import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import { SubjectSelector } from "./components/SubjectSelector.jsx";
import { AdminPanel } from "./components/AdminPanel.jsx";
import { TestManager } from "./components/TestManager.jsx"; 

// --- IMPORTY POMOCNÝCH KOMPONENT ---
import { SessionBlockedScreen } from "./components/SessionBlockedScreen.jsx";
import { CloudLoginScreen } from "./components/CloudLoginScreen.jsx";
import { CustomImageModal } from "./components/CustomImageModal.jsx";
import { HighlightedText } from "./components/HighlightedText.jsx";
import { MainMenu } from "./components/MainMenu.jsx";
import { ScheduledTestsList } from "./components/ScheduledTestsList.jsx";
import { RealTestMode } from "./components/RealTestMode.jsx";

// --- IMPORTY Z UTILS ---
import { 
    formatTime, 
    removeAccents, 
    getSmartRegex, 
    isFlashcardStyle 
} from "./utils/formatting.js";
import { getImageUrl } from "./utils/images.js";
import { fetchQuestionsLightweight, clearImageCache } from "./utils/dataManager.js"; 

// --- IMPORTY OSTATNÍCH KOMPONENT ---
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

/* ---------- Main App ---------- */

export default function App() {
    // --- STATE ---
    const [user, setUser] = useState(null);
    const [dbId, setDbId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // SESSION MANAGEMENT STATE
    const [isSessionBlocked, setIsSessionBlocked] = useState(false);
    const [mySessionId, setMySessionId] = useState(null);

    const [subject, setSubject] = useState(null);
    const [customQuestions, setCustomQuestions] = useState(null);
    const [mistakes, setMistakes] = useState({});
    const [history, setHistory] = useState([]);

    // Statistiky procvičování testů { "test_id": [true, false, true, ...] }
    const [testPracticeStats, setTestPracticeStats] = useState({});

    const [theme, setTheme] = useState(
        () => localStorage.getItem("quizio_theme") || "dark",
    );

    const [activeQuestionsCache, setActiveQuestionsCache] = useState([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [menuSelection, setMenuSelection] = useState(0);
    const [mode, setMode] = useState(null);

    const [showSmartSettings, setShowSmartSettings] = useState(false);
    const [showClearMistakesConfirm, setShowClearMistakesConfirm] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
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
    const [isKeyboardMode, setIsKeyboardMode] = useState(false);

    const [direction, setDirection] = useState("right");
    const [exitDirection, setExitDirection] = useState(null);

    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [questionToReport, setQuestionToReport] = useState(null);

    const [scheduledTests, setScheduledTests] = useState([]);
    const [activeTest, setActiveTest] = useState(null);

    const [completedTestIds, setCompletedTestIds] = useState([]);

    // State pro modal před spuštěním testu
    const [testToStart, setTestToStart] = useState(null);

    const optionRefsForCurrent = useRef({});
    const cardRef = useRef(null);
    const containerRef = useRef(null);

    const [totalTimeMap, setTotalTimeMap] = useState({});
    const [sessionTime, setSessionTime] = useState(0);
    const [isAfk, setIsAfk] = useState(false);
    const lastActivityRef = useRef(Date.now());
    const [totalQuestionsMap, setTotalQuestionsMap] = useState({});
    const [sessionQuestionsCount, setSessionQuestionsCount] = useState(0);

    const currentQuestion = questionSet[currentIndex] || { question: "", options: [], correctIndex: 0, number: 0, _localIndex: currentIndex };

    const isTeacher = user === 'admin' || user === 'Ucitel';

    // --- SESSION MANAGEMENT LOGIC ---
    const mySessionIdRef = useRef(null);

    const takeOverSession = async () => {
        if (!dbId) return;
        const newSessionId = crypto.randomUUID();
        setMySessionId(newSessionId);
        mySessionIdRef.current = newSessionId;
        setIsSessionBlocked(false);
        await supabase.from("profiles").update({ active_session_id: newSessionId }).eq("id", dbId);
    };

    useEffect(() => {
        if (!user || !dbId) return;
        const initSession = async () => {
            const newSessionId = crypto.randomUUID();
            setMySessionId(newSessionId);
            mySessionIdRef.current = newSessionId;
            await supabase.from("profiles").update({ active_session_id: newSessionId }).eq("id", dbId);
        };
        initSession();

        const channel = supabase.channel(`session_guard_${dbId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${dbId}` }, (payload) => {
                const remoteSessionId = payload.new.active_session_id;
                if (remoteSessionId && mySessionIdRef.current && remoteSessionId !== mySessionIdRef.current) {
                    setIsSessionBlocked(true);
                }
            }).subscribe();

        const intervalId = setInterval(async () => {
            if (mySessionIdRef.current) { 
                const { data, error } = await supabase.from("profiles").select("active_session_id").eq("id", dbId).single();
                if (!error && data && data.active_session_id) {
                    if (data.active_session_id !== mySessionIdRef.current) setIsSessionBlocked(true);
                }
            }
        }, 5000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(intervalId);
        };
    }, [user, dbId]); 

    // --- FETCH FUNCTIONS ---
    const fetchScheduledTests = async () => {
        if (!subject || subject === 'CUSTOM') return;
        setSyncing(true);
        const { data } = await supabase.from('scheduled_tests').select('*').eq('subject', subject).order('close_at', { ascending: true });
        if (data) setScheduledTests(data);
        setTimeout(() => setSyncing(false), 500);
    };

    const fetchCompletedTests = async () => {
        if (!user || !dbId) {
            setCompletedTestIds([]);
            return;
        }

        const { data, error } = await supabase
            .from('test_results')
            .select('test_id')
            .eq('user_id', dbId);

        if (data) {
            const ids = [...new Set(data.map(item => item.test_id))];
            setCompletedTestIds(ids);
        }
    };

    // --- REALTIME TEST FETCHING ---
    useEffect(() => {
        if (!subject || subject === 'CUSTOM') return;

        fetchScheduledTests();
        const subscription = supabase.channel('tests_update').on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_tests' }, fetchScheduledTests).subscribe();

        return () => supabase.removeChannel(subscription);
    }, [subject]);

    // --- FETCH COMPLETED TESTS (S OPRAVOU PRO DELETE) ---
    useEffect(() => {
        if (!user || !dbId) {
            setCompletedTestIds([]);
            return;
        }

        fetchCompletedTests();

        const sub = supabase.channel('my_results_update')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'test_results', filter: `user_id=eq.${dbId}` }, 
            (payload) => {
                setCompletedTestIds(prev => [...prev, payload.new.test_id]);
            })
            // Poslouchání DELETE pro aktualizaci, když učitel smaže pokus
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'test_results' }, 
            () => {
                fetchCompletedTests();
            })
            .subscribe();

        return () => supabase.removeChannel(sub);
    }, [user, dbId]);

    // --- MANUAL REFRESH HANDLER ---
    const handleManualRefresh = async () => {
        setSyncing(true);
        await Promise.all([
            fetchScheduledTests(),
            fetchCompletedTests()
        ]);
        setTimeout(() => setSyncing(false), 500);
    };

    const handleTestCompletion = (testId) => {
        setCompletedTestIds(prev => {
            if (prev.includes(testId)) return prev;
            return [...prev, testId];
        });
    };

    const triggerHaptic = (type) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
             if (type === 'success') navigator.vibrate(50);
             else if (type === 'error') navigator.vibrate([50, 100, 50]);
             else if (type === 'light') navigator.vibrate(10);
        }
    };

    useEffect(() => {
        if (containerRef.current) containerRef.current.scrollTop = 0;
    }, [subject, mode]);

    // ... (Keyboard Mode Effect) ...
    useEffect(() => {
        let lastClientX = -1;
        let lastClientY = -1;
        const handleMouseMove = (e) => {
            if (e.clientX === lastClientX && e.clientY === lastClientY) return;
            lastClientX = e.clientX; lastClientY = e.clientY;
            if (document.body.classList.contains("keyboard-mode-active")) {
                setIsKeyboardMode(false); document.body.classList.remove("keyboard-mode-active");
            }
        };
        const handleKeyDownInteraction = (e) => {
            if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
            if (!document.body.classList.contains("keyboard-mode-active")) {
                setIsKeyboardMode(true); document.body.classList.add("keyboard-mode-active");
            }
        };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("keydown", handleKeyDownInteraction);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("keydown", handleKeyDownInteraction);
            document.body.classList.remove("keyboard-mode-active");
        };
    }, []);

    // === CLOUD AUTH & DATA ===
    const handleAdminClick = () => {
        const password = prompt("Zadejte heslo administrátora:");
        if (password === "admin123") alert("Vítejte v administraci! (Zatím prázdná)");
        else if (password !== null) alert("Chybné heslo.");
    };

    const handleCloudLogin = async (enteredCode) => {
        setLoading(true);
        try {
            const { data: codeData, error: codeError } = await supabase.from("access_codes").select("*").eq("code", enteredCode).maybeSingle();
            if (codeError || !codeData) { alert("Neplatný kód."); setLoading(false); return; }

            const identifiedUser = codeData.used_by || enteredCode;
            let { data: profileData } = await supabase.from("profiles").select("*").eq("username", identifiedUser).single();

            if (profileData) {
                setDbId(profileData.id); 
                setMistakes(profileData.mistakes || {}); 
                setHistory(profileData.history || []); 
                setTotalTimeMap(profileData.subject_times || {}); 
                setTotalQuestionsMap(profileData.question_counts || {}); 
                setTestPracticeStats(profileData.test_practice_stats || {}); 
                setUser(identifiedUser);
            } else {
                const { data: newData } = await supabase.from("profiles").insert([{ username: identifiedUser, mistakes: {}, history: [], subject_times: {}, question_counts: {}, test_practice_stats: {} }]).select().single();
                setDbId(newData.id); 
                setMistakes({}); 
                setHistory([]); 
                setTotalTimeMap({}); 
                setTotalQuestionsMap({}); 
                setTestPracticeStats({});
                setUser(identifiedUser);
            }
            localStorage.setItem("quizio_user_code", enteredCode);
        } catch (err) { alert("Chyba přihlášení: " + err.message); } finally { setLoading(false); }
    };

    useEffect(() => {
        const savedCode = localStorage.getItem("quizio_user_code");
        if (savedCode && !user && !loading) handleCloudLogin(savedCode);
    }, []);

    const saveDataToCloud = async (newMistakes, newHistory, timeToAdd = 0, questionsToAdd = 0, newTestStats = null) => {
        if (!dbId) return;
        setSyncing(true);

        const updates = {};

        if (newMistakes !== undefined) updates.mistakes = newMistakes;
        if (newHistory !== undefined) updates.history = newHistory;

        if (timeToAdd > 0 && subject) {
            const currentSubjectTime = totalTimeMap[subject] || 0;
            const newSubjectTime = currentSubjectTime + timeToAdd;
            const newTimeMap = { ...totalTimeMap, [subject]: newSubjectTime };
            updates.subject_times = newTimeMap; 
            setTotalTimeMap(newTimeMap); 
            setSessionTime(0); 
        }

        if (questionsToAdd > 0 && subject) {
            const currentCount = totalQuestionsMap[subject] || 0;
            const newCount = currentCount + questionsToAdd;
            const newQMap = { ...totalQuestionsMap, [subject]: newCount };
            updates.question_counts = newQMap; 
            setTotalQuestionsMap(newQMap); 
            setSessionQuestionsCount(0);
        }

        if (newTestStats !== null) {
            updates.test_practice_stats = newTestStats;
        }

        if (Object.keys(updates).length > 0) {
            await supabase.from("profiles").update(updates).eq("id", dbId);
        }
        setSyncing(false);
    };

    const flushSessionStats = () => {
        if (sessionTime > 0 || sessionQuestionsCount > 0) saveDataToCloud(undefined, undefined, sessionTime, sessionQuestionsCount);
    };

    const openHistoryWithRefresh = async () => {
        flushSessionStats();
        setMode("history"); 
        if (!dbId) return;
        setSyncing(true); 
        try {
            const { data: profileData, error } = await supabase.from("profiles").select("history, subject_times, question_counts, mistakes, test_practice_stats").eq("id", dbId).single();
            if (error) throw error;
            if (profileData) {
                setHistory(profileData.history || []); 
                setTotalTimeMap(profileData.subject_times || {}); 
                setTotalQuestionsMap(profileData.question_counts || {}); 
                setMistakes(profileData.mistakes || {});
                setTestPracticeStats(profileData.test_practice_stats || {});
            }
        } catch (err) { console.error("Chyba při aktualizaci historie:", err); } finally { setSyncing(false); }
    };

    const updateMistakes = (newValOrFn) => {
        setMistakes((prev) => {
            const next = typeof newValOrFn === "function" ? newValOrFn(prev) : newValOrFn;
            saveDataToCloud(next, history); 
            return next;
        });
    };
    const updateHistory = (newValOrFn) => {
        setHistory((prev) => {
            const next = typeof newValOrFn === "function" ? newValOrFn(prev) : newValOrFn;
            saveDataToCloud(mistakes, next); 
            return next;
        });
    };
    const handleLogout = () => {
        flushSessionStats();
        clearImageCache(); // Vyčistit cache obrázků při odhlášení
        localStorage.removeItem("quizio_user_code");
        setUser(null); setDbId(null); setSubject(null); setMode(null); setIsSessionBlocked(false); 
    };

    // --- DETEKCE AKTIVITY ---
    useEffect(() => {
        const resetInactivity = () => {
            lastActivityRef.current = Date.now();
            if (isAfk) setIsAfk(false);
        };
        window.addEventListener("mousemove", resetInactivity); window.addEventListener("keydown", resetInactivity); window.addEventListener("click", resetInactivity); window.addEventListener("touchstart", resetInactivity);
        return () => {
            window.removeEventListener("mousemove", resetInactivity); window.removeEventListener("keydown", resetInactivity); window.removeEventListener("click", resetInactivity); window.removeEventListener("touchstart", resetInactivity);
        };
    }, [isAfk]);

    useEffect(() => {
        if (!mode || mode === 'review' || mode === 'history' || mode === 'admin' || mode === 'teacher_manager' || mode === 'scheduled_list' || mode === 'no_mistakes' || mode === 'real_test' || isSessionBlocked) return;
        const interval = setInterval(() => {
            const now = Date.now();
            if (now - lastActivityRef.current > 60000) { if (!isAfk) setIsAfk(true); } else { setSessionTime(prev => prev + 1); }
        }, 1000);
        return () => clearInterval(interval);
    }, [mode, isAfk, isSessionBlocked]);

    useEffect(() => {
        if (sessionTime >= 60 || sessionQuestionsCount >= 10) saveDataToCloud(undefined, undefined, sessionTime, sessionQuestionsCount);
    }, [sessionTime, sessionQuestionsCount]);

    const triggerFakeSync = () => {
        if (!syncing) { setSyncing(true); setTimeout(() => setSyncing(false), 500); }
    };

    useEffect(() => {
        localStorage.setItem("quizio_theme", theme); document.body.className = theme === "light" ? "light-mode" : "";
    }, [theme]);
    const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    // === NAČÍTÁNÍ OTÁZEK ===
    const prepareQuestionSet = (baseQuestions) => {
        if (!Array.isArray(baseQuestions)) return [];
        return baseQuestions.map((q, idx) => ({ ...q, options: [...(q.options || [])], userAnswer: undefined, _localIndex: idx, }));
    };

    useEffect(() => {
        const fetchQuestions = async () => {
            if (!subject) { setActiveQuestionsCache([]); return; }
            if (subject === "CUSTOM") { setActiveQuestionsCache(prepareQuestionSet(customQuestions || [])); return; }

            setIsLoadingQuestions(true);
            const minDelay = new Promise(resolve => setTimeout(resolve, 500));

            try {
                // OPTIMALIZOVANÝ FETCH: Pouze texty, obrázky se dotáhnou až když budou potřeba
                const { data, error } = await fetchQuestionsLightweight(subject);

                // Čekáme na minDelay, aby loader neproblikl příliš rychle (UX)
                await minDelay;

                if (error) throw error;

                if (data && data.length > 0) {
                    const mappedData = data.map((item) => ({ 
                        ...item, 
                        correctIndex: item.correct_index, 
                        options: Array.isArray(item.options) ? item.options : [], 
                    }));
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

    // --- TEST MODE LAUNCHERS ---
    const startTestPractice = (test) => {
        const pool = activeQuestionsCache.filter(q => q.number >= test.topic_range_start && q.number <= test.topic_range_end);
        if (pool.length === 0) { alert("Žádné otázky v rozsahu."); return; }
        const shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        setQuestionSet(shuffled); setMode("test_practice"); setActiveTest(test); setCurrentIndex(0); setScore({ correct: 0, total: 0 }); setFinished(false); setSelectedAnswer(null); setShowResult(false); setCombo(0);
    };

    const startGradedTest = async (test) => {
        const now = new Date();
        // Pokud nejsou data (null), považujeme test za "připravuje se" a nelze spustit.
        if (!test.open_at || !test.close_at) {
            alert("Tento test nemá stanovený termín a nelze jej spustit.");
            return;
        }

        if (now < new Date(test.open_at)) { alert("Test ještě není otevřen."); return; }
        if (now > new Date(test.close_at)) { alert("Test je již uzavřen."); return; }

        if (completedTestIds.includes(test.id)) {
            alert("Tento test jste již vypracovali a odevzdali.");
            return;
        }

        if (!confirm(`Spustit test "${test.title}"? \n\n⚠️ POZOR: Opuštění okna se zaznamenává!`)) return;

        const pool = activeQuestionsCache.filter(q => q.number >= test.topic_range_start && q.number <= test.topic_range_end);
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, test.question_count).map((q, idx) => ({ ...q, _localIndex: idx }));

        setQuestionSet(shuffled); 
        setActiveTest(test); 
        setMode("real_test"); 
    };

    // --- MODES START ---
    const startRandomMode = () => {
        const pool = activeQuestionsCache;
        if (!pool || pool.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        const shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        setQuestionSet(shuffled); setMode("random"); setCurrentIndex(0); setScore({ correct: 0, total: 0 }); setFinished(false); setSelectedAnswer(null); setShowResult(false); setIsKeyboardMode(false); setCombo(0);
    };
    const startMockTest = () => {
        const pool = activeQuestionsCache;
        if (!pool || pool.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        const sel = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(40, pool.length)).map((q, idx) => ({ ...q, _localIndex: idx }));
        setQuestionSet(sel); setTimeLeft(1800); setMode("mock"); setCurrentIndex(0); setMaxSeenIndex(0); setFinished(false); setIsKeyboardMode(false); setCombo(0);
    };
    const startMistakesMode = () => {
        const all = activeQuestionsCache;
        if (!all || all.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        const userMistakes = mistakes[subject] || [];
        const filtered = all.filter((q) => userMistakes.includes(q.number));
        if (filtered.length === 0) { setMode("no_mistakes"); return; }
        const shuffled = [...filtered].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        setQuestionSet(shuffled); setMode("mistakes"); setCurrentIndex(0); setScore({ correct: 0, total: 0 }); setFinished(false); setSelectedAnswer(null); setShowResult(false); setIsKeyboardMode(false); setTrainingTime(0); setCombo(0);
    };
    const startSmartMode = (count) => {
        setShowSmartSettings(false);
        let pool = activeQuestionsCache;
        if (!pool || pool.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        let shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        if (count !== "all" && typeof count === "number") shuffled = shuffled.slice(0, count);
        setQuestionSet(shuffled); setMode("smart"); setCurrentIndex(0); setScore({ correct: 0, total: 0 }); setFinished(false); setSelectedAnswer(null); setShowResult(false); setIsKeyboardMode(false); setTrainingTime(0); setCombo(0);
    };
    const startReviewMode = () => {
        const all = activeQuestionsCache;
        if (!all || all.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        setQuestionSet(all); setMode("review"); setCombo(0);
    };

    const addMistake = (qNumber) => updateMistakes((prev) => { const cur = prev[subject] || []; return !cur.includes(qNumber) ? { ...prev, [subject]: [...cur, qNumber] } : prev; });
    const removeMistake = (qNumber) => updateMistakes((prev) => { const cur = prev[subject] || []; return cur.includes(qNumber) ? { ...prev, [subject]: cur.filter((n) => n !== qNumber) } : prev; });
    const clearMistakes = () => { updateMistakes((prev) => ({ ...prev, [subject]: [] })); setShowClearMistakesConfirm(false); };
    const handleSelectSubject = (subj) => { setSubject(subj.toUpperCase()); };
    const handleStartMode = (startFn, modeName) => { if (modeName === "smart") { setShowSmartSettings(true); return; } startFn(); };

    const handleReportClick = (questionNumber) => { setQuestionToReport(questionNumber); setReportModalOpen(true); };

    // --- LOGIC ---
    const handleAnswer = (idx) => {
        if (finished || mode === "review") return;
        setIsKeyboardMode(true); document.body.classList.add("keyboard-mode-active");

        setQuestionSet((prev) => { const c = [...prev]; if (c[currentIndex]) c[currentIndex] = { ...c[currentIndex], userAnswer: idx }; return c; });
        if (idx !== questionSet[currentIndex].correctIndex) { triggerHaptic('error'); addMistake(questionSet[currentIndex].number); } else { triggerHaptic('success'); triggerFakeSync(); }
    };

    const clickFlashcardAnswer = (idx) => {
        if (finished || showResult) return;
        const currentQ = questionSet[currentIndex];
        const isCorrect = idx === currentQ.correctIndex;
        const newSet = [...questionSet];
        if (newSet[currentIndex]) newSet[currentIndex] = { ...newSet[currentIndex], userAnswer: idx };
        setQuestionSet(newSet); setSelectedAnswer(idx); setShowResult(true); setSessionQuestionsCount(prev => prev + 1);

        if (mode === 'test_practice' && activeTest) {
            setTestPracticeStats(prev => {
                const currentStats = prev[activeTest.id] || [];
                const newStats = [...currentStats, isCorrect].slice(-20);
                const updated = { ...prev, [activeTest.id]: newStats };
                // Voláme save s undefined pro mistakes/history, aby se nepřepsaly
                saveDataToCloud(undefined, undefined, 0, 0, updated);
                return updated;
            });
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
            else { setQuestionSet(newSet); setSelectedAnswer(null); setShowResult(false); }
        }
    };
    const confirmFlashcardAnswer = () => { if (!finished && !showResult) clickFlashcardAnswer(selectedAnswer !== null ? selectedAnswer : -1); };
    const selectRandomAnswer = (idx) => { if (!finished && !showResult) { triggerHaptic('light'); setSelectedAnswer(idx); setIsKeyboardMode(true); document.body.classList.add("keyboard-mode-active"); } };
    const clearAnswer = () => { setQuestionSet((prev) => { const c = [...prev]; if (c[currentIndex]) c[currentIndex] = { ...c[currentIndex], userAnswer: undefined }; return c; }); setSelectedAnswer(null); setShowResult(false); };

    const moveToQuestion = (newIdx) => {
        const b = Math.max(0, Math.min(newIdx, questionSet.length - 1));
        if (b < currentIndex) setDirection("left"); else setDirection("right");
        setCurrentIndex(b);
        setSelectedAnswer(null);
    };

    const handleSwipe = (dir) => {
        if (finished || showConfirmExit || showConfirmSubmit || exitDirection || isSessionBlocked) return;
        const performAction = () => {
             const isFlashcard = isFlashcardStyle(mode) || mode === 'test_practice';
             if (dir === "left") {
                 if (isFlashcard && showResult) nextFlashcardQuestion();
                 else if (isFlashcard && !showResult && selectedAnswer !== null) confirmFlashcardAnswer();
                 else if (!isFlashcard && currentIndex < questionSet.length - 1) moveToQuestion(currentIndex + 1);
             } else if (dir === "right") {
                 if (!isFlashcard && currentIndex > 0) moveToQuestion(currentIndex - 1);
             }
        };
        setExitDirection(dir);
        setTimeout(() => { performAction(); setExitDirection(null); }, 150); 
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
    const tryReturnToMenu = () => { if (mode === "mock" && !finished) setShowConfirmExit(true); else { setMode(null); setCombo(0); } };
    const confirmExit = () => { setShowConfirmExit(false); setMode(null); setCombo(0); };
    const handleFileUpload = (questions) => {
        if (!questions) return;
        const norm = questions.map((q, i) => ({ number: q.number ?? i + 1, question: q.question ?? `Otázka ${i + 1}`, options: q.options || [], correctIndex: q.correctIndex ?? 0, }));
        setCustomQuestions(norm); setSubject("CUSTOM");
    };

    const handleAdminTools = () => { setMode('admin'); };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isSessionBlocked) return;
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.repeat) return;
            if ((e.key === "Enter" || e.key === " ") && e.target.tagName === "BUTTON") return;

            if (!isKeyboardMode) { setIsKeyboardMode(true); document.body.classList.add("keyboard-mode-active"); }
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "f", "F"].includes(e.key)) e.preventDefault();
            if (showConfirmExit || showConfirmSubmit || showSmartSettings || showClearMistakesConfirm || recordToDelete || reportModalOpen) return;

            if (mode && mode !== "review" && mode !== "admin" && mode !== "scheduled_list" && mode !== "teacher_manager" && mode !== "real_test") {
                const currentQ = questionSet[currentIndex];
                const imageUrl = currentQ ? getImageUrl(subject, currentQ.number) : null;
                if (e.key === "f" || e.key === "F") { if (fullscreenImage) setFullscreenImage(null); else if (imageUrl) setFullscreenImage(imageUrl); return; }
            }
            if (fullscreenImage) return;
            if (finished || mode === "no_mistakes") { if (["Backspace", "Enter", "ArrowLeft"].includes(e.key)) setMode(null); return; }

            if (!mode && !subject) {
                const k = e.key.toLowerCase();
                const modeCount = 8;
                const getNextIndex = (current, dir) => {
                    let next = current;
                    do { next = (next + dir + modeCount) % modeCount; } while (!isTeacher && next === 5);
                    return next;
                };
                if (k === "w" || k === "arrowup") setMenuSelection((p) => getNextIndex(p, -1));
                else if (k === "s" || k === "arrowdown") setMenuSelection((p) => getNextIndex(p, 1));
                else if (k === "d" || k === "arrowright" || e.key === "Enter") {
                    if (!subject) {
                        if (menuSelection === 0) handleSelectSubject("SPS");
                        else if (menuSelection === 1) handleSelectSubject("STT");
                        else if (menuSelection === 2) document.querySelector("input[type='file']")?.click();
                        else if (menuSelection === 3 && user === "admin") handleAdminTools();
                    } else {
                        let selection = menuSelection % modeCount; if (selection < 0) selection += modeCount;
                        if (selection === 0) handleStartMode(startMockTest, "mock");
                        else if (selection === 1) setMode('scheduled_list');
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
            if (!mode || mode === 'real_test') return; // V real_test si klávesnici řídí komponenta sama
            const opts = questionSet[currentIndex]?.options?.length || 4;

            const isFlashcardInput = isFlashcardStyle(mode) || mode === 'test_practice';

            const k = e.key.toLowerCase(); // NORMALIZACE KLÁVESY (WASD + Arrows)

            if (k === "w" || e.key === "ArrowUp") {
                if (isFlashcardInput && !showResult) selectRandomAnswer(selectedAnswer === null ? opts - 1 : (selectedAnswer - 1 + opts) % opts);
                else if (!isFlashcardInput) handleAnswer(questionSet[currentIndex].userAnswer === undefined ? opts - 1 : (questionSet[currentIndex].userAnswer - 1 + opts) % opts);
            }
            if (k === "s" || e.key === "ArrowDown") {
                if (isFlashcardInput && !showResult) selectRandomAnswer(selectedAnswer === null ? 0 : (selectedAnswer + 1) % opts);
                else if (!isFlashcardInput) handleAnswer(questionSet[currentIndex].userAnswer === undefined ? 0 : (questionSet[currentIndex].userAnswer + 1) % opts);
            }
            if (k === "a" || e.key === "ArrowLeft") {
                if (isFlashcardInput) return; // Změna: Vypnuto pro flashcards/practice
                moveToQuestion(currentIndex - 1);
            }
            if (k === "d" || e.key === "ArrowRight" || e.key === "Enter") {
                if (isFlashcardInput) { if (showResult) nextFlashcardQuestion(); else confirmFlashcardAnswer(); } else moveToQuestion(currentIndex + 1);
            }
            if (e.key === " ") {
                if (isFlashcardInput && !showResult) confirmFlashcardAnswer();
                else if (!finished && mode === "mock") setShowConfirmSubmit(true); 
            }
            if (e.key === "Backspace") clearAnswer();
            if (e.key === "Escape") tryReturnToMenu();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [mode, questionSet, currentIndex, showResult, selectedAnswer, showConfirmSubmit, showConfirmExit, finished, menuSelection, subject, user, fullscreenImage, reportModalOpen, isSessionBlocked, testToStart]);

    useEffect(() => {
        if (finished || (mode !== "mock" && mode !== "smart" && mode !== "mistakes")) return;
        const interval = setInterval(() => {
            if (mode === "mock") setTimeLeft((p) => Math.max(0, p - 1)); // REAL TEST UŽ MÁ VLASTNÍ TIMER
            else setTrainingTime((t) => t + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [mode, finished]);
    useEffect(() => {
        if ((mode === "mock") && timeLeft === 0 && !finished) {
            submitTest();
        }
    }, [timeLeft, mode, finished]);

    // === RENDER ===
    if (!user) return (
        <>
            <div style={{ position: "absolute", top: "1rem", right: "1rem", zIndex: 100 }}>
                <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
            </div>
            <CloudLoginScreen onLogin={handleCloudLogin} loading={loading} />
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
                    scheduledTests={scheduledTests}
                    onBack={() => setMode(null)}
                    subject={subject}
                    user={user}
                    syncing={syncing}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    onStartGradedTest={startGradedTest}
                    onStartPractice={startTestPractice}
                    completedTestIds={completedTestIds}
                    testPracticeStats={testPracticeStats}
                    onRefresh={handleManualRefresh}
                />

                {/* Modal pro potvrzení spuštění testu */}
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
                        onCancel={() => setTestToStart(null)} 
                        onConfirm={confirmStartTest} 
                        confirmText="Spustit test" 
                        danger={false}
                    />
                )}
            </>
        );
    }

    if (mode === 'real_test') {
        return (
            <RealTestMode
                test={activeTest}
                initialQuestions={questionSet}
                user={user}
                userId={dbId}
                onExit={() => setMode(null)}
                onFinish={() => {
                    setMode(null); // nebo přesměrovat na nějakou "děkujeme" obrazovku
                }}
                theme={theme} 
                toggleTheme={toggleTheme} 
                syncing={syncing} 
                onReport={handleReportClick}
                onTestCompleted={handleTestCompletion}
            />
        );
    }

    if (!mode) {
        if (!subject) return (
            <div className="container fadeIn" style={{ height: "var(--vh)", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: 'space-between', paddingBottom: "1.5rem" }}>
                {!isLoadingQuestions && (
                    <div className="top-navbar">
                        <div className="navbar-group">
                            {user === 'admin' && (
                                <button 
                                    className="menuBackButton" 
                                    onClick={handleAdminTools}
                                    title="Admin Panel"
                                >
                                    🛠️ Admin
                                </button>
                            )}
                            <SubjectBadge subject={subject} compact />
                        </div>
                        <div className="navbar-group">
                            <UserBadgeDisplay user={user} syncing={syncing} onLogout={handleLogout} alwaysShowFullName={true} />
                            <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                        </div>
                    </div>
                )}
                {isLoadingQuestions ? (
                    <div style={{ margin: "2rem", fontSize: "1.2rem", color: "#888", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                        Načítám otázky z databáze...
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
                    isOpen={reportModalOpen} 
                    onClose={() => { setReportModalOpen(false); setQuestionToReport(null); }} 
                    theme={theme}
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
                        <div className="top-navbar">
                            <div className="navbar-group">
                                <button className="menuBackButton" onClick={() => { flushSessionStats(); clearImageCache(); setSubject(null); }}>← <span className="mobile-hide-text">Změnit předmět</span></button>
                                <SubjectBadge subject={subject} compact />
                            </div>
                            <div className="navbar-group">
                                <UserBadgeDisplay user={user} syncing={syncing} onLogout={handleLogout} />
                                <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                            </div>
                        </div>
                    )}

                    {isLoadingQuestions ? (
                        <div style={{ margin: "2rem", fontSize: "1.2rem", color: "#888", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                            Načítám otázky z databáze...
                        </div>
                    ) : (
                        <MainMenu
                            scheduledTests={scheduledTests}
                            completedTestIds={completedTestIds} // PŘEDÁVÁME SEZNAM HOTOVÝCH
                            menuSelection={menuSelection}
                            isKeyboardMode={isKeyboardMode}
                            isTeacher={isTeacher}
                            mistakesCount={mistakesCount}
                            onOpenScheduled={() => setMode('scheduled_list')}
                            onStartMock={() => handleStartMode(startMockTest, "mock")}
                            onStartSmart={() => handleStartMode(startSmartMode, "smart")}
                            onStartRandom={() => handleStartMode(startRandomMode, "random")}
                            onStartReview={() => handleStartMode(startReviewMode, "review")}
                            onOpenTeacherManager={() => setMode('teacher_manager')}
                            onStartMistakes={() => handleStartMode(startMistakesMode, "mistakes")}
                            onClearMistakes={() => setShowClearMistakesConfirm(true)}
                            onOpenHistory={openHistoryWithRefresh}
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
        const normalizedSearch = removeAccents(searchTerm);
        const filteredQuestions = questionSet.filter((q) => removeAccents(q.question).includes(normalizedSearch) || String(q.number).includes(normalizedSearch));
        const highlightRegex = getSmartRegex(searchTerm);

        return (
            <>
                <CustomImageModal src={fullscreenImage} onClose={() => setFullscreenImage(null)} />
                <div className="container fadeIn" style={{ minHeight: "var(--vh)" }}>
                    <div className="top-navbar">
                        <div className="navbar-group">
                            <button className="menuBackButton" onClick={() => { flushSessionStats(); tryReturnToMenu(); }}>← <span className="mobile-hide-text">Zpět</span></button>
                            <SubjectBadge subject={subject} compact />
                        </div>
                        <div className="navbar-group">
                            <UserBadgeDisplay user={user} syncing={syncing} />
                            <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                        </div>
                    </div>
                    <h1 className="title">Prohlížení otázek</h1>
                    <input type="text" placeholder="Hledat..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="reviewSearchInput" />
                    <div className="reviewGrid">
                        {filteredQuestions.length === 0 ? (
                            <p style={{ textAlign: "center", color: "#888", gridColumn: "1/-1" }}>Nic nenalezeno.</p>
                        ) : (
                            filteredQuestions.map((q) => {
                                const imageUrl = getImageUrl(subject, q.number);
                                return (
                                    <div key={q.number} className="reviewCard">
                                        <div className="reviewHeader"><strong>#{q.number}.</strong> <HighlightedText text={q.question} highlightRegex={highlightRegex} /></div>
                                        {imageUrl && (
                                            <div className="imageWrapper" onClick={() => setFullscreenImage(imageUrl)}>
                                                <img src={imageUrl} alt="" className="reviewImage" />
                                            </div>
                                        )}
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
                </div>
            </>
        );
    }

    let comboClass = combo >= 10 ? "combo-high" : combo >= 5 ? "combo-med" : combo >= 3 ? "combo-low" : "";
    let remainingCards = 0;
    if (mode === "smart" || mode === "mistakes") remainingCards = questionSet.length - 1;
    else if (mode === "random" || mode === "test_practice") remainingCards = questionSet.length - 1 - currentIndex;

    let stackLevelClass = "";
    if (remainingCards === 0) stackLevelClass = "stack-level-0";
    else if (remainingCards === 1) stackLevelClass = "stack-level-1";

    return (
        <>
            <CustomImageModal src={fullscreenImage} onClose={() => setFullscreenImage(null)} />
            {(() => {
                let activeReportQuestion = currentQuestion; 
                if (questionToReport) { const found = questionSet.find(q => q.number === questionToReport); if (found) activeReportQuestion = found; }
                const qForModal = activeReportQuestion || {};
                return (
                    <ReportModal 
                        isOpen={reportModalOpen} 
                        onClose={() => { setReportModalOpen(false); setQuestionToReport(null); }} 
                        theme={theme}
                        questionText={qForModal.question} 
                        questionId={qForModal.id} 
                        subject={qForModal.subject} 
                        questionNumber={qForModal.number}
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

                {!finished && (
                    <>
                        <div className="top-navbar">
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
                                <div className={`flashcardHeader ${comboClass}`} 
                                >

                                    {/* ZMĚNA: Zobrazujeme pouze pokud to není test_practice */}
                                    {mode !== 'test_practice' && (
                                        <div className="statItem">
                                            <span className="statLabel">
                                                {/* Pokud je random, ukazujeme "Zodpovězeno", jinak "Zbývá" */}
                                                {mode === "random" ? "Zodpovězeno" : "Zbývá"}
                                            </span>
                                            <span className="statValue">
                                                {(() => {
                                                    if (mode === "random") {
                                                        // V režimu Random se jen posouváme, takže currentIndex = počet zodpovězených
                                                        return currentIndex;
                                                    }
                                                    // Pro smart/mistakes (ubývající)
                                                    return questionSet.length - 1;
                                                })()}
                                            </span>
                                        </div>
                                    )}

                                    {/* COMBO (pokud je) */}
                                    {combo >= 3 && (
                                        <div 
                                            className="comboContainer" 
                                        >
                                            <div className="comboFlame">🔥</div>
                                            <div className="comboCount">{combo}x</div>
                                        </div>
                                    )}

                                    {/* PRAVÁ STRANA: ÚSPĚŠNOST */}
                                    <div className="statItem" style={{ textAlign: 'right', marginLeft: 'auto' }}>
                                        <span className="statLabel">Úspěšnost</span>
                                        <span className="statValue">
                                            {mode === 'test_practice' && activeTest ? (() => {
                                                const stats = testPracticeStats[activeTest.id] || [];
                                                if (stats.length === 0) return "0%";
                                                const correct = stats.filter(Boolean).length;
                                                return Math.round((correct / stats.length) * 100) + "%";
                                            })() : (
                                                (score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0) + "%"
                                            )}
                                        </span>
                                    </div>

                                </div>
                            ) : (
                                <>
                                    <div className="progressBarContainer"><div className="progressBarFill" style={{ width: `${((currentIndex + 1) / questionSet.length) * 100}%` }}></div></div>
                                    <div className="progressText">Otázka {currentIndex + 1} / {questionSet.length}</div>
                                </>
                            )}

                            <div className={`card ${isFlashcardStyle(mode) || mode==='test_practice' ? `stacked-card ${stackLevelClass}` : ""} ${shake ? "shake" : ""}`} ref={cardRef}>
                                <div key={currentQuestion.id || currentQuestion.number || currentIndex} className={exitDirection ? (exitDirection === 'left' ? "card-exit-left" : "card-exit-right") : ((isFlashcardStyle(mode) || mode==='test_practice') ? "" : (direction === "left" ? "card-enter-left" : "card-enter-animation"))} style={{width: '100%'}}>
                                    <QuestionCard
                                        currentQuestion={currentQuestion} mode={mode} showResult={showResult} selectedAnswer={selectedAnswer}
                                        onSelect={(i) => (isFlashcardStyle(mode) || mode==='test_practice') ? clickFlashcardAnswer(i) : handleAnswer(i)}
                                        optionRefsForCurrent={optionRefsForCurrent} disabled={(isFlashcardStyle(mode) || mode==='test_practice') && showResult}
                                        isKeyboardMode={isKeyboardMode} currentSubject={subject} onZoom={setFullscreenImage} onSwipe={handleSwipe} score={score} onReport={handleReportClick} isExiting={!!exitDirection}
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
                                    <>
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
                                    </>
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