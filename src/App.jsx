import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom"; 
import { supabase } from "./supabaseClient";
import { SubjectSelector } from "./components/SubjectSelector.jsx";
import { AdminPanel } from "./components/AdminPanel.jsx";
import { TestManager } from "./components/TestManager.jsx"; 

// --- IMPORTY Z UTILS ---
import { 
    formatTime, 
    removeAccents, 
    getSmartRegex, 
    isFlashcardStyle 
} from "./utils/formatting";
import { getImageUrl } from "./utils/images";

// --- IMPORTY KOMPONENT ---
import { SubjectBadge } from "./components/SubjectBadge";
import { UserBadgeDisplay } from "./components/UserBadgeDisplay";
import { HistoryView } from "./components/HistoryView";
import { ResultScreen } from "./components/ResultScreen";
import { QuestionCard } from "./components/QuestionCard";
import { Navigator } from "./components/Navigator";
import { ThemeToggle } from "./components/ThemeToggle";
import { HiddenPreloader } from "./components/HiddenPreloader";
import { ConfirmModal, SmartSettingsModal } from "./components/Modals"; 
import { NoMistakesScreen } from "./components/NoMistakesScreen"; 
import { ReportModal } from "./components/ReportModal";

// --- KOMPONENTA PRO BLOKOVÁNÍ SEZENÍ ---
const SessionBlockedScreen = ({ onTakeOver }) => {
    return createPortal(
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 99999, 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            backdropFilter: 'blur(10px)',
            padding: '2rem',
            textAlign: 'center'
        }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⛔</div>
            <h1 style={{ marginBottom: '1rem', color: '#ef4444' }}>Aplikace je otevřena jinde</h1>
            <p style={{ maxWidth: '500px', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: '1.6', color: '#ccc' }}>
                Z bezpečnostních důvodů může být aplikace spuštěna pouze v jednom okně prohlížeče. 
                Právě byla detekována aktivita v jiném okně nebo zařízení.
            </p>
            <button 
                onClick={onTakeOver}
                className="navButton primary"
                style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}
            >
                Používat zde
            </button>
        </div>,
        document.body
    );
};

// --- VLASTNÍ MODAL PRO OBRÁZKY (Sjednocený design) ---
const CustomImageModal = ({ src, onClose }) => {
    if (!src) return null;
    return createPortal(
        <div 
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'zoom-out',
                backdropFilter: 'blur(5px)'
            }}
        >
            <style>{`
                .zoomed-image-responsive {
                    width: 100%;
                    max-height: 95vh;
                    object-fit: contain;
                    transition: width 0.3s ease;
                    border-radius: 8px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                }
                @media (min-width: 768px) {
                    .zoomed-image-responsive {
                        width: 50%;
                    }
                }
            `}</style>
            <img 
                src={src} 
                alt="Detail" 
                className="zoomed-image-responsive"
            />
        </div>,
        document.body
    );
};

const HighlightedText = ({ text, highlightRegex }) => {
    if (!highlightRegex || !text) return <span>{text}</span>;
    const parts = text.split(highlightRegex);
    return (
        <span>
            {parts.map((part, i) =>
                highlightRegex.test(part) ? (
                    <span
                        key={i}
                        style={{
                            backgroundColor: "rgba(255, 255, 0, 0.25)",
                            color: "#fff",
                            padding: "0 2px",
                            borderRadius: "2px",
                            fontWeight: "bold",
                        }}
                    >
                        {part}
                    </span>
                ) : (
                    part
                ),
            )}
        </span>
    );
};

