import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { SubjectBadge } from './SubjectBadge';
import { ConfirmModal } from './Modals';

export function TestManager({ onBack, subject, isTeacher }) {
    const [tests, setTests] = useState([]);
    const [results, setResults] = useState({});
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [editingTestId, setEditingTestId] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        open_at: '',
        close_at: '',
        time_limit: 30,
        question_count: 20,
        topic_range_start: 1,
        topic_range_end: 50
    });

    const [expandedTestId, setExpandedTestId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [confirmDeleteResultId, setConfirmDeleteResultId] = useState(null); 

    // --- NAČÍTÁNÍ DAT ---
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

        if (error) console.error("Chyba při stahování testů:", error);
        else setTests(data || []);
        setLoading(false);
    };

    const fetchResults = async (testId) => {
        const { data, error } = await supabase
            .from('test_results')
            .select('*')
            .eq('test_id', testId)
            .order('score_correct', { ascending: false });

        if (!error) {
            setResults(prev => ({ ...prev, [testId]: data }));
        }
    };

    const toggleExpand = (testId) => {
        if (expandedTestId === testId) {
            setExpandedTestId(null);
        } else {
            setExpandedTestId(testId);
            fetchResults(testId);
        }
    };

    // --- MAZÁNÍ TESTU ---
    const handleDeleteTest = async () => {
        if (!confirmDeleteId) return;
        await supabase.from('scheduled_tests').delete().eq('id', confirmDeleteId);
        setConfirmDeleteId(null);
        setTests(prev => prev.filter(t => t.id !== confirmDeleteId));
    };

    // --- MAZÁNÍ VÝSLEDKU (RESETOVÁNÍ POKUSU) ---
    const handleDeleteResult = async () => {
        if (!confirmDeleteResultId) return;

        const { error } = await supabase.from('test_results').delete().eq('id', confirmDeleteResultId);

        if (error) {
            alert("Chyba při mazání: " + error.message);
        } else {
            setResults(prev => {
                const newState = { ...prev };
                for (const tId in newState) {
                    newState[tId] = newState[tId].filter(r => r.id !== confirmDeleteResultId);
                }
                return newState;
            });
        }
        setConfirmDeleteResultId(null);
    };

    // --- FORM HELPERS ---
    const toLocalISO = (date) => {
        if (!date) return ''; 
        const d = new Date(date);
        const pad = (num) => (num < 10 ? '0' : '') + num;
        return d.getFullYear() +
            '-' + pad(d.getMonth() + 1) +
            '-' + pad(d.getDate()) +
            'T' + pad(d.getHours()) +
            ':' + pad(d.getMinutes());
    };

    const openNewForm = () => {
        setEditingTestId(null);
        setFormData({
            title: '',
            open_at: '', 
            close_at: '',
            time_limit: 30,
            question_count: 20,
            topic_range_start: 1,
            topic_range_end: 50
        });
        setShowForm(true);
    };

    const openEditForm = (test) => {
        setEditingTestId(test.id);
        setFormData({
            title: test.title,
            open_at: test.open_at ? toLocalISO(test.open_at) : '',
            close_at: test.close_at ? toLocalISO(test.close_at) : '',
            time_limit: test.time_limit,
            question_count: test.question_count,
            topic_range_start: test.topic_range_start,
            topic_range_end: test.topic_range_end
        });
        setShowForm(true);
    };

    // --- ULOŽENÍ (CREATE / UPDATE) ---
    const handleSaveTest = async (e) => {
        e.preventDefault();

        const payload = {
            ...formData,
            subject: subject,
            open_at: formData.open_at ? new Date(formData.open_at).toISOString() : null,
            close_at: formData.close_at ? new Date(formData.close_at).toISOString() : null
        };

        let error;

        if (editingTestId) {
            const res = await supabase.from('scheduled_tests').update(payload).eq('id', editingTestId);
            error = res.error;
        } else {
            const res = await supabase.from('scheduled_tests').insert([payload]);
            error = res.error;
        }

        if (error) {
            alert("Chyba při ukládání: " + error.message);
        } else {
            setShowForm(false);
            fetchTests();
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Neurčeno</span>;
        return new Date(dateString).toLocaleString('cs-CZ', { 
            day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
    };

    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
            {/* Modal pro smazání testu */}
            {confirmDeleteId && (
                <ConfirmModal 
                    title="Smazat test?" 
                    message="Opravdu chcete smazat tento test a všechny jeho výsledky?" 
                    onCancel={() => setConfirmDeleteId(null)} 
                    onConfirm={handleDeleteTest} 
                    confirmText="Smazat" 
                    danger={true} 
                />
            )}

            {/* NOVÉ: Modal pro smazání výsledku (reset pokusu) */}
            {confirmDeleteResultId && (
                <ConfirmModal 
                    title="Resetovat pokus?" 
                    message="Tímto smažete odevzdaný test studenta. Student bude moci test vyplnit znovu. Pokračovat?" 
                    onCancel={() => setConfirmDeleteResultId(null)} 
                    onConfirm={handleDeleteResult} 
                    confirmText="Smazat pokus" 
                    danger={true} 
                />
            )}

            {/* --- TOP NAVBAR --- */}
            <div className="top-navbar">
                <div className="navbar-group">
                    <button className="menuBackButton" onClick={onBack}>
                        <span style={{ fontSize: '1.2rem', marginRight: '0.2rem' }}>←</span>
                        <span className="mobile-hide-text">Zpět</span>
                    </button>
                    <div className="mobile-hidden">
                        <SubjectBadge subject={subject} compact />
                    </div>
                </div>
                <div className="navbar-group">
                    {/* TLAČÍTKO OBNOVIT */}
                    <button 
                        className="menuBackButton" 
                        onClick={() => { fetchTests(); if(expandedTestId) fetchResults(expandedTestId); }}
                        title="Obnovit"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                        🔄
                    </button>

                     <button 
                        className="navButton primary" 
                        onClick={openNewForm}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', minHeight: 'auto' }}
                    >
                        + Nový test
                    </button>
                </div>
            </div>

            <div className="quizContentWrapper">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 className="title" style={{ marginBottom: '0.5rem' }}>Správa testů</h1>
                    <p className="subtitle">Administrace písemek pro {subject}</p>
                </div>

                {/* --- MODÁLNÍ OKNO FORMULÁŘE --- */}
                {showForm && (
                    <div className="modalOverlay" onClick={(e) => { if(e.target === e.currentTarget) setShowForm(false); }}>
                        <div className="modal fadeIn" style={{ maxWidth: '600px', width: '95%', textAlign: 'left' }}>
                            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                                {editingTestId ? 'Upravit test' : 'Naplánovat novou písemku'}
                            </h2>
                            <form onSubmit={handleSaveTest} style={{ display: 'grid', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Název testu</label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={formData.title} 
                                        onChange={e => setFormData({...formData, title: e.target.value})}
                                        className="form-input-style"
                                        placeholder="např. Pololetní písemka"
                                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Od (volitelné)</label>
                                        <input 
                                            type="datetime-local" 
                                            value={formData.open_at} 
                                            onChange={e => setFormData({...formData, open_at: e.target.value})}
                                            style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Do (volitelné)</label>
                                        <input 
                                            type="datetime-local" 
                                            value={formData.close_at} 
                                            onChange={e => setFormData({...formData, close_at: e.target.value})}
                                            style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '-0.5rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                                    * Necháte-li datumy prázdné, test se zobrazí jako "Připravuje se" nebo "Termín bude upřesněn".
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Limit (min)</label>
                                        <input type="number" min="1" required value={formData.time_limit} onChange={e => setFormData({...formData, time_limit: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Počet otázek</label>
                                        <input type="number" min="1" required value={formData.question_count} onChange={e => setFormData({...formData, question_count: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Rozsah OD</label>
                                        <input type="number" min="1" required value={formData.topic_range_start} onChange={e => setFormData({...formData, topic_range_start: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>Rozsah DO</label>
                                        <input type="number" min="1" required value={formData.topic_range_end} onChange={e => setFormData({...formData, topic_range_end: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--color-card-border)', background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button type="button" className="navButton" onClick={() => setShowForm(false)} style={{ flex: 1 }}>Zrušit</button>
                                    <button type="submit" className="navButton primary" style={{ flex: 1 }}>
                                        {editingTestId ? 'Uložit změny' : 'Vytvořit test'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- SEZNAM TESTŮ --- */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>Načítám testy...</div>
                ) : tests.length === 0 ? (
                    <div style={{ 
                        textAlign: "center", padding: "3rem", 
                        color: "var(--color-text-secondary)", background: "var(--color-card-bg)",
                        borderRadius: "24px", border: "1px solid var(--color-card-border)",
                    }}>
                        <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.8 }}>📭</div>
                        Žádné naplánované testy.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {tests.map(test => {
                            const now = new Date();
                            const hasDates = test.open_at && test.close_at;
                            const isOpen = hasDates && now >= new Date(test.open_at) && now <= new Date(test.close_at);
                            const isClosed = hasDates && now > new Date(test.close_at);

                            let statusConfig = { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", text: "Budoucí" };
                            if (!hasDates) statusConfig = { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)", text: "Datum neurčeno" };
                            else if (isOpen) statusConfig = { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)", text: "Probíhá" };
                            else if (isClosed) statusConfig = { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)", text: "Uzavřeno" };

                            const isExpanded = expandedTestId === test.id;

                            return (
                                <div key={test.id} className="reviewCard" style={{ 
                                    padding: '0', borderRadius: '20px', overflow: 'hidden',
                                    border: `1px solid var(--color-card-border)`,
                                    background: 'var(--color-card-bg)',
                                    boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                                    position: 'relative'
                                }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: statusConfig.color }}></div>

                                    {/* Hlavička testu */}
                                    <div style={{ padding: '1.5rem', paddingLeft: '1.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: 'var(--color-text-main)' }}>{test.title}</h3>
                                                <span style={{ 
                                                    padding: '4px 10px', borderRadius: '12px', 
                                                    fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase',
                                                    background: statusConfig.bg, color: statusConfig.color 
                                                }}>
                                                    {statusConfig.text}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                <div>📅 {formatDate(test.open_at)} - {formatDate(test.close_at)}</div>
                                                <div>⚙️ {test.question_count} otázek (rozsah {test.topic_range_start}-{test.topic_range_end}), limit {test.time_limit} min</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            <button 
                                                className="navButton" 
                                                onClick={() => toggleExpand(test.id)}
                                                style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}
                                            >
                                                {isExpanded ? 'Skrýt výsledky' : 'Výsledky'}
                                            </button>

                                            <button 
                                                className="navButton" 
                                                onClick={() => openEditForm(test)}
                                                style={{ padding: '0.6rem', color: 'var(--color-primary-light)', borderColor: 'rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.1)' }}
                                                title="Upravit test"
                                            >
                                                ✏️
                                            </button>

                                            <button 
                                                className="navButton" 
                                                onClick={() => setConfirmDeleteId(test.id)}
                                                style={{ padding: '0.6rem', color: 'var(--color-error)', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)' }}
                                                title="Smazat test"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>

                                    {/* Výsledky (Expandable) */}
                                    {isExpanded && (
                                        <div style={{ 
                                            borderTop: '1px solid var(--color-card-border)', 
                                            background: 'rgba(0,0,0,0.02)',
                                            padding: '1.5rem',
                                            paddingLeft: '1.8rem'
                                        }}>
                                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--color-text-main)' }}>Odevzdané práce</h4>

                                            {!results[test.id] ? (
                                                <div style={{ color: 'var(--color-text-secondary)' }}>Načítám výsledky...</div>
                                            ) : results[test.id].length === 0 ? (
                                                <div style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Zatím nikdo neodevzdal.</div>
                                            ) : (
                                                <div style={{ display: 'grid', gap: '0.8rem' }}>
                                                    {results[test.id].map(res => {
                                                        const percent = Math.round((res.score_correct / res.score_total) * 100);
                                                        let gradeColor = percent >= 85 ? 'var(--color-success)' : percent >= 50 ? 'var(--color-warning)' : 'var(--color-error)';

                                                        return (
                                                            <div key={res.id} style={{ 
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)',
                                                                padding: '0.8rem 1rem', borderRadius: '10px'
                                                            }}>
                                                                <div>
                                                                    <div style={{ fontWeight: '700', fontSize: '1rem' }}>{res.student_name}</div>
                                                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                                                        Čas: {Math.floor(res.time_spent / 60)}m {res.time_spent % 60}s | Cheat: {res.cheat_score}
                                                                    </div>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                                    <div style={{ textAlign: 'right' }}>
                                                                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: gradeColor }}>
                                                                            {percent}%
                                                                        </div>
                                                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                                                            {res.score_correct} / {res.score_total} bodů
                                                                        </div>
                                                                    </div>

                                                                    {/* TLAČÍTKO SMAZAT VÝSLEDEK */}
                                                                    <button 
                                                                        className="btn-icon"
                                                                        onClick={() => setConfirmDeleteResultId(res.id)}
                                                                        title="Smazat pokus (reset)"
                                                                        style={{ 
                                                                            background: 'transparent', border: 'none', 
                                                                            color: 'var(--color-error)', cursor: 'pointer',
                                                                            opacity: 0.6, fontSize: '1.1rem', padding: '0.5rem'
                                                                        }}
                                                                        onMouseEnter={(e) => e.target.style.opacity = 1}
                                                                        onMouseLeave={(e) => e.target.style.opacity = 0.6}
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}