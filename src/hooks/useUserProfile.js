import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { clearImageCache, clearLocalQuestionData } from '../utils/dataManager';

export function useUserProfile() {
    // --- STAV UŽIVATELE A DAT ---
    const [user, setUser] = useState(null);
    const [dbId, setDbId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Data uživatele
    const [mistakes, setMistakes] = useState({});
    const [history, setHistory] = useState([]);
    const [testPracticeStats, setTestPracticeStats] = useState({});
    const [totalTimeMap, setTotalTimeMap] = useState({});
    const [totalQuestionsMap, setTotalQuestionsMap] = useState({});

    // Kompletní profilová data (pro Smart session atd.)
    // Inicializujeme jako prázdný objekt, aby se dalo dělat ...prev
    const [profileData, setProfileData] = useState({});

    // Session Management
    const [isSessionBlocked, setIsSessionBlocked] = useState(false);
    const [mySessionId, setMySessionId] = useState(null);
    const mySessionIdRef = useRef(null);

    // --- 1. REF PRO GARANCI MINIMÁLNÍHO ČASU ---
    const minSyncTimeRef = useRef(0);
    const stopSyncTimeoutRef = useRef(null);

    // Clean-up při odmontování komponenty
    useEffect(() => {
        return () => {
            if (stopSyncTimeoutRef.current) {
                clearTimeout(stopSyncTimeoutRef.current);
            }
        };
    }, []);

    // Pomocná funkce pro start synchronizace (vizuál)
    const startVisualSync = () => {
        if (stopSyncTimeoutRef.current) {
            clearTimeout(stopSyncTimeoutRef.current);
            stopSyncTimeoutRef.current = null;
        }
        // Ikona svítí minimálně 500ms od teď
        minSyncTimeRef.current = Date.now() + 500;
        setSyncing(true);
    };

    // Pomocná funkce pro konec synchronizace (vizuál)
    const stopVisualSync = () => {
        const now = Date.now();
        const timeRemaining = minSyncTimeRef.current - now;

        if (timeRemaining > 0) {
            stopSyncTimeoutRef.current = setTimeout(() => {
                setSyncing(false);
            }, timeRemaining);
        } else {
            setSyncing(false);
        }
    };

    // --- SESSION LOGIKA (Session Guard) ---
    useEffect(() => {
        if (!user || !dbId) return;

        const initSession = async () => {
            const newSessionId = crypto.randomUUID();
            setMySessionId(newSessionId);
            mySessionIdRef.current = newSessionId;
            // Aktualizujeme session v DB bez triggerování loading stavu
            await supabase.from("profiles").update({ active_session_id: newSessionId }).eq("id", dbId);
        };
        initSession();

        const channel = supabase.channel(`session_guard_${dbId}`).on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${dbId}` 
        }, (payload) => {
            const remoteSessionId = payload.new.active_session_id;
            // Pokud přišla změna session ID a není to ta naše (a není null = logout), blokujeme
            if (remoteSessionId && mySessionIdRef.current && remoteSessionId !== mySessionIdRef.current) {
                console.warn("Detekována jiná aktivní session. Blokuji přístup.");
                setIsSessionBlocked(true);
            }
        }).subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, dbId]);

    // --- PŘEVZETÍ SESSION ---
    const takeOverSession = async () => {
        if (!dbId) return;
        setLoading(true);
        try {
            const newSessionId = crypto.randomUUID();
            setMySessionId(newSessionId);
            mySessionIdRef.current = newSessionId; // Důležité nastavit ref před voláním DB

            await supabase.from("profiles").update({ active_session_id: newSessionId }).eq("id", dbId);
            setIsSessionBlocked(false);
        } catch (err) {
            console.error("Chyba převzetí session:", err);
        } finally {
            setLoading(false);
        }
    };

    // --- PŘIHLÁŠENÍ & DATA ---
    const login = async (enteredCode) => {
        setLoading(true);
        try {
            const { data: codeData, error: codeError } = await supabase
                .from("access_codes")
                .select("*")
                .eq("code", enteredCode)
                .maybeSingle();

            if (codeError || !codeData) throw new Error("Neplatný přístupový kód."); 

            const identifiedUser = codeData.used_by || enteredCode;

            let { data: fetchedProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("username", identifiedUser)
                .maybeSingle();

            if (!fetchedProfile) {
                const { data: newData, error: createError } = await supabase.from("profiles").insert([{ 
                    username: identifiedUser, 
                    mistakes: {}, 
                    history: [], 
                    subject_times: {}, 
                    question_counts: {}, 
                    test_practice_stats: {},
                    smart_session: {}, // Inicializace smart session
                    active_session_id: crypto.randomUUID()
                }]).select().single();

                if (createError) throw createError;
                fetchedProfile = newData;
            }

            // Nastavení stavů
            setDbId(fetchedProfile.id); 
            setMistakes(fetchedProfile.mistakes || {}); 
            setHistory(fetchedProfile.history || []); 
            setTotalTimeMap(fetchedProfile.subject_times || {}); 
            setTotalQuestionsMap(fetchedProfile.question_counts || {}); 
            setTestPracticeStats(fetchedProfile.test_practice_stats || {}); 
            setProfileData(fetchedProfile || {}); // Důležité pro Smart Session (zajištěno, že není null)
            setUser(fetchedProfile.username);

            localStorage.setItem("quizio_user_code", enteredCode);
            setIsSessionBlocked(false);

        } catch (err) { 
            console.error("Chyba přihlášení:", err);
            alert("Chyba přihlášení: " + (err.message || "Neznámá chyba")); 
        } finally { 
            setLoading(false); 
        }
    };

    const logout = async () => {
        if (dbId) {
            await supabase.from('profiles').update({ active_session_id: null }).eq('id', dbId);
        }
        clearImageCache();
        clearLocalQuestionData();
        localStorage.removeItem("quizio_user_code");

        setUser(null); 
        setDbId(null); 
        setIsSessionBlocked(false);
        setMistakes({});
        setHistory([]);
        setProfileData({}); // Reset na prázdný objekt, ne null
    };

    // --- UKLÁDÁNÍ DAT (Upraveno pro Deep Merge smart_session) ---
    const saveData = async (updates) => {
        if (!dbId || isSessionBlocked) return;

        startVisualSync();

        // 1. Optimistický update lokálních stavů (pro okamžitou odezvu UI)
        if (updates.mistakes) setMistakes(updates.mistakes);
        if (updates.history) setHistory(updates.history);
        if (updates.test_practice_stats) setTestPracticeStats(updates.test_practice_stats);
        if (updates.subject_times) setTotalTimeMap(updates.subject_times);
        if (updates.question_counts) setTotalQuestionsMap(updates.question_counts);

        // 2. Aktualizace celkového profilu (např. smart_session)
        // ZDE JE KLÍČOVÁ ZMĚNA: Deep Merge pro smart_session
        setProfileData(prev => {
            // Pokud aktualizujeme smart_session, musíme udělat merge s předchozím stavem uvnitř smart_session,
            // aby se nepřepsaly ostatní předměty.
            if (updates.smart_session) {
                // updates.smart_session už obvykle z App.js chodí sloučené (tam děláme ...existingSessions),
                // ale pro jistotu zde spoléháme na to, že updates obsahuje finální podobu objektu smart_session,
                // kterou chceme uložit.
                // V App.js: const updatedSessions = { ...existingSessions, [subject]: sessionData };
                // Takže zde stačí prostý merge na úrovni rootu.
                return {
                    ...prev,
                    ...updates
                };
            }
            // Pro ostatní updates (mistakes atd.) stačí mělký merge
            return { ...prev, ...updates };
        });

        try {
            await supabase.from("profiles").update(updates).eq("id", dbId);
        } catch (err) {
            console.error("Chyba při ukládání:", err);
            // Zde by šlo implementovat rollback stavu, pokud by to bylo kritické
        } finally {
            stopVisualSync();
        }
    };

    // Obnovení dat z DB
    const refreshData = async () => {
        if (!dbId) return;
        startVisualSync();
        try {
            const { data: fetchedProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", dbId)
                .single();

            if (fetchedProfile) {
                setHistory(fetchedProfile.history || []); 
                setTotalTimeMap(fetchedProfile.subject_times || {}); 
                setTotalQuestionsMap(fetchedProfile.question_counts || {}); 
                setMistakes(fetchedProfile.mistakes || {});
                setTestPracticeStats(fetchedProfile.test_practice_stats || {});
                setProfileData(fetchedProfile || {}); // Aktualizace smart_session atd.
            }
        } catch (err) {
             console.error("Chyba při refreshData:", err);
        } finally {
            stopVisualSync();
        }
    };

    // Fake sync
    const triggerFakeSync = () => {
        startVisualSync();
        stopVisualSync();
    };

    return {
        user, dbId, loading, syncing, isSessionBlocked,
        mistakes, history, testPracticeStats, totalTimeMap, totalQuestionsMap,
        profileData, // Exportujeme i celá data pro logiku Smart Session
        login, logout, takeOverSession, saveData, refreshData, triggerFakeSync,
        setMistakes, setHistory, setTotalTimeMap, setTotalQuestionsMap
    };
}