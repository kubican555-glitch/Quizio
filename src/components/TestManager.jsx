import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export const TestManager = ({ onBack, subject, isTeacher }) => {
    const [activeTab, setActiveTab] = useState("create"); // "create" | "results"
    const [loading, setLoading] = useState(false);

    // State pro nový test
    const [title, setTitle] = useState("");
    const [rangeStart, setRangeStart] = useState("");
    const [rangeEnd, setRangeEnd] = useState("");
    const [timeLimit, setTimeLimit] = useState(30);
    const [questionCount, setQuestionCount] = useState(20);
    const [openAt, setOpenAt] = useState("");
    const [closeAt, setCloseAt] = useState("");

    // State pro seznam testů a výsledky
    const [existingTests, setExistingTests] = useState([]);
    const [selectedTestId, setSelectedTestId] = useState(null);
    const [results, setResults] = useState([]);

    // Načtení testů při startu
    useEffect(() => {
        fetchTests();
    }, [subject]);

    // Načtení výsledků při výběru testu
    useEffect(() => {
        if (selectedTestId) {
            fetchResults(selectedTestId);
        }
    }, [selectedTestId]);

    const fetchTests = async () => {
        setLoading(true);
        const { data } = await supabase.from('scheduled_tests')
            .select('*')
            .eq('subject', subject)
            .order('created_at', { ascending: false });
        if (data) setExistingTests(data);
        setLoading(false);
    };

    const fetchResults = async (testId) => {
        setLoading(true);
        const { data } = await supabase.from('test_results')
            .select('*')
            .eq('test_id', testId)
            .order('score_correct', { ascending: false });
        if (data) setResults(data);
        setLoading(false);
    };

    const handleCreateTest = async (e) => {
        e.preventDefault();
        if (!title || !rangeStart || !rangeEnd || !openAt || !closeAt) return alert("Vyplňte všechna pole!");

        setLoading(true);
        const { error } = await supabase.from('scheduled_tests').insert([{
            subject,
            title,
            topic_range_start: parseInt(rangeStart),
            topic_range_end: parseInt(rangeEnd),
            time_limit: parseInt(timeLimit),
            question_count: parseInt(questionCount),
            open_at: new Date(openAt).toISOString(),
            close_at: new Date(closeAt).toISOString()
        }]);

        setLoading(false);
        if (error) alert("Chyba: " + error.message);
        else {
            alert("Test vytvořen!");
            setTitle("");
            fetchTests();
        }
    };

    const handleDeleteTest = async (id) => {
        if (!confirm("Opravdu smazat test? Smažou se i výsledky!")) return;
        await supabase.from('scheduled_tests').delete().eq('id', id);
        fetchTests();
        if (selectedTestId === id) { setSelectedTestId(null); setResults([]); }
    };

    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", padding: '20px' }}>
            <div className="top-navbar">
                <div className="navbar-group">
                    <button className="menuBackButton" onClick={onBack}>← Zpět</button>
                    <span style={{ fontWeight: 'bold' }}>Správa testů ({subject})</span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', margin: '20px 0', justifyContent: 'center' }}>
                <button className={`navButton ${activeTab === 'create' ? 'primary' : ''}`} onClick={() => setActiveTab('create')}>Vytvořit test</button>
                <button className={`navButton ${activeTab === 'results' ? 'primary' : ''}`} onClick={() => setActiveTab('results')}>Výsledky</button>
            </div>

            {activeTab === 'create' && (
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <form onSubmit={handleCreateTest} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px' }}>
                        <h3>Nový test</h3>
                        <input className="reviewSearchInput" placeholder="Název testu (např. Pololetní písemka)" value={title} onChange={e => setTitle(e.target.value)} />

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input className="reviewSearchInput" type="number" placeholder="Od otázky č." value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
                            <input className="reviewSearchInput" type="number" placeholder="Do otázky č." value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <label style={{flex:1}}>
                                Čas (min):
                                <input className="reviewSearchInput" type="number" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} />
                            </label>
                            <label style={{flex:1}}>
                                Počet otázek:
                                <input className="reviewSearchInput" type="number" value={questionCount} onChange={e => setQuestionCount(e.target.value)} />
                            </label>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', flexDirection:'column' }}>
                            <label>Otevřít od: <input className="reviewSearchInput" type="datetime-local" value={openAt} onChange={e => setOpenAt(e.target.value)} /></label>
                            <label>Uzavřít do: <input className="reviewSearchInput" type="datetime-local" value={closeAt} onChange={e => setCloseAt(e.target.value)} /></label>
                        </div>

                        <button type="submit" className="navButton primary" disabled={loading}>{loading ? "Ukládám..." : "Vytvořit test"}</button>
                    </form>

                    <h3 style={{ marginTop: '30px' }}>Existující testy</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {existingTests.map(test => (
                            <div key={test.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px' }}>
                                <div>
                                    <strong>{test.title}</strong>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                        {new Date(test.open_at).toLocaleString()} - {new Date(test.close_at).toLocaleString()}
                                    </div>
                                </div>
                                <button className="navButton danger-style" onClick={() => handleDeleteTest(test.id)} style={{ padding: '5px 10px', fontSize: '0.8rem' }}>Smazat</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'results' && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div className="card" style={{ padding: '15px', marginBottom: '20px' }}>
                        <select 
                            className="reviewSearchInput" 
                            onChange={(e) => setSelectedTestId(e.target.value)}
                            value={selectedTestId || ""}
                        >
                            <option value="">-- Vyberte test --</option>
                            {existingTests.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                    </div>

                    {selectedTestId && (
                        <div className="card" style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <th style={{ padding: '10px' }}>Jméno</th>
                                        <th style={{ padding: '10px' }}>Skóre</th>
                                        <th style={{ padding: '10px' }}>%</th>
                                        <th style={{ padding: '10px' }}>Čas</th>
                                        <th style={{ padding: '10px' }}>Cheat?</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.length === 0 ? (
                                        <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center' }}>Zatím žádné výsledky.</td></tr>
                                    ) : (
                                        results.map(res => (
                                            <tr key={res.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                                <td style={{ padding: '10px' }}>{res.student_name}</td>
                                                <td style={{ padding: '10px' }}>{res.score_correct} / {res.score_total}</td>
                                                <td style={{ padding: '10px' }}>{Math.round((res.score_correct / res.score_total) * 100)}%</td>
                                                <td style={{ padding: '10px' }}>{Math.floor(res.time_spent / 60)}m {res.time_spent % 60}s</td>
                                                <td style={{ padding: '10px', color: res.cheat_score > 0 ? 'red' : 'green' }}>
                                                    {res.cheat_score > 0 ? `⚠️ (${res.cheat_score}x)` : 'OK'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};