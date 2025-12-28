import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { clearImageCache } from '../utils/dataManager';

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

    // Session Management
    const [isSessionBlocked, setIsSessionBlocked] = useState(false);
    const [mySessionId, setMySessionId] = useState(null);
    const mySessionIdRef = useRef(null);

    // --- SESSION LOGIKA (Session Guard) ---
    useEffect(() => {
        if (!user || !dbId) return;

        // Inicializace relace
        const initSession = async () => {
            const newSessionId = crypto.randomUUID();
            setMySessionId(newSessionId);
            mySessionIdRef.current = newSessionId;
            await supabase.from("profiles").update({ active_session_id: newSessionId }).eq("id", dbId);
        };
        initSession();

        // Sledování změn v DB
        const channel = supabase.channel(`session_guard_${dbId}`).on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${dbId}` 
        }, (payload) => {
            const remoteSessionId = payload.new.active_session_id;
            if (remoteSessionId && mySessionIdRef.current && remoteSessionId !== mySessionIdRef.current) {
                setIsSessionBlocked(true);
            }
        }).subscribe();

        // Intervalová kontrola (fallback)
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

    const takeOverSession = async () => {
        if (!dbId) return;
        const newSessionId = crypto.randomUUID();
        setMySessionId(newSessionId);
        mySessionIdRef.current = newSessionId;
        setIsSessionBlocked(false);
        await supabase.from("profiles").update({ active_session_id: newSessionId }).eq("id", dbId);
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

            if (codeError || !codeData) { 
                throw new Error("Neplatný kód."); 
            }

            const identifiedUser = codeData.used_by || enteredCode;
            let { data: profileData } = await supabase
                .from("profiles")
                .select("*")
                .eq("username", identifiedUser)
                .single();

            // Pokud profil neexistuje, vytvoříme ho
            if (!profileData) {
                const { data: newData } = await supabase.from("profiles").insert([{ 
                    username: identifiedUser, 
                    mistakes: {}, 
                    history: [], 
                    subject_times: {}, 
                    question_counts: {}, 
                    test_practice_stats: {} 
                }]).select().single();
                profileData = newData;
            }

            // Nastavení stavu
            setDbId(profileData.id); 
            setMistakes(profileData.mistakes || {}); 
            setHistory(profileData.history || []); 
            setTotalTimeMap(profileData.subject_times || {}); 
            setTotalQuestionsMap(profileData.question_counts || {}); 
            setTestPracticeStats(profileData.test_practice_stats || {}); 
            setUser(identifiedUser);

            localStorage.setItem("quizio_user_code", enteredCode);
        } catch (err) { 
            alert("Chyba přihlášení: " + err.message); 
        } finally { 
            setLoading(false); 
        }
    };

    const logout = () => {
        clearImageCache();
        localStorage.removeItem("quizio_user_code");
        setUser(null); 
        setDbId(null); 
        setIsSessionBlocked(false);
    };

    // --- UKLÁDÁNÍ DAT (Univerzální funkce) ---
    const saveData = async (updates) => {
        if (!dbId) return;
        setSyncing(true);

        // Lokální update stavu (optimistické UI)
        if (updates.mistakes) setMistakes(updates.mistakes);
        if (updates.history) setHistory(updates.history);
        if (updates.testPracticeStats) setTestPracticeStats(updates.testPracticeStats);
        if (updates.subject_times) setTotalTimeMap(updates.subject_times);
        if (updates.question_counts) setTotalQuestionsMap(updates.question_counts);

        // Odeslání do DB
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
            const { data: profileData } = await supabase.from("profiles").select("*").eq("id", dbId).single();
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

    return {
        user, dbId, loading, syncing, isSessionBlocked,
        mistakes, history, testPracticeStats, totalTimeMap, totalQuestionsMap,
        login, logout, takeOverSession, saveData, refreshData,
        // Settery vystavujeme jen pokud je to nutné pro specifickou logiku v App
        setMistakes, setHistory, setTotalTimeMap, setTotalQuestionsMap
    };
}