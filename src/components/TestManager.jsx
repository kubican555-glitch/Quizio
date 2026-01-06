import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { SubjectBadge } from './SubjectBadge';
import { ConfirmModal } from './Modals';

// Styl pro overlay (pouze pro detail studenta a formuláře, ne pro seznam výsledků)
const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflowY: 'auto',
    padding: '1rem'
};

export function TestManager({ onBack, subject, isTeacher }) {
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [editingTestId, setEditingTestId] = useState(null);

    // --- STAVY PRO ZOBRAZENÍ VÝSLEDKŮ (NYNÍ JAKO STRÁNKA) ---
    const [resultsViewOpen, setResultsViewOpen] = useState(false); // Přejmenováno z resultsModalOpen pro jasnost
    const [viewingTestId, setViewingTestId] = useState(null);
    const [currentTestResults, setCurrentTestResults] = useState([]); 

    // --- STAV PRO DETAIL KONKRÉTNÍHO ŽÁKA (MODAL) ---
    const [viewingResult, setViewingResult] = useState(null);

    const [formData, setFormData] = useState({
        title: '', open_at: '', close_at: '', time_limit: 30, question_count: 20, topic_range_start: 1, topic_range_end: 50
    });

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [confirmDeleteResultId, setConfirmDeleteResultId] = useState(null); 

    // --- EFEKT PRO ZABLOKOVÁNÍ SCROLLOVÁNÍ ---
    useEffect(() => {
        // Blokujeme scroll jen pro "opravdové" modaly (Detail studenta, Form, Delete), ne pro stránku s výsledky
        const isAnyModalOpen = viewingResult || showForm || confirmDeleteId || confirmDeleteResultId;

        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [viewingResult, showForm, confirmDeleteId, confirmDeleteResultId]);

    // --- NAČÍTÁNÍ SEZNAMU TESTŮ ---
    useEffect(() => {
        if (!subject) return;
        fetchTests();
        const subscription = supabase.channel('teacher_tests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_tests' }, fetchTests)
            .subscribe();
        return () => supabase.removeChannel(subscription);
    }, [subject]);

    const fetchTests = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('scheduled_tests')
            .select('*')
            .eq('subject', subject)
            .order('created_at', { ascending: false });
        if (error) console.error("Chyba:", error);
        else setTests(data || []);
        setLoading(false);
    };

    // --- HLAVNÍ FUNKCE: PŘEPNUTÍ NA STRÁNKU VÝSLEDKŮ ---
    const openResultsPage = async (testId) => {
        setViewingTestId(testId);
        setResultsViewOpen(true); // Přepne zobrazení na "stránku" výsledků
        await fetchResultsForPage(testId);
    };

    const fetchResultsForPage = async (testId) => {
        try {
            // 1. Získáme seznam VŠECH studentů
            const { data: codes, error: codesError } = await supabase
                .from('access_codes')
                .select('used_by')
                .not('used_by', 'is', null);

            if (codesError) throw codesError;

            const allStudentNames = [...new Set(codes.map(c => c.used_by))];

            // 2. Získáme výsledky
            const { data: results, error: resultsError } = await supabase
                .from('test_results')
                .select('*')
                .eq('test_id', testId);

            if (resultsError) throw resultsError;

            // 3. Sjednotíme
            let mergedData = allStudentNames.map(studentName => {
                const result = results.find(r => r.student_name === studentName);
                if (result) {
                    return result; 
                } else {
                    return {
                        id: `placeholder_${studentName}`,
                        student_name: studentName,
                        status: 'not_started',
                        score_correct: 0, score_total: 0, time_spent: 0, answers: []
                    };
                }
            });

            // 4. Přidáme zbylé
            results.forEach(res => {
                if (!mergedData.find(m => m.student_name === res.student_name)) {
                    mergedData.push(res);
                }
            });

            // 5. Filtrace a řazení
            mergedData = mergedData.filter(res => {
                const parts = res.student_name ? res.student_name.trim().split(/[ _]+/) : [];
                return parts.length === 2;
            });

            mergedData.sort((a, b) => {
                const partsA = a.student_name.trim().split(/[ _]+/);
                const partsB = b.student_name.trim().split(/[ _]+/);
                const surnameA = partsA[1] ? partsA[1].toLowerCase() : "";
                const surnameB = partsB[1] ? partsB[1].toLowerCase() : "";
                return surnameA.localeCompare(surnameB, 'cs');
            });

            setCurrentTestResults(mergedData);

        } catch (err) {
            console.error("Chyba při načítání výsledků:", err);
        }
    };

    // --- REALTIME ---
    useEffect(() => {
        if (!resultsViewOpen || !viewingTestId) return;

        const channel = supabase
            .channel(`realtime_results_${viewingTestId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', 
                    schema: 'public',
                    table: 'test_results',
                    filter: `test_id=eq.${viewingTestId}` 
                },
                (payload) => {
                    fetchResultsForPage(viewingTestId);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [resultsViewOpen, viewingTestId]);

    // --- MAZÁNÍ ---
    const handleDeleteTest = async () => {
        if (!confirmDeleteId) return;
        await supabase.from('scheduled_tests').delete().eq('id', confirmDeleteId);
        setConfirmDeleteId(null);
        setTests(prev => prev.filter(t => t.id !== confirmDeleteId));
    };

    const handleDeleteResult = async () => {
        if (!confirmDeleteResultId) return;
        const { error } = await supabase.from('test_results').delete().eq('id', confirmDeleteResultId);
        if (error) {
            alert("Chyba při mazání: " + error.message);
        } else {
            if (viewingResult && viewingResult.id === confirmDeleteResultId) setViewingResult(null);
            if (viewingTestId) await fetchResultsForPage(viewingTestId);
        }
        setConfirmDeleteResultId(null);
    };

    // --- HELPERS ---
    const toLocalISO = (date) => {
        if (!date) return ''; 
        const d = new Date(date);
        const pad = (num) => (num < 10 ? '0' : '') + num;
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    };
    const openNewForm = () => { setEditingTestId(null); setFormData({ title: '', open_at: '', close_at: '', time_limit: 30, question_count: 20, topic_range_start: 1, topic_range_end: 50 }); setShowForm(true); };
    const openEditForm = (test) => { setEditingTestId(test.id); setFormData({ title: test.title, open_at: test.open_at ? toLocalISO(test.open_at) : '', close_at: test.close_at ? toLocalISO(test.close_at) : '', time_limit: test.time_limit, question_count: test.question_count, topic_range_start: test.topic_range_start, topic_range_end: test.topic_range_end }); setShowForm(true); };
    const getLetter = (index) => { if (index === null || index === undefined) return '?'; return "ABCD"[index] || '?'; };
    const handleSaveTest = async (e) => {
        e.preventDefault();
        const payload = { ...formData, subject: subject, open_at: formData.open_at ? new Date(formData.open_at).toISOString() : null, close_at: formData.close_at ? new Date(formData.close_at).toISOString() : null };
        if (editingTestId) await supabase.from('scheduled_tests').update(payload).eq('id', editingTestId);
        else await supabase.from('scheduled_tests').insert([payload]);
        setShowForm(false); fetchTests();
    };
    const formatDate = (dateString) => {
        if (!dateString) return <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Neurčeno</span>;
        return new Date(dateString).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // Pomocná pro získání názvu aktuálního testu
    const getCurrentTestTitle = () => {
        const t = tests.find(test => test.id === viewingTestId);
        return t ? t.title : 'Výsledky testu';
    };

    // --- 1. POHLED: MODAL S DETAILEM ODPOVĚDÍ (ZŮSTÁVÁ MODAL) ---
    const renderDetailModal = () => (
        viewingResult && (
            <div style={overlayStyle} onClick={(e) => { if(e.target === e.currentTarget) setViewingResult(null); }}>
                <div className="modal fadeIn" style={{ maxWidth: '500px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text-main)' }}>👤 {viewingResult.student_name.replace('_', ' ')}</h2>
                        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginTop: '0.3rem' }}>Úspěšnost: <span style={{ fontWeight: 'bold' }}>{Math.round((viewingResult.score_correct / viewingResult.score_total) * 100)}%</span></div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {(!viewingResult.answers || viewingResult.answers.length === 0) ? <div style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>Detailní odpovědi nejsou k dispozici.</div> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {viewingResult.answers.map((ans, idx) => {
                                    const isCorrect = ans.user === ans.correct;
                                    const isUnanswered = ans.user === null || ans.user === undefined;
                                    let bgStyle = isCorrect ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                                    let borderStyle = isCorrect ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                                    if (isUnanswered) { bgStyle = 'rgba(0, 0, 0, 0.03)'; borderStyle = 'rgba(0, 0, 0, 0.1)'; }
                                    return (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', borderRadius: '8px', background: bgStyle, border: `1px solid ${borderStyle}` }}>
                                            <div style={{ fontWeight: '600', color: 'var(--color-text-main)' }}>Otázka {ans.qNum || idx + 1}</div>
                                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                                                {isCorrect ? <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>✅ {getLetter(ans.user)}</span> : isUnanswered ? <><span style={{ color: 'var(--color-text-secondary)', opacity: 0.5, fontStyle: 'italic' }}>Neodpovězeno</span><span style={{ color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>→ {getLetter(ans.correct)}</span></> : <><span style={{ color: 'var(--color-error)', textDecoration: 'line-through' }}>{getLetter(ans.user)}</span><span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>→ {getLetter(ans.correct)}</span></>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <button className="navButton" style={{ marginTop: '1rem', width: '100%' }} onClick={() => setViewingResult(null)}>Zavřít</button>
                </div>
            </div>
        )
    );

    // --- 2. POHLED: STRÁNKA S VÝSLEDKY ---
    if (resultsViewOpen) {
        return (
            <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
                {renderDetailModal()}
                {confirmDeleteResultId && <ConfirmModal title="Resetovat pokus?" message="Tímto smažete záznam studenta. Bude moci test vyplnit znovu." onCancel={() => setConfirmDeleteResultId(null)} onConfirm={handleDeleteResult} confirmText="Smazat pokus" danger={true} />}

                <div className="top-navbar">
                    <div className="navbar-group">
                        <button className="menuBackButton" onClick={() => setResultsViewOpen(false)}>
                            <span style={{ fontSize: '1.2rem', marginRight: '0.2rem' }}>←</span>
                            <span className="mobile-hide-text">Zpět na testy</span>
                        </button>
                    </div>
                    <div className="navbar-group">
                        <button className="menuBackButton" onClick={() => fetchResultsForPage(viewingTestId)} title="Obnovit data">🔄</button>
                    </div>
                </div>

                <div className="quizContentWrapper">
                    <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', textAlign: 'center' }}>
                         <h1 className="title" style={{ marginBottom: '0.2rem' }}>{getCurrentTestTitle()}</h1>

                         {/* STATISTIKY */}
                         <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
                            {(() => {
                                const writingCount = currentTestResults.filter(r => r.status === 'running' || r.status === 'in_progress').length;
                                const finishedCount = currentTestResults.filter(r => r.status === 'completed' || (r.status !== 'not_started' && r.status !== 'running' && r.status !== 'in_progress')).length;

                                return (
                                    <>
                                        {writingCount > 0 && (
                                            <div className="pulse-animation" style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontSize: '0.85rem', fontWeight: '700', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                                                ✍️ Píše: {writingCount}
                                            </div>
                                        )}
                                        {finishedCount > 0 && (
                                            <div style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', fontSize: '0.85rem', fontWeight: '700', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                                ✅ Odevzdáno: {finishedCount}
                                            </div>
                                        )}
                                        {writingCount === 0 && finishedCount === 0 && <span style={{color: 'var(--color-text-secondary)', fontStyle: 'italic'}}>Zatím žádná aktivita</span>}
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    <div style={{ background: 'var(--color-card-bg)', borderRadius: '20px', padding: '1rem', border: '1px solid var(--color-card-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                         {currentTestResults.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Zatím žádná data.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.8rem' }}>
                                {currentTestResults.map(res => {
                                    const isNotStarted = res.status === 'not_started';
                                    const isRunning = res.status === 'running' || res.status === 'in_progress' || (res.score_total > 0 && res.time_spent === 0 && (!res.answers || res.answers.length === 0));

                                    const percent = res.score_total > 0 ? Math.round((res.score_correct / res.score_total) * 100) : 0;
                                    let grade = 5; let gradeColor = '#ef4444';
                                    if (percent >= 84) { grade = 1; gradeColor = '#22c55e'; }
                                    else if (percent >= 67) { grade = 2; gradeColor = '#84cc16'; }
                                    else if (percent >= 50) { grade = 3; gradeColor = '#eab308'; }
                                    else if (percent >= 33) { grade = 4; gradeColor = '#f97316'; }

                                    let bg = 'var(--color-bg)'; let border = '1px solid var(--color-border)';
                                    if (isRunning) { bg = 'rgba(59, 130, 246, 0.05)'; border = '1px solid rgba(59, 130, 246, 0.3)'; }
                                    else if (isNotStarted) { bg = 'rgba(0, 0, 0, 0.02)'; border = '1px dashed var(--color-border)'; }

                                    return (
                                        <div key={res.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: bg, border: border, padding: '0.8rem 1rem', borderRadius: '10px', opacity: isNotStarted ? 0.7 : 1 }}>
                                            <div>
                                                <div style={{ fontWeight: '700', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: isNotStarted ? 'var(--color-text-secondary)' : 'var(--color-text-main)' }}>
                                                    {res.student_name.replace('_', ' ')}
                                                    {isRunning && <span title="Právě vyplňuje" className="pulse-animation" style={{ fontSize: '0.9rem' }}>✍️</span>}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px', textAlign: 'left' }}>
                                                    {isRunning ? <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>Test probíhá...</span> : isNotStarted ? <span style={{ opacity: 0.5 }}>---</span> : <>Čas: {Math.floor(res.time_spent / 60)}m {res.time_spent % 60}s</>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                {isNotStarted ? (
                                                    <div style={{ textAlign: 'right', opacity: 0.6 }}><div style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>Nezačal/a</div></div>
                                                ) : isRunning ? (
                                                    null 
                                                ) : (
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: gradeColor }}>{percent}% <span style={{ fontSize: '0.8em', opacity: 0.8, marginLeft: '0.2rem' }}>({grade})</span></div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{res.score_correct} / {res.score_total} b</div>
                                                    </div>
                                                )}
                                                {!isRunning && !isNotStarted && (
                                                    <button className="btn-icon" onClick={() => setViewingResult(res)} title="Zobrazit odpovědi" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-main)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }}>👁️</button>
                                                )}
                                                {!isNotStarted && (
                                                    <button className="btn-icon" onClick={() => setConfirmDeleteResultId(res.id)} title="Smazat pokus (reset)" style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: '1.1rem', padding: '0.5rem', opacity: 0.6 }}>🗑️</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // --- 3. POHLED: HLAVNÍ SEZNAM TESTŮ ---
    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
            {confirmDeleteId && <ConfirmModal title="Smazat test?" message="Opravdu chcete smazat tento test a všechny jeho výsledky?" onCancel={() => setConfirmDeleteId(null)} onConfirm={handleDeleteTest} confirmText="Smazat" danger={true} />}

            {/* Renderování detailu studenta (je zde, aby fungovalo i kdyby se omylem vyvolalo, ale logicky patří spíš do results page) */}
            {renderDetailModal()}

            {/* HLAVNÍ NAVBAR */}
            <div className="top-navbar">
                <div className="navbar-group"><button className="menuBackButton" onClick={onBack}><span style={{ fontSize: '1.2rem', marginRight: '0.2rem' }}>←</span><span className="mobile-hide-text">Zpět</span></button><div className="mobile-hidden"><SubjectBadge subject={subject} compact /></div></div>
                <div className="navbar-group"><button className="menuBackButton" onClick={() => { fetchTests(); }} title="Obnovit" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>🔄</button><button className="navButton primary" onClick={openNewForm} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', minHeight: 'auto' }}>+ Nový test</button></div>
            </div>

            <div className="quizContentWrapper">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}><h1 className="title" style={{ marginBottom: '0.5rem' }}>Správa testů</h1><p className="subtitle">Administrace písemek pro {subject}</p></div>

                {/* FORMULÁŘ (MODAL) */}
                {showForm && (
                    <div style={overlayStyle} onClick={(e) => { if(e.target === e.currentTarget) setShowForm(false); }}>
                        <div className="modal fadeIn" style={{ maxWidth: '600px', width: '95%', textAlign: 'left' }}>
                            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>{editingTestId ? 'Upravit test' : 'Naplánovat novou písemku'}</h2>
                            <form onSubmit={handleSaveTest} style={{ display: 'grid', gap: '1rem' }}>
                                <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Název testu</label><input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="form-input-style" placeholder="např. Pololetní písemka" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} /></div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Od (volitelné)</label><input type="datetime-local" value={formData.open_at} onChange={e => setFormData({...formData, open_at: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} /></div>
                                    <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Do (volitelné)</label><input type="datetime-local" value={formData.close_at} onChange={e => setFormData({...formData, close_at: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} /></div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Limit (min)</label><input type="number" min="1" required value={formData.time_limit} onChange={e => setFormData({...formData, time_limit: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} /></div>
                                    <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Počet otázek</label><input type="number" min="1" required value={formData.question_count} onChange={e => setFormData({...formData, question_count: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} /></div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Rozsah OD</label><input type="number" min="1" required value={formData.topic_range_start} onChange={e => setFormData({...formData, topic_range_start: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} /></div>
                                    <div><label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Rozsah DO</label><input type="number" min="1" required value={formData.topic_range_end} onChange={e => setFormData({...formData, topic_range_end: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} /></div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}><button type="button" className="navButton" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Zrušit</button><button type="submit" className="navButton primary" style={{ flex: 1 }}>{editingTestId ? 'Uložit změny' : 'Vytvořit test'}</button></div>
                            </form>
                        </div>
                    </div>
                )}

                {loading ? <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>Načítám testy...</div> : tests.length === 0 ? <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)", background: "var(--color-card-bg)", borderRadius: "24px", border: "1px solid var(--color-card-border)" }}><div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.8 }}>📭</div>Žádné naplánované testy.</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {tests.map(test => {
                            const now = new Date(); const hasDates = test.open_at && test.close_at; const isOpen = hasDates && now >= new Date(test.open_at) && now <= new Date(test.close_at); const isClosed = hasDates && now > new Date(test.close_at);
                            let statusConfig = { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", text: "Budoucí" };
                            if (!hasDates) statusConfig = { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)", text: "Datum neurčeno" }; else if (isOpen) statusConfig = { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)", text: "Probíhá" }; else if (isClosed) statusConfig = { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)", text: "Uzavřeno" };
                            return (
                                <div key={test.id} className="reviewCard" style={{ padding: '0', borderRadius: '20px', overflow: 'hidden', border: `1px solid var(--color-card-border)`, background: 'var(--color-card-bg)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: statusConfig.color }}></div>
                                    <div style={{ padding: '1.5rem', paddingLeft: '1.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}><h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text-main)' }}>{test.title}</h3><span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', background: statusConfig.bg, color: statusConfig.color }}>{statusConfig.text}</span></div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}><div>📅 {formatDate(test.open_at)} - {formatDate(test.close_at)}</div><div>⚙️ {test.question_count} otázek (rozsah {test.topic_range_start}-{test.topic_range_end}), limit {test.time_limit} min</div></div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            <button className="navButton" onClick={() => openResultsPage(test.id)} style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}>Výsledky</button>
                                            <button className="navButton" onClick={() => openEditForm(test)} style={{ padding: '0.6rem', color: 'var(--color-primary-light)', borderColor: 'rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.1)' }} title="Upravit test">✏️</button>
                                            <button className="navButton" onClick={() => setConfirmDeleteId(test.id)} style={{ padding: '0.6rem', color: 'var(--color-error)', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)' }} title="Smazat test">🗑️</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}