function CloudLoginScreen({ onLogin, loading }) {
    const [accessCode, setAccessCode] = useState("");
    return (
        <div
            className="container fadeIn"
            style={{
                minHeight: "var(--vh)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <div
                className="modal"
                style={{
                    maxWidth: "400px",
                    width: "90%",
                    textAlign: "center",
                    padding: "2rem",
                }}
            >
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔒</div>
                <h2>Vstup jen pro zvané</h2>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (accessCode.trim()) onLogin(accessCode.trim());
                    }}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                    }}
                >
                    <input
                        type="password"
                        placeholder="Zadejte kód..."
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        className="reviewSearchInput"
                        style={{ textAlign: "center" }}
                        autoFocus
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        className="navButton primary"
                        disabled={loading || !accessCode.trim()}
                    >
                        {loading ? "Ověřuji..." : "Vstoupit"}
                    </button>
                </form>
            </div>
        </div>
    );
}

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

    // OPRAVA: Vráceno zpět, protože se používají v Navigatoru a ResultScreen
    const [maxSeenIndex, setMaxSeenIndex] = useState(0); 
    const [trainingTime, setTrainingTime] = useState(0); 

    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [showConfirmExit, setShowConfirmExit] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const [timeLeftAtSubmit, setTimeLeftAtSubmit] = useState(0);
    const [isKeyboardMode, setIsKeyboardMode] = useState(false);

    // NOVÝ STAV: Sleduje směr animace ('right' nebo 'left')
    const [direction, setDirection] = useState("right");
    // STAV PRO ODLETOVOU ANIMACI
    const [exitDirection, setExitDirection] = useState(null);

    // NOVÝ STAV: Reportování
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [questionToReport, setQuestionToReport] = useState(null);

    // --- NEW STATES FOR TEST MODE ---
    const [scheduledTests, setScheduledTests] = useState([]);
    const [activeTest, setActiveTest] = useState(null);
    const [cheatScore, setCheatScore] = useState(0);

    const optionRefsForCurrent = useRef({});
    const cardRef = useRef(null);

    // REFERENCE PRO HLAVNÍ SCROLL KONTEJNER (pro reset scrollu)
    const containerRef = useRef(null);

    // Statistiky
    const [totalTimeMap, setTotalTimeMap] = useState({});
    const [sessionTime, setSessionTime] = useState(0);
    const [isAfk, setIsAfk] = useState(false);
    const lastActivityRef = useRef(Date.now());
    const [totalQuestionsMap, setTotalQuestionsMap] = useState({});
    const [sessionQuestionsCount, setSessionQuestionsCount] = useState(0);

    // --- OPRAVA CHYBY: Přesunuto sem, aby bylo dostupné pro celé tělo funkce ---
    const currentQuestion = questionSet[currentIndex] || { question: "", options: [], correctIndex: 0, number: 0, _localIndex: currentIndex };

    const isTeacher = user === 'admin' || user === 'Ucitel'; // Detekce učitele

    // --- SESSION MANAGEMENT LOGIC (Robustní) ---
    // Ref pro aktuální ID relace (aby bylo dostupné v intervalu a callbacku)
    const mySessionIdRef = useRef(null);

    // Funkce pro převzetí sezení
    const takeOverSession = async () => {
        if (!dbId) return;
        const newSessionId = crypto.randomUUID();
        setMySessionId(newSessionId);
        mySessionIdRef.current = newSessionId;
        setIsSessionBlocked(false);

        // Zapsat do DB
        await supabase.from("profiles").update({ active_session_id: newSessionId }).eq("id", dbId);
    };

    // Hlavní efekt pro správu sezení (Init + Realtime + Polling)
    useEffect(() => {
        if (!user || !dbId) return;

        // 1. Inicializace: Vygeneruj ID a zapiš se
        const initSession = async () => {
            const newSessionId = crypto.randomUUID();
            setMySessionId(newSessionId);
            mySessionIdRef.current = newSessionId;
            // Nastavíme se jako aktivní
            await supabase.from("profiles").update({ active_session_id: newSessionId }).eq("id", dbId);
        };

        initSession();

        // 2. Realtime Listener (okamžitá reakce)
        const channel = supabase
            .channel(`session_guard_${dbId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${dbId}`
                },
                (payload) => {
                    const remoteSessionId = payload.new.active_session_id;
                    // Pokud se ID v databázi změnilo a NENÍ to naše ID -> zablokovat
                    if (remoteSessionId && mySessionIdRef.current && remoteSessionId !== mySessionIdRef.current) {
                        setIsSessionBlocked(true);
                    }
                }
            )
            .subscribe();

        // 3. Polling (záloha každých 5 sekund)
        const intervalId = setInterval(async () => {
            // Pokud už jsme zablokovaní, není třeba kontrolovat
            if (mySessionIdRef.current) { 
                const { data, error } = await supabase
                    .from("profiles")
                    .select("active_session_id")
                    .eq("id", dbId)
                    .single();

                if (!error && data && data.active_session_id) {
                    if (data.active_session_id !== mySessionIdRef.current) {
                        setIsSessionBlocked(true);
                    }
                }
            }
        }, 5000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(intervalId);
        };
    }, [user, dbId]); 

    // --- REALTIME TEST FETCHING ---
    useEffect(() => {
        if (!subject || subject === 'CUSTOM') return;

        const fetchScheduledTests = async () => {
            const { data } = await supabase.from('scheduled_tests')
                .select('*')
                .eq('subject', subject)
                .order('close_at', { ascending: true });

            if (data) setScheduledTests(data);
        };

        fetchScheduledTests();

        const subscription = supabase.channel('tests_update')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_tests' }, fetchScheduledTests)
            .subscribe();

        return () => supabase.removeChannel(subscription);
    }, [subject]);

    // --- ANTI-CHEAT LISTENERS ---
    useEffect(() => {
        if (mode !== 'real_test') return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setCheatScore(prev => prev + 1);
                alert("⚠️ Opuštění okna testu bylo zaznamenáno!");
            }
        };

        const handleBlur = () => {
            setCheatScore(prev => prev + 1);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, [mode]);


    // --- HAPTICS (Vibrace - Pouze Web API) ---
    const triggerHaptic = (type) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
             if (type === 'success') navigator.vibrate(50);
             else if (type === 'error') navigator.vibrate([50, 100, 50]);
             else if (type === 'light') navigator.vibrate(10);
        }
    };

    // --- SCROLL TO TOP PŘI ZMĚNĚ PŘEDMĚTU ---
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
    }, [subject, mode]); // Reset scrollu při změně předmětu nebo módu

    // ... (Keyboard Mode Effect) ...
    useEffect(() => {
        let lastClientX = -1;
        let lastClientY = -1;

        const handleMouseMove = (e) => {
            if (e.clientX === lastClientX && e.clientY === lastClientY) return;

            lastClientX = e.clientX;
            lastClientY = e.clientY;

            if (document.body.classList.contains("keyboard-mode-active")) {
                setIsKeyboardMode(false);
                document.body.classList.remove("keyboard-mode-active");
            }
        };

        const handleKeyDownInteraction = (e) => {
            if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

            if (!document.body.classList.contains("keyboard-mode-active")) {
                setIsKeyboardMode(true);
                document.body.classList.add("keyboard-mode-active");
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

    // ... (Cloud Auth & Data Functions) ...
    // === CLOUD AUTH & DATA ===
    const handleAdminClick = () => {
        const password = prompt("Zadejte heslo administrátora:");
        if (password === "admin123") {
            alert("Vítejte v administraci! (Zatím prázdná)");
        } else if (password !== null) {
            alert("Chybné heslo.");
        }
    };

    const handleCloudLogin = async (enteredCode) => {
        setLoading(true);
        try {
            const { data: codeData, error: codeError } = await supabase
                .from("access_codes")
                .select("*")
                .eq("code", enteredCode)
                .maybeSingle();
            if (codeError || !codeData) {
                alert("Neplatný kód.");
                setLoading(false);
                return;
            }

            const identifiedUser = codeData.used_by || enteredCode;
            let { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("username", identifiedUser)
                .single();

            if (profileData) {
                setDbId(profileData.id);
                setMistakes(profileData.mistakes || {});
                setHistory(profileData.history || []);
                setTotalTimeMap(profileData.subject_times || {}); 
                setTotalQuestionsMap(profileData.question_counts || {});
                setUser(identifiedUser);
            } else {
                const { data: newData } = await supabase
                    .from("profiles")
                    .insert([{ 
                            username: identifiedUser, 
                            mistakes: {}, 
                            history: [], 
                            subject_times: {}, 
                            question_counts: {} 
                    }])
                    .select()
                    .single();
                setDbId(newData.id);
                setMistakes({});
                setHistory([]);
                setTotalTimeMap({});
                setTotalQuestionsMap({});
                setUser(identifiedUser);
            }
            localStorage.setItem("quizio_user_code", enteredCode);
        } catch (err) {
            alert("Chyba přihlášení: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const savedCode = localStorage.getItem("quizio_user_code");
        if (savedCode && !user && !loading) handleCloudLogin(savedCode);
    }, []);

    const saveDataToCloud = async (newMistakes, newHistory, timeToAdd = 0, questionsToAdd = 0) => {
        if (!dbId) return;
        setSyncing(true);

        const updates = { 
            mistakes: newMistakes !== undefined ? newMistakes : mistakes, 
            history: newHistory !== undefined ? newHistory : history 
        };

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

        await supabase.from("profiles").update(updates).eq("id", dbId);
        setSyncing(false);
    };

    // NOVÁ POMOCNÁ FUNKCE: Vynutí uložení session (např. při změně předmětu nebo odchodu do historie)
    const flushSessionStats = () => {
        if (sessionTime > 0 || sessionQuestionsCount > 0) {
            saveDataToCloud(undefined, undefined, sessionTime, sessionQuestionsCount);
        }
    };

    // --- NOVÁ FUNKCE: Otevře historii a VYNUTÍ načtení čerstvých dat z DB ---
    const openHistoryWithRefresh = async () => {
        // 1. Nejprve uložíme aktuální session (pokud nějaká je)
        flushSessionStats();

        setMode("history"); // Zobrazíme historii okamžitě (optimisticky)

        if (!dbId) return;

        setSyncing(true); // Indikace načítání
        try {
            // 2. Načteme čerstvá data z databáze
            const { data: profileData, error } = await supabase
                .from("profiles")
                .select("history, subject_times, question_counts, mistakes")
                .eq("id", dbId)
                .single();

            if (error) throw error;

            if (profileData) {
                // 3. Aktualizujeme lokální stav
                setHistory(profileData.history || []);
                setTotalTimeMap(profileData.subject_times || {});
                setTotalQuestionsMap(profileData.question_counts || {});
                setMistakes(profileData.mistakes || {});
            }
        } catch (err) {
            console.error("Chyba při aktualizaci historie:", err);
        } finally {
            setSyncing(false);
        }
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
        flushSessionStats(); // Uložit před odhlášením
        localStorage.removeItem("quizio_user_code");
        setUser(null);
        setDbId(null);
        setSubject(null);
        setMode(null);
        setIsSessionBlocked(false); // Reset blokování
    };

    // --- DETEKCE AKTIVITY ---
    useEffect(() => {
        const resetInactivity = () => {
            lastActivityRef.current = Date.now();
            if (isAfk) setIsAfk(false);
        };
        window.addEventListener("mousemove", resetInactivity);
        window.addEventListener("keydown", resetInactivity);
        window.addEventListener("click", resetInactivity);
        window.addEventListener("touchstart", resetInactivity);
        return () => {
            window.removeEventListener("mousemove", resetInactivity);
            window.removeEventListener("keydown", resetInactivity);
            window.removeEventListener("click", resetInactivity);
            window.removeEventListener("touchstart", resetInactivity);
        };
    }, [isAfk]);

    // --- HLAVNÍ ČASOVAČ ---
    useEffect(() => {
        if (!mode || mode === 'review' || mode === 'history' || mode === 'admin' || mode === 'teacher_manager' || mode === 'scheduled_list' || mode === 'no_mistakes' || isSessionBlocked) return;
        const interval = setInterval(() => {
            const now = Date.now();
            if (now - lastActivityRef.current > 60000) {
                if (!isAfk) setIsAfk(true);
            } else {
                setSessionTime(prev => prev + 1);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [mode, isAfk, isSessionBlocked]);

    // --- AUTO SYNC ---
    useEffect(() => {
        if (sessionTime >= 60 || sessionQuestionsCount >= 10) {
            saveDataToCloud(undefined, undefined, sessionTime, sessionQuestionsCount);
        }
    }, [sessionTime, sessionQuestionsCount]);

    const triggerFakeSync = () => {
        if (!syncing) {
            setSyncing(true);
            setTimeout(() => setSyncing(false), 500);
        }
    };

    useEffect(() => {
        localStorage.setItem("quizio_theme", theme);
        document.body.className = theme === "light" ? "light-mode" : "";
    }, [theme]);
    const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    // === NAČÍTÁNÍ OTÁZEK ===
    const prepareQuestionSet = (baseQuestions) => {
        if (!Array.isArray(baseQuestions)) return [];
        return baseQuestions.map((q, idx) => ({
            ...q,
            options: [...(q.options || [])],
            userAnswer: undefined,
            _localIndex: idx,
        }));
    };

    useEffect(() => {
        const fetchQuestions = async () => {
            if (!subject) {
                setActiveQuestionsCache([]);
                return;
            }
            if (subject === "CUSTOM") {
                setActiveQuestionsCache(prepareQuestionSet(customQuestions || []));
                return;
            }
            setIsLoadingQuestions(true);

            // ZMĚNA: Přidána minimální prodleva 0.5s (500ms) a Promise.all
            const minDelay = new Promise(resolve => setTimeout(resolve, 500));

            try {
                // Spustíme dotaz a čekání paralelně
                const queryPromise = supabase
                    .from("questions")
                    .select("*")
                    .eq("subject", subject)
                    .order("number", { ascending: true });

                const [_, result] = await Promise.all([minDelay, queryPromise]);
                const { data, error } = result;

                if (error) throw error;
                if (data && data.length > 0) {
                    const mappedData = data.map((item) => ({
                        ...item,
                        correctIndex: item.correct_index,
                        options: Array.isArray(item.options) ? item.options : [],
                    }));
                    setActiveQuestionsCache(prepareQuestionSet(mappedData));
                } else {
                    setActiveQuestionsCache([]);
                }
            } catch (err) {
                console.error("Chyba při stahování otázek:", err);
                alert("Nepodařilo se stáhnout otázky z cloudu.");
                setActiveQuestionsCache([]);
            } finally {
                setIsLoadingQuestions(false);
            }
        };
        fetchQuestions();
    }, [subject, customQuestions]);

    // --- TEST MODE LAUNCHERS ---
    const startTestPractice = (test) => {
        // Filtr otázek podle rozsahu testu
        const pool = activeQuestionsCache.filter(q => q.number >= test.topic_range_start && q.number <= test.topic_range_end);
        if (pool.length === 0) { alert("Žádné otázky v rozsahu."); return; }

        // Zobrazení úspěšnosti za posledních 20 odpovědí
        const testModeKey = `test_practice_${test.id}`;
        // Najít v historii záznamy pro tento 'mode'
        // (Zjednodušeně to uděláme tak, že se to ukáže v modalu před startem nebo jako toast, ale zde rovnou spustíme)

        const shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        setQuestionSet(shuffled);
        setMode("test_practice"); // Chová se jako Smart Mode
        setActiveTest(test);
        setCurrentIndex(0);
        setScore({ correct: 0, total: 0 });
        setFinished(false);
        setSelectedAnswer(null);
        setShowResult(false);
        setCombo(0);
    };

    const startGradedTest = (test) => {
        // Kontrola času
        const now = new Date();
        if (now < new Date(test.open_at)) { alert("Test ještě není otevřen."); return; }
        if (now > new Date(test.close_at)) { alert("Test je již uzavřen."); return; }

        if (!confirm(`Spustit test "${test.title}"? \n\n⚠️ POZOR: Opuštění okna se zaznamenává!`)) return;

        // Výběr otázek (náhodně z rozsahu)
        const pool = activeQuestionsCache.filter(q => q.number >= test.topic_range_start && q.number <= test.topic_range_end);
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, test.question_count).map((q, idx) => ({ ...q, _localIndex: idx }));

        setQuestionSet(shuffled);
        setMode("real_test");
        setActiveTest(test);
        setCurrentIndex(0);
        setTimeLeft(test.time_limit * 60); // minuty na sekundy
        setFinished(false);
        setCheatScore(0);
        setSelectedAnswer(null);

        // Fullscreen pro efekt (volitelné)
        try { document.documentElement.requestFullscreen().catch(e => console.log(e)); } catch(e){}
    };

    const submitGradedTest = async () => {
        if (!activeTest) return;
        const qEval = questionSet;
        const cor = qEval.filter((q) => q.userAnswer === q.correctIndex).length;
        const finalScore = { correct: cor, total: qEval.length };

        // Uložení do DB
        const answersToSave = questionSet.map(q => ({ qNum: q.number, user: q.userAnswer, correct: q.correctIndex }));

        setLoading(true);
        await supabase.from('test_results').insert([{
            test_id: activeTest.id,
            student_name: user,
            user_id: dbId,
            score_correct: cor,
            score_total: qEval.length,
            answers: answersToSave,
            time_spent: (activeTest.time_limit * 60) - timeLeft,
            cheat_score: cheatScore
        }]);
        setLoading(false);

        setScore(finalScore);
        setFinished(true);
        try { document.exitFullscreen().catch(e=>console.log(e)); } catch(e){}
        alert("Test odeslán! Výsledek uložen.");
    };

    // --- MODES START ---
    const startRandomMode = () => {
        const pool = activeQuestionsCache;
        if (!pool || pool.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        const shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        setQuestionSet(shuffled);
        setMode("random");
        setCurrentIndex(0);
        setScore({ correct: 0, total: 0 });
        setFinished(false);
        setSelectedAnswer(null);
        setShowResult(false);
        setIsKeyboardMode(false);
        setCombo(0); // Reset Comba
    };
    const startMockTest = () => {
        const pool = activeQuestionsCache;
        if (!pool || pool.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        const sel = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(40, pool.length)).map((q, idx) => ({ ...q, _localIndex: idx }));
        setQuestionSet(sel);
        setTimeLeft(1800);
        setMode("mock");
        setCurrentIndex(0);
        setMaxSeenIndex(0); // Ponecháno pro reset, i když se nepoužívá
        setFinished(false);
        setIsKeyboardMode(false);
        setCombo(0); // Reset Comba
    };
    // ODSTRANĚNO: const startTrainingMode = ...
    const startMistakesMode = () => {
        const all = activeQuestionsCache;
        if (!all || all.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        const userMistakes = mistakes[subject] || [];
        const filtered = all.filter((q) => userMistakes.includes(q.number));
        if (filtered.length === 0) { setMode("no_mistakes"); return; }
        const shuffled = [...filtered].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        setQuestionSet(shuffled);
        setMode("mistakes");
        setCurrentIndex(0);
        setScore({ correct: 0, total: 0 });
        setFinished(false);
        setSelectedAnswer(null);
        setShowResult(false);
        setIsKeyboardMode(false);
        setTrainingTime(0);
        setCombo(0); // Reset Comba
    };
    const startSmartMode = (count) => {
        setShowSmartSettings(false);
        let pool = activeQuestionsCache;
        if (!pool || pool.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        let shuffled = [...pool].sort(() => Math.random() - 0.5).map((q, idx) => ({ ...q, _localIndex: idx }));
        if (count !== "all" && typeof count === "number") shuffled = shuffled.slice(0, count);
        setQuestionSet(shuffled);
        setMode("smart");
        setCurrentIndex(0);
        setScore({ correct: 0, total: 0 });
        setFinished(false);
        setSelectedAnswer(null);
        setShowResult(false);
        setIsKeyboardMode(false);
        setTrainingTime(0);
        setCombo(0); // Reset Comba
    };
    const startReviewMode = () => {
        const all = activeQuestionsCache;
        if (!all || all.length === 0) { alert("Žádné otázky nejsou k dispozici."); return; }
        setQuestionSet(all);
        setMode("review");
        setCombo(0); // Reset Comba
    };

    const addMistake = (qNumber) =>
        updateMistakes((prev) => {
            const cur = prev[subject] || [];
            return !cur.includes(qNumber) ? { ...prev, [subject]: [...cur, qNumber] } : prev;
        });
    const removeMistake = (qNumber) =>
        updateMistakes((prev) => {
            const cur = prev[subject] || [];
            return cur.includes(qNumber) ? { ...prev, [subject]: cur.filter((n) => n !== qNumber) } : prev;
        });
    const clearMistakes = () => {
        updateMistakes((prev) => ({ ...prev, [subject]: [] }));
        setShowClearMistakesConfirm(false);
    };
    const handleSelectSubject = (subj) => { setSubject(subj.toUpperCase()); };
    const handleStartMode = (startFn, modeName) => {
        if (modeName === "smart") { setShowSmartSettings(true); return; }
        startFn();
    };

    // --- REPORTING LOGIC ---
    const handleReportClick = (questionNumber) => {
        setQuestionToReport(questionNumber);
        setReportModalOpen(true);
    };

    // --- LOGIC ---
    const handleAnswer = (idx) => {
        if (finished || mode === "review") return;
        setIsKeyboardMode(true);
        document.body.classList.add("keyboard-mode-active");

        // V reálném testu se neukazuje výsledek hned
        if (mode === 'real_test') {
            setQuestionSet((prev) => {
                const c = [...prev];
                if (c[currentIndex]) c[currentIndex] = { ...c[currentIndex], userAnswer: idx };
                return c;
            });
            // Auto-advance po krátké prodlevě
            setTimeout(() => {
                if (currentIndex < questionSet.length - 1) moveToQuestion(currentIndex + 1);
            }, 200);
            return;
        }

        setQuestionSet((prev) => {
            const c = [...prev];
            if (c[currentIndex]) c[currentIndex] = { ...c[currentIndex], userAnswer: idx };
            return c;
        });
        if (idx !== questionSet[currentIndex].correctIndex) {
            triggerHaptic('error'); // VIBRACE PŘI CHYBĚ
            addMistake(questionSet[currentIndex].number);
        } else {
            triggerHaptic('success'); // VIBRACE PŘI SPRÁVNÉ ODPOVĚDI
            triggerFakeSync();
        }
    };

    const clickFlashcardAnswer = (idx) => {
        if (finished || showResult) return;
        const currentQ = questionSet[currentIndex];
        const isCorrect = idx === currentQ.correctIndex;
        const newSet = [...questionSet];
        if (newSet[currentIndex]) newSet[currentIndex] = { ...newSet[currentIndex], userAnswer: idx };
        setQuestionSet(newSet);
        setSelectedAnswer(idx);
        setShowResult(true);
        setSessionQuestionsCount(prev => prev + 1);

        if (isCorrect) {
            triggerHaptic('success'); // VIBRACE
            setScore((s) => ({ correct: s.correct + 1, total: s.total + 1 }));
            setCombo((c) => c + 1);
            if (mode === "mistakes") removeMistake(currentQ.number);
            else triggerFakeSync();
        } else {
            triggerHaptic('error'); // VIBRACE
            setScore((s) => ({ ...s, total: s.total + 1 }));
            addMistake(currentQ.number);
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
                const qToMove = newSet.shift();
                qToMove.userAnswer = undefined;
                newSet.splice(Math.min(newSet.length, 3 + Math.floor(Math.random() * 3)), 0, qToMove);
            }
            if (newSet.length === 0) { setFinished(true); addToHistory(score); }
            else { setQuestionSet(newSet); setSelectedAnswer(null); setShowResult(false); }
        }
    };
    const confirmFlashcardAnswer = () => {
        if (!finished && !showResult) clickFlashcardAnswer(selectedAnswer !== null ? selectedAnswer : -1);
    };
    const selectRandomAnswer = (idx) => {
        if (!finished && !showResult) { 
            triggerHaptic('light'); // JEMNÁ VIBRACE PŘI VÝBĚRU
            setSelectedAnswer(idx); 
            setIsKeyboardMode(true);
            document.body.classList.add("keyboard-mode-active");
        }
    };
    const clearAnswer = () => {
        setQuestionSet((prev) => {
            const c = [...prev];
            if (c[currentIndex]) c[currentIndex] = { ...c[currentIndex], userAnswer: undefined };
            return c;
        });
        setSelectedAnswer(null);
        setShowResult(false);
    };

    // UPRAVENÁ FUNKCE: Detekce směru
    const moveToQuestion = (newIdx) => {
        const b = Math.max(0, Math.min(newIdx, questionSet.length - 1));
        if (b < currentIndex) setDirection("left");
        else setDirection("right");

        // ODSTRANĚNO: training mode logika pro maxSeenIndex
        setCurrentIndex(b);
    };

    // --- FUNKCE PRO SWIPOVÁNÍ S ANIMACÍ (Opraveno) ---
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

        // ZRYCHLENÁ ANIMACE NA 0.15s (150ms)
        setExitDirection(dir);
        setTimeout(() => {
            performAction();
            setExitDirection(null);
        }, 150); 
    };

    const submitTest = () => {
        const qEval = questionSet; 
        const cor = qEval.filter((q) => q.userAnswer === q.correctIndex).length;
        const finalScore = { correct: cor, total: qEval.length };
        const answeredCount = qEval.filter(q => q.userAnswer !== undefined).length;
        setSessionQuestionsCount(prev => prev + answeredCount);
        setScore(finalScore);
        setTimeLeftAtSubmit(timeLeft);
        setFinished(true);
        setShowConfirmSubmit(false);
        addToHistory(finalScore);
    };
    const addToHistory = (s) => {
        if (mode !== "mock") return;
        const newRec = {
            date: new Date().toISOString(),
            mode: mode,
            score: s,
            subject: subject,
            id: Date.now() + "-" + Math.random(),
        };
        updateHistory((prev) => [...prev, newRec]);
    };
    const tryReturnToMenu = () => {
        if (mode === "mock" && !finished) setShowConfirmExit(true);
        else {
            setMode(null);
            setCombo(0); // Reset Comba
        }
    };
    const confirmExit = () => { 
        setShowConfirmExit(false); 
        setMode(null); 
        setCombo(0); // Reset Comba
    };
    const handleFileUpload = (questions) => {
        if (!questions) return;
        const norm = questions.map((q, i) => ({
            number: q.number ?? i + 1,
            question: q.question ?? `Otázka ${i + 1}`,
            options: q.options || [],
            correctIndex: q.correctIndex ?? 0,
        }));
        setCustomQuestions(norm);
        setSubject("CUSTOM");
    };

    const handleAdminTools = () => { setMode('admin'); };

    // ... (Keyboard useEffect) ...
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isSessionBlocked) return;
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return; // Ignorovat při psaní
            if (e.repeat) return;
            if ((e.key === "Enter" || e.key === " ") && e.target.tagName === "BUTTON") return;

            if (!isKeyboardMode) {
                 setIsKeyboardMode(true);
                 document.body.classList.add("keyboard-mode-active");
            }
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "f", "F"].includes(e.key)) e.preventDefault();
            if (showConfirmExit || showConfirmSubmit || showSmartSettings || showClearMistakesConfirm || recordToDelete || reportModalOpen) return;

            if (mode && mode !== "review" && mode !== "admin" && mode !== "scheduled_list" && mode !== "teacher_manager") {
                const currentQ = questionSet[currentIndex];
                const imageUrl = currentQ ? getImageUrl(subject, currentQ.number) : null;
                if (e.key === "f" || e.key === "F") {
                    if (fullscreenImage) setFullscreenImage(null);
                    else if (imageUrl) setFullscreenImage(imageUrl);
                    return;
                }
            }
            if (fullscreenImage) return;
            if (finished || mode === "no_mistakes") {
                if (["Backspace", "Enter", "ArrowLeft"].includes(e.key)) setMode(null);
                return;
            }
            if (!mode && !subject) {
                const k = e.key.toLowerCase();
                const modeCount = 8; // ZVÝŠENO PRO NOVÉ TLAČÍTKO

                // Helper to skip index 5 (Teacher Manager) if not teacher
                const getNextIndex = (current, dir) => {
                    let next = current;
                    do {
                        next = (next + dir + modeCount) % modeCount;
                    } while (!isTeacher && next === 5); // Skip 5 if not teacher
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
                        // FIX: Ensure correct selection index
                        let selection = menuSelection % modeCount;
                        if (selection < 0) selection += modeCount;

                        if (selection === 0) handleStartMode(startMockTest, "mock");
                        else if (selection === 1) setMode('scheduled_list'); // NOVÝ REŽIM
                        else if (selection === 2) handleStartMode(startSmartMode, "smart");
                        else if (selection === 3) handleStartMode(startRandomMode, "random");
                        else if (selection === 4) handleStartMode(startReviewMode, "review");
                        else if (selection === 5) { if(isTeacher) setMode('teacher_manager'); } // Zabezpečení
                        else if (selection === 6) handleStartMode(startMistakesMode, "mistakes");
                        else if (selection === 7) openHistoryWithRefresh();
                    }
                } else if (k === "a" || k === "arrowleft" || k === "backspace") {
                    if (subject) setSubject(null);
                }
                return;
            }
            if (!mode) return;
            const opts = questionSet[currentIndex]?.options?.length || 4;
            if (e.key === "w" || e.key === "ArrowUp") {
                if (isFlashcardStyle(mode) && !showResult) selectRandomAnswer(selectedAnswer === null ? opts - 1 : (selectedAnswer - 1 + opts) % opts);
                else if (!isFlashcardStyle(mode)) handleAnswer(questionSet[currentIndex].userAnswer === undefined ? opts - 1 : (questionSet[currentIndex].userAnswer - 1 + opts) % opts);
            }
            if (e.key === "s" || e.key === "ArrowDown") {
                if (isFlashcardStyle(mode) && !showResult) selectRandomAnswer(selectedAnswer === null ? 0 : (selectedAnswer + 1) % opts);
                else if (!isFlashcardStyle(mode)) handleAnswer(questionSet[currentIndex].userAnswer === undefined ? 0 : (questionSet[currentIndex].userAnswer + 1) % opts);
            }
            if (e.key === "a" || e.key === "ArrowLeft") {
                if (isFlashcardStyle(mode) && showResult) nextFlashcardQuestion();
                else moveToQuestion(currentIndex - 1);
            }
            if (e.key === "d" || e.key === "ArrowRight" || e.key === "Enter") {
                if (isFlashcardStyle(mode)) {
                    if (showResult) nextFlashcardQuestion();
                    else confirmFlashcardAnswer();
                } else moveToQuestion(currentIndex + 1);
            }
            if (e.key === " ") {
                if (isFlashcardStyle(mode) && !showResult) confirmFlashcardAnswer();
                else if (!finished && mode === "mock") setShowConfirmSubmit(true); 
            }
            if (e.key === "Backspace") clearAnswer();
            if (e.key === "Escape") tryReturnToMenu();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [mode, questionSet, currentIndex, showResult, selectedAnswer, showConfirmSubmit, showConfirmExit, finished, menuSelection, subject, user, fullscreenImage, reportModalOpen, isSessionBlocked]);

    useEffect(() => {
        if (finished || (mode !== "mock" && mode !== "smart" && mode !== "mistakes")) return;
        const interval = setInterval(() => {
            if (mode === "mock" || mode === "real_test") setTimeLeft((p) => Math.max(0, p - 1));
            else setTrainingTime((t) => t + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [mode, finished]);
    useEffect(() => {
        if ((mode === "mock" || mode === "real_test") && timeLeft === 0 && !finished) {
            if (mode === 'real_test') submitGradedTest();
            else submitTest();
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

    // --- BLOKACE VÍCE OKEN ---
    if (isSessionBlocked) {
        return <SessionBlockedScreen onTakeOver={takeOverSession} />;
    }

    // ZOBRAZENÍ TEST MANAGERU PRO UČITELE
    if (mode === 'teacher_manager') {
        // Dodatečná ochrana, kdyby se sem dostal student
        if (!isTeacher) {
            setMode(null);
            return null;
        }
        return <TestManager onBack={() => setMode(null)} subject={subject} isTeacher={isTeacher} />;
    }

    // --- NOVÝ SCREEN: PLÁNOVANÉ TESTY ---
    if (mode === 'scheduled_list') {
        return (
            <div className="container fadeIn" style={{ minHeight: "var(--vh)" }}>
                <div className="top-navbar">
                    <div className="navbar-group">
                        <button className="menuBackButton" onClick={() => setMode(null)}>← <span className="mobile-hide-text">Zpět do menu</span></button>
                        <SubjectBadge subject={subject} compact />
                    </div>
                    <div className="navbar-group">
                        <UserBadgeDisplay user={user} syncing={syncing} />
                        <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
                    </div>
                </div>
                <h1 className="title">Plánované testy 📅</h1>

                <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto', padding: '1rem' }}>
                    {scheduledTests.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-neutral)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                            <h3>Žádné testy</h3>
                            <p>Učitel zatím nenaplánoval žádné písemky.</p>
                        </div>
                    ) : (
                        scheduledTests.map(test => {
                            const now = new Date();
                            const isOpen = now >= new Date(test.open_at) && now <= new Date(test.close_at);
                            const isClosed = now > new Date(test.close_at);

                            // Fake readiness data
                            const readiness = Math.round(Math.random() * 40 + 60); 

                            return (
                                <div key={test.id} className="card" style={{padding:'1rem', marginBottom:'1rem', borderLeft: isOpen ? '5px solid var(--color-success)' : '5px solid var(--color-border)'}}>
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                                        <div>
                                            <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{test.title}</div>
                                            <div style={{fontSize:'0.9rem', opacity:0.8, marginTop:'0.2rem'}}>Rozsah: {test.topic_range_start}-{test.topic_range_end} • {test.time_limit} min</div>
                                            <div style={{fontSize:'0.8rem', marginTop:'0.5rem', color: isOpen ? 'var(--color-success)' : (isClosed ? 'var(--color-error)' : 'var(--color-warning)')}}>{isOpen ? '🟢 OTEVŘENO - Probíhá' : (isClosed ? '🔴 UZAVŘENO' : `🟡 Otevře se: ${new Date(test.open_at).toLocaleString()}`)}</div>
                                        </div>
                                        {isOpen && (
                                            <button className="navButton primary" style={{boxShadow:'0 4px 15px rgba(34, 197, 94, 0.4)', background:'var(--color-success)', border:'none', color:'white'}} onClick={() => startGradedTest(test)}>SPUSTIT TEST ✍️</button>
                                        )}
                                    </div>
                                    <div style={{marginTop:'1rem', paddingTop:'1rem', borderTop:'1px solid var(--color-border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <div style={{fontSize:'0.9rem'}}><span style={{opacity:0.7}}>Tvoje připravenost:</span> <strong style={{color:'var(--color-primary-light)'}}>{readiness}%</strong> (posl. 20)</div>
                                        <button className="navButton" style={{padding:'0.4rem 1rem', fontSize:'0.85rem'}} onClick={() => startTestPractice(test)}>Procvičit rozsah 🎓</button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    if (!mode) {
        if (!subject) return (
            <div className="container fadeIn" style={{ height: "var(--vh)", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: 'space-between', paddingBottom: "1.5rem" }}>

                {/* ZMĚNA: Skrytí horní lišty při načítání */}
                {!isLoadingQuestions && (
                    <div className="top-navbar">
                        <div className="navbar-group">
                            {/* OPRAVA: Při odchodu z předmětu ulož session */}
                            <button className="menuBackButton" onClick={() => { flushSessionStats(); setSubject(null); }}>← <span className="mobile-hide-text">Změnit předmět</span></button>
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
                    onClose={() => { 
                        setReportModalOpen(false); 
                        setQuestionToReport(null); // Vyčistíme výběr po zavření
                    }} 
                    theme={theme} // <--- PŘEDÁVÁME THEME

                    // Předáváme data vybrané otázky
                    {...(() => {
                        let activeReportQuestion = currentQuestion; 

                        if (questionToReport) {
                            const found = questionSet.find(q => q.number === questionToReport);
                            if (found) activeReportQuestion = found;
                        }

                        const qForModal = activeReportQuestion || {};

                        return {
                            questionText: qForModal.question,
                            questionId: qForModal.id,
                            subject: qForModal.subject,
                            questionNumber: qForModal.number,
                            options: qForModal.options,
                            correctIndex: qForModal.correctIndex,
                            userAnswer: qForModal.userAnswer,
                        };
                    })()}

                    mode={mode}
                    username={user} // ODESÍLÁME JMÉNO UŽIVATELE (TEXT)
                    userId={dbId}   // ODESÍLÁME ID UŽIVATELE Z PROFILU (UUID)
                    isExiting={!!exitDirection} // <--- Skrytí ikony při animaci
                />

                {/* --- MOVED CONFIRM MODALS HERE (OUTSIDE CONTAINER) --- */}
                {showSmartSettings && <SmartSettingsModal onStart={startSmartMode} onCancel={() => setShowSmartSettings(false)} totalQuestions={activeQuestionsCache.length} />}
                {showClearMistakesConfirm && <ConfirmModal title="Vynulovat opravnu?" message="Smazat chyby z cloudu?" onCancel={() => setShowClearMistakesConfirm(false)} onConfirm={clearMistakes} confirmText="Smazat" danger={true} />}

                {/* ZMĚNA: Přidán ref pro reset scrollu a zarovnání flex-start */}
                <div 
                    ref={containerRef}
                    className="container fadeIn" 
                    style={{ minHeight: "var(--vh)", display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center" }}
                >

                    {/* ZMĚNA: Skrytí horní lišty při načítání */}
                    {!isLoadingQuestions && (
                        <div className="top-navbar">
                            <div className="navbar-group">
                                {/* OPRAVA: Při odchodu z předmětu ulož session */}
                                <button className="menuBackButton" onClick={() => { flushSessionStats(); setSubject(null); }}>← <span className="mobile-hide-text">Změnit předmět</span></button>
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
                        <div className="menuColumn" style={{ maxWidth: '600px' }}>

                            {/* ZACHOVÁNO: Rychlé upozornění nahoře, pokud běží test (pro jistotu) */}
                            {scheduledTests.some(t => {
                                const now = new Date();
                                return now >= new Date(t.open_at) && now <= new Date(t.close_at);
                            }) && (
                                <div className="alert-box" style={{marginBottom: '1rem', cursor: 'pointer'}} onClick={() => setMode('scheduled_list')}>
                                    🔔 Máš aktivní písemku! Klikni zde pro otevření.
                                </div>
                            )}

                            {/* --- STANDARDNÍ MENU --- */}
                            <button className={`menuButton primary-style ${menuSelection % 8 === 0 && isKeyboardMode ? "selected" : ""}`} onClick={() => handleStartMode(startMockTest, "mock")}>
                                <span style={{ fontSize: '1.4rem', fontWeight: '800', textAlign: 'left' }}>Test nanečisto</span>
                                <div className="test-details"><span>⏱️ 30 min</span><span>❓ 40 otázek</span></div>
                                <div className="test-icon-container">✅</div>
                            </button>

                            <div className="menuColumn" style={{ marginTop: '0', maxWidth: '600px' }}>
                                {/* --- NOVÉ TLAČÍTKO: PLÁNOVANÉ TESTY (Index 1) --- */}
                                <button className={`menuButton list-style ${menuSelection % 8 === 1 && isKeyboardMode ? "selected" : ""}`} onClick={() => setMode('scheduled_list')}>
                                    <span className="list-icon">🗓️</span>
                                    <div style={{ flexGrow: 1, textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 600 }}>Plánované testy</span><small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Písemky a úkoly zadané učitelem.</small></div>
                                    {scheduledTests.length > 0 && <span className="badge">{scheduledTests.length}</span>}
                                </button>

                                <button className={`menuButton list-style ${menuSelection % 8 === 2 && isKeyboardMode ? "selected" : ""}`} onClick={() => handleStartMode(startSmartMode, "smart")}>
                                    <span className="list-icon">🎓</span>
                                    <div style={{ flexGrow: 1, textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 600 }}>Chytré učení</span><small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Opakování s rozestupy dle historie tvých chyb.</small></div>
                                </button>
                                <button className={`menuButton list-style ${menuSelection % 8 === 3 && isKeyboardMode ? "selected" : ""}`} onClick={() => handleStartMode(startRandomMode, "random")}>
                                    <span className="list-icon">🧠</span>
                                    <div style={{ flexGrow: 1, textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 600 }}>Flashcards</span><small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Náhodný trénink s okamžitou kontrolou.</small></div>
                                </button>

                                <button className={`menuButton list-style ${menuSelection % 8 === 4 && isKeyboardMode ? "selected" : ""}`} onClick={() => handleStartMode(startReviewMode, "review")}>
                                    <span className="list-icon">📚</span>
                                    <div style={{ flexGrow: 1, textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 600 }}>Prohlížení otázek</span><small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Vyhledávání a kontrola všech otázek v přehledném gridu.</small></div>
                                </button>

                                {/* --- TLAČÍTKO PRO SPRÁVU TESTŮ (Index 5) --- */}
                                <button 
                                    className={`menuButton list-style ${menuSelection % 8 === 5 && isKeyboardMode ? "selected" : ""}`} 
                                    onClick={() => setMode('teacher_manager')} 
                                    style={{ 
                                        marginTop: '0.5rem', 
                                        borderColor: 'var(--color-primary)',
                                        background: isTeacher ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-bg-container)',
                                        display: isTeacher ? 'flex' : 'none' // Skryjeme studentům, ti mají "Plánované testy"
                                    }}
                                >
                                    <span className="list-icon">👨‍🏫</span>
                                    <div style={{ flexGrow: 1, textAlign: 'left' }}>
                                        <span style={{ display: 'block', fontWeight: 600 }}>Správa testů</span>
                                        <small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>
                                            Plánování písemek a přehled výsledků.
                                        </small>
                                    </div>
                                </button>

                                <button className={`menuButton list-style danger-style ${menuSelection % 8 === 6 && isKeyboardMode ? "selected" : ""}`} onClick={() => handleStartMode(startMistakesMode, "mistakes")} style={{ marginTop: '1.5rem' }}>
                                    <span className="list-icon">🚑</span>
                                    <span style={{ flexGrow: 1, textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 600, color: 'var(--color-text-main)' }}>Opravna chyb</span><small style={{ color: 'var(--color-text-neutral)', fontSize: '0.85rem' }}>Znovu testuje pouze otázky, ve kterých jsi chyboval.</small></span>
                                    {mistakesCount > 0 ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ color: 'var(--color-error)', fontWeight: 'bold' }}>({mistakesCount})</span>
                                            <button onClick={(e) => { e.stopPropagation(); setShowClearMistakesConfirm(true); }} title="Vymazat všechny chyby" className="clearMistakesIcon" style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', padding: '0', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button>
                                        </div>
                                    ) : (<span style={{ opacity: 0.6 }}>✓</span>)}
                                </button>

                                <button className={`navButton primary-style ${menuSelection % 8 === 7 && isKeyboardMode ? "selected" : ""}`} onClick={openHistoryWithRefresh} style={{ marginTop: '1rem', width: '100%', padding: '1rem', fontSize: '1rem', display: 'flex', justifyContent: 'center' }}>Historie výsledků 📊</button>
                                <div className="keyboard-hints" style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#888", textAlign: "center", lineHeight: "1.6", flexShrink: 0, marginBottom: "1rem" }}>
                                    Klávesy: W/S ↑↓ – výběr • A/D ←→ – otázky<br />Mezerník – potvrzení • Enter – potvrzení / další • Esc – zrušit
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </>
        );
    }

    if (mode === "admin") return <AdminPanel onBack={() => setMode(null)} />;
    if (mode === "no_mistakes") return <NoMistakesScreen onBack={() => setMode(null)} subject={subject} />;

    // ZOBRAZENÍ PRO TEST PRACTICE A REAL TEST
    if (mode === "history") return (
        <>
            <HistoryView
                history={history}
                totalTimeMap={totalTimeMap}
                sessionTime={sessionTime}
                totalQuestionsMap={totalQuestionsMap}
                sessionQuestionsCount={sessionQuestionsCount}
                onBack={() => setMode(null)}
                currentSubject={subject}
                onDeleteRecord={setRecordToDelete}
                user={user}
                syncing={syncing}
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
                            {/* OPRAVA: Při návratu z review ulož session */}
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

    // --- LOGIKA PRO DYNAMICKÝ STACK ---
    let remainingCards = 0;
    if (mode === "smart" || mode === "mistakes") {
        remainingCards = questionSet.length - 1;
    } else if (mode === "random") {
        remainingCards = questionSet.length - 1 - currentIndex;
    }

    let stackLevelClass = "";
    if (remainingCards === 0) stackLevelClass = "stack-level-0";
    else if (remainingCards === 1) stackLevelClass = "stack-level-1";

    return (
        <>
            <CustomImageModal src={fullscreenImage} onClose={() => setFullscreenImage(null)} />

            {/* PŘESUNUTO SEM - MIMO HLAVNÍ KONTEJNER */}
            {/* Reportovací okno */}
            {/* LOGIKA PRO VÝBĚR SPRÁVNÉ OTÁZKY K NAHLÁŠENÍ */}
            {(() => {
                // 1. Zkusíme najít otázku podle čísla v 'questionToReport' (pokud bylo kliknuto v seznamu)
                // 2. Pokud ne, použijeme aktuální 'currentQuestion' (pokud se hlásí ze hry)
                let activeReportQuestion = currentQuestion; // Default

                if (questionToReport) {
                    const found = questionSet.find(q => q.number === questionToReport);
                    if (found) activeReportQuestion = found;
                }

                // Ošetření prázdného objektu
                const qForModal = activeReportQuestion || {};

                return (
                    <ReportModal 
                        isOpen={reportModalOpen} 
                        onClose={() => { 
                            setReportModalOpen(false); 
                            setQuestionToReport(null); // Vyčistíme výběr po zavření
                        }} 
                        theme={theme} // <--- PŘEDÁVÁME THEME

                        // Předáváme data vybrané otázky
                        questionText={qForModal.question} 
                        questionId={qForModal.id} 
                        subject={qForModal.subject} 
                        questionNumber={qForModal.number}

                        // NOVÉ PROPS PRO VÍCE INFORMACÍ
                        mode={mode}
                        options={qForModal.options}
                        correctIndex={qForModal.correctIndex}
                        userAnswer={qForModal.userAnswer}
                        username={user} // ODESÍLÁME JMÉNO UŽIVATELE (TEXT)
                        userId={dbId}   // ODESÍLÁME ID UŽIVATELE Z PROFILU (UUID)
                        isExiting={!!exitDirection} // <--- Skrytí ikony při animaci
                    />
                );
            })()}

            <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
                {showConfirmSubmit && <ConfirmModal title={mode==='real_test'?"Odevzdat test?":"Odevzdat?"} message={mode==='real_test'?"Po odevzdání už nepůjde odpovědi změnit.":"Opravdu odevzdat?"} onCancel={() => setShowConfirmSubmit(false)} onConfirm={mode==='real_test'?submitGradedTest:submitTest} confirmText={mode==='real_test'?"ODEVZDAT":"Ano"} danger={mode==='real_test'} />}
                {showConfirmExit && <ConfirmModal title="Ukončit?" message="Ztracené odpovědi nebudou uloženy." onCancel={() => setShowConfirmExit(false)} onConfirm={confirmExit} confirmText="Ukončit" />}

                {finished && (
                    <ResultScreen
                        mode={mode}
                        score={score}
                        trainingTime={trainingTime}
                        questionSet={questionSet}
                        maxSeenIndex={maxSeenIndex}
                        onBack={() => { setMode(null); setCombo(0); }} /* PŘIDÁNO: Reset comba zde */
                        currentSubject={subject}
                        timeLeftAtSubmit={timeLeftAtSubmit}
                        onZoom={setFullscreenImage}
                        user={user}
                        syncing={syncing}
                        onReport={handleReportClick} // NOVÁ PROP - Předáváme funkci pro report
                    />
                )}

                {!finished && (
                    <>
                        <div className="top-navbar">
                            <div className="navbar-group">
                                {mode === 'real_test' 
                                    ? <span style={{fontWeight:'bold', color:'var(--color-error)'}}>⚠️ TEST: NEOPOUŠTĚJ OKNO!</span>
                                    : <button className="menuBackButton" onClick={tryReturnToMenu}>← <span className="mobile-hide-text">Zpět</span></button>
                                }
                                <div className="mobile-hidden"><SubjectBadge subject={subject} compact /></div>
                            </div>
                            <div className="navbar-group">
                                {(mode === "mock" || mode === "real_test") && <div className={`timer ${timeLeft <= 300 ? "timerWarning" : ""} ${timeLeft <= 60 ? "timerDanger" : ""}`}>{formatTime(timeLeft)}</div>}
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
                                    <div className="statItem"><span className="statLabel">Zbývá</span><span className="statValue">{questionSet.length}</span></div>
                                    <div className="statItem"><span className="statLabel">Úspěšnost</span><span className="statValue">{score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%</span></div>
                                    {combo >= 3 && <div className="comboContainer"><div className="comboFlame">🔥</div><div className="comboCount">{combo}x</div></div>}
                                </div>
                            ) : (
                                <>
                                    <div className="progressBarContainer"><div className="progressBarFill" style={{ width: `${((currentIndex + 1) / questionSet.length) * 100}%` }}></div></div>
                                    <div className="progressText">Otázka {currentIndex + 1} / {questionSet.length}</div>
                                </>
                            )}

                            {/* --- KARTA OTÁZKY S DYNAMICKÝM STACK EFEKTEM --- */}
                            <div 
                                className={`card ${isFlashcardStyle(mode) || mode==='test_practice' ? `stacked-card ${stackLevelClass}` : ""} ${shake ? "shake" : ""}`} 
                                ref={cardRef}
                            >
                                {/* Obal s klíčem 'currentIndex' pro animaci příletu karty 
                                    ZMĚNA: Dynamická třída podle směru (direction) */}
                                <div 
                                    key={currentIndex} 
                                    className={
                                        exitDirection 
                                        ? (exitDirection === 'left' ? "card-exit-left" : "card-exit-right") 
                                        : ((isFlashcardStyle(mode) || mode==='test_practice') ? "" : (direction === "left" ? "card-enter-left" : "card-enter-animation"))
                                    } 
                                    style={{width: '100%'}}
                                >
                                    <QuestionCard
                                        currentQuestion={currentQuestion}
                                        mode={mode}
                                        showResult={showResult}
                                        selectedAnswer={selectedAnswer}
                                        onSelect={(i) => (isFlashcardStyle(mode) || mode==='test_practice') ? clickFlashcardAnswer(i) : handleAnswer(i)}
                                        optionRefsForCurrent={optionRefsForCurrent}
                                        disabled={(isFlashcardStyle(mode) || mode==='test_practice') && showResult}
                                        isKeyboardMode={isKeyboardMode}
                                        currentSubject={subject}
                                        onZoom={setFullscreenImage}
                                        onSwipe={handleSwipe}
                                        score={score}
                                        onReport={handleReportClick} // NOVÁ PROP - Předáváme funkci pro report
                                        isExiting={!!exitDirection} // <--- Skrytí ikony při animaci
                                    />
                                </div>

                                {/* Flashcard tlačítka - animovaná s kartou */}
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

                                {/* Navigace pro Trénink/Test - statická */}
                                {!(isFlashcardStyle(mode) || mode==='test_practice') && (
                                    <>
                                        <div className="actionButtons spaced">
                                            <button className="navButton" onClick={() => moveToQuestion(Math.max(0, currentIndex - 1))} disabled={currentIndex === 0}>Předchozí</button>
                                            <button className="navButton" onClick={() => moveToQuestion(currentIndex + 1)} disabled={currentIndex >= questionSet.length - 1}>Další</button>
                                        </div>
                                        <div className="navigatorPlaceholder">
                                            <Navigator questionSet={questionSet} currentIndex={currentIndex} setCurrentIndex={moveToQuestion} mode={mode} maxSeenIndex={mode === 'real_test' ? questionSet.length : maxSeenIndex} />
                                            {(mode === "mock" || mode === "real_test") && (
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