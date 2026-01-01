import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { clearImageCache, clearLocalQuestionData } from '../utils/dataManager';

export function useUserProfile() {
    // --- STAV UŽIVATELE A DAT ---
    const [user, setUser] = useState(null); // Jméno uživatele
    const [dbId, setDbId] = useState(null); // UUID v databázi (tabulka profiles)
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Data uživatele
    const [mistakes, setMistakes] = useState({});
    const [history, setHistory] = useState([]);
    const [testPracticeStats, setTestPracticeStats] = useState({});
    const [totalTimeMap, setTotalTimeMap] = useState({});
    const [totalQuestionsMap, setTotalQuestionsMap] = useState({});

    // Session Management
    const [isSessionBlocked, setIsSessionBlocked] = useState(false);
    const [mySessionId, setMySessionId] = useState(null);
    const mySessionIdRef = useRef(null);

    // --- SESSION LOGIKA (Session Guard) ---
    useEffect(() => {
        if (!user || !dbId) return;

        // 1. Inicializace relace
        const initSession = async () => {
            const newSessionId = crypto.randomUUID();
            setMySessionId(newSessionId);
            mySessionIdRef.current = newSessionId;

            // Zapíšeme naše session ID do databáze (zabíráme si účet)
            await supabase.from("profiles").update({ active_session_id: newSessionId }).eq("id", dbId);
        };
        initSession();

        // 2. Realtime sledování (Hlavní a jediná ochrana)
        const channel = supabase.channel(`session_guard_${dbId}`).on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${dbId}` 
        }, (payload) => {
            const remoteSessionId = payload.new.active_session_id;
            // Pokud se active_session_id změnilo a NENÍ to naše ID => někdo nás vyhodil (přihlásil se jinde)
            if (remoteSessionId && mySessionIdRef.current && remoteSessionId !== mySessionIdRef.current) {
                console.warn("Detekována jiná aktivní session (Realtime). Blokuji přístup.");
                setIsSessionBlocked(true);
            }
        }).subscribe();

        // Intervalová kontrola (polling) byla ODSTRANĚNA pro maximální úsporu requestů.

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
            mySessionIdRef.current = newSessionId;

            // Vyhodíme toho druhého tím, že přepíšeme session ID na naše nové
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
            // A) Zkusíme najít kód v tabulce access_codes (OCHRANA)
            const { data: codeData, error: codeError } = await supabase
                .from("access_codes")
                .select("*")
                .eq("code", enteredCode)
                .maybeSingle();

            if (codeError || !codeData) { 
                throw new Error("Neplatný přístupový kód."); 
            }

            // B) Určíme identitu uživatele
            const identifiedUser = codeData.used_by || enteredCode;

            // C) Najdeme nebo vytvoříme profil v tabulce profiles
            let { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("username", identifiedUser)
                .maybeSingle();

            if (!profileData) {
                // Pokud profil neexistuje, vytvoříme ho
                const { data: newData, error: createError } = await supabase.from("profiles").insert([{ 
                    username: identifiedUser, 
                    mistakes: {}, 
                    history: [], 
                    subject_times: {}, 
                    question_counts: {}, 
                    test_practice_stats: {},
                    active_session_id: crypto.randomUUID() // Hned vygenerujeme ID
                }]).select().single();

                if (createError) throw createError;
                profileData = newData;
            }

            // D) Nastavení stavu aplikace
            setDbId(profileData.id); 
            setMistakes(profileData.mistakes || {}); 
            setHistory(profileData.history || []); 
            setTotalTimeMap(profileData.subject_times || {}); 
            setTotalQuestionsMap(profileData.question_counts || {}); 
            setTestPracticeStats(profileData.test_practice_stats || {}); 
            setUser(profileData.username);

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
            // Při odhlášení smažeme session ID
            await supabase.from('profiles').update({ active_session_id: null }).eq('id', dbId);
        }

        clearImageCache();
        clearLocalQuestionData(); // Důležité: Smaže offline otázky pro bezpečnost
        localStorage.removeItem("quizio_user_code");

        setUser(null); 
        setDbId(null); 
        setIsSessionBlocked(false);
        setMistakes({});
        setHistory([]);
    };

    // --- UKLÁDÁNÍ DAT ---
    const saveData = async (updates) => {
        if (!dbId || isSessionBlocked) return;
        setSyncing(true);

        // Optimistický update
        if (updates.mistakes) setMistakes(updates.mistakes);
        if (updates.history) setHistory(updates.history);
        if (updates.test_practice_stats) setTestPracticeStats(updates.test_practice_stats);
        if (updates.subject_times) setTotalTimeMap(updates.subject_times);
        if (updates.question_counts) setTotalQuestionsMap(updates.question_counts);

        try {
            await supabase.from("profiles").update(updates).eq("id", dbId);
        } catch (err) {
            console.error("Chyba při ukládání:", err);
        } finally {
            setSyncing(false);
        }
    };

    // Obnovení dat z DB (Refresh)
    const refreshData = async () => {
        if (!dbId) return;
        setSyncing(true);
        try {
            const { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", dbId)
                .single();

            if (profileData) {
                setHistory(profileData.history || []); 
                setTotalTimeMap(profileData.subject_times || {}); 
                setTotalQuestionsMap(profileData.question_counts || {}); 
                setMistakes(profileData.mistakes || {});
                setTestPracticeStats(profileData.test_practice_stats || {});
            }
        } catch (err) {
             console.error("Chyba při refreshData:", err);
        } finally {
            setSyncing(false);
        }
    };

    // Fake sync pro správné odpovědi (aby uživatel nemohl podvádět sledováním ikony)
    const triggerFakeSync = () => {
        setSyncing(true);
        setTimeout(() => setSyncing(false), 500);
    };

    return {
        user, dbId, loading, syncing, isSessionBlocked,
        mistakes, history, testPracticeStats, totalTimeMap, totalQuestionsMap,
        login, logout, takeOverSession, saveData, refreshData, triggerFakeSync,
        setMistakes, setHistory, setTotalTimeMap, setTotalQuestionsMap
    };
}