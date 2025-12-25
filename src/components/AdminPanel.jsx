import React, { useState, useEffect } from "react";
import { ThemeToggle } from "./ThemeToggle";

// ROBUSTNÍ IMPORT SUPABASE
import * as supabaseModule from "../supabaseClient";
const supabase = supabaseModule.supabase || supabaseModule.default;

// --- SUB-KOMPONENTA: Horní lišta ---
const AppHeader = ({ onBack }) => {
    const [theme, setTheme] = useState(
        () => localStorage.getItem("quizio_theme") || "dark"
    );

    useEffect(() => {
        document.body.className = theme === "light" ? "light-mode" : "";
        localStorage.setItem("quizio_theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    };

    return (
        <div className="top-navbar">
            <div className="navbar-group">
                <button className="menuBackButton" onClick={onBack}>
                    ← <span className="mobile-hide-text">Zpět do menu</span>
                </button>
            </div>
            <div className="logoText">⚙️ Administrace</div>
            <div className="navbar-group">
                <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
            </div>
        </div>
    );
};

// --- SUB-KOMPONENTA: Seznam hlášení ---
const AdminReportsList = ({ onEditQuestion }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("reports")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) {
                console.warn("Chyba při načítání reportů", error);
                setReports([]);
            } else {
                // Pokus o dohledání jmen uživatelů
                const reportsWithMissingNames = data.filter(r => (!r.username || r.username === 'Neznámý') && r.user_id);

                if (reportsWithMissingNames.length > 0) {
                    try {
                        const userIds = [...new Set(reportsWithMissingNames.map(r => r.user_id))];
                        const { data: profiles } = await supabase
                            .from('profiles')
                            .select('id, username')
                            .in('id', userIds);

                        if (profiles) {
                            const profileMap = {};
                            profiles.forEach(p => profileMap[p.id] = p.username);

                            data.forEach(r => {
                                if ((!r.username || r.username === 'Neznámý') && r.user_id && profileMap[r.user_id]) {
                                    r.username = profileMap[r.user_id];
                                }
                            });
                        }
                    } catch (e) {
                        console.error("Nepodařilo se dohledat jména uživatelů:", e);
                    }
                }

                setReports(data || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // OPRAVENÁ FUNKCE MAZÁNÍ REPORTŮ
    const deleteReport = async (id) => {
        if (!window.confirm("Opravdu smazat toto hlášení?")) return;
        try {
            const { error } = await supabase
                .from("reports")
                .delete()
                .eq('id', id);

            if (error) throw error; // Pokud nastane chyba, hodíme výjimku

            // Smažeme z UI až po potvrzení úspěchu
            setReports(prev => prev.filter(r => r.id !== id));
        } catch (e) { 
            console.error("Chyba při mazání reportu:", e);
            alert("Nepodařilo se smazat hlášení. Zkontrolujte oprávnění v databázi.");
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    if (loading) return <div style={{textAlign:'center', padding:'2rem', color:'#888'}}>Načítám hlášení...</div>;

    return (
        <div className="fadeIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Nahlášené chyby ({reports.length})</h3>
                <button className="navButton" onClick={fetchReports}>🔄 Obnovit</button>
            </div>

            {reports.length === 0 ? (
                <div className="admin-card" style={{textAlign: 'center', color: '#888'}}>
                    <p>Žádná hlášení k řešení. 🎉</p>
                </div>
            ) : (
                reports.map(report => (
                <div key={report.id} className="admin-card" style={{ borderLeft: report.status === 'resolved' ? '4px solid #10b981' : '4px solid #ef4444' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <strong style={{color: 'var(--color-primary-light)'}}>
                                {report.additional_info && report.additional_info.startsWith('[') 
                                    ? report.additional_info.split(']')[0] + ']' 
                                    : `ID: ${report.question_id}`}
                            </strong>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                {report.username && (
                                    <span style={{ fontSize: '0.85em', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                                        👤 {report.username}
                                    </span>
                                )}
                                <small style={{color: '#888', whiteSpace: 'nowrap'}}>{new Date(report.created_at).toLocaleString()}</small>
                            </div>
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{fontSize: '0.9em', color: '#888'}}>Důvod:</div>
                            <div style={{ fontWeight: 500, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{report.reason}</div>
                        </div>
                        {report.additional_info && (
                            <div style={{ fontSize: '0.85em', fontStyle: 'italic', color: '#666', background: 'rgba(0,0,0,0.05)', padding: '0.5rem', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                ℹ️ {report.additional_info}
                            </div>
                        )}
                    </div>
                    <div className="admin-actions" style={{ flexShrink: 0, marginLeft: '1rem' }}>
                        <button 
                            className="btn-icon btn-edit" 
                            onClick={() => onEditQuestion(report)}
                            title="Otevřít v editoru"
                        >
                            ✎
                        </button>

                        <button 
                            className="btn-icon btn-delete" 
                            onClick={() => deleteReport(report.id)}
                            title="Smazat hlášení"
                        >
                            🗑
                        </button>
                    </div>
                </div>
                ))
            )}
        </div>
    );
};

// --- HLAVNÍ KOMPONENTA: AdminPanel ---
export const AdminPanel = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState("questions");
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const [searchTerm, setSearchTerm] = useState("");
    const [filterSubject, setFilterSubject] = useState("ALL");

    const [editingId, setEditingId] = useState(null);
    const [activeReport, setActiveReport] = useState(null);
    const [editForm, setEditForm] = useState({
        subject: "SPS",
        number: "",
        question: "",
        options: ["", "", "", ""],
        correct_index: 0,
    });

    const [importText, setImportText] = useState("");

    useEffect(() => {
        if (activeTab === "questions" || activeTab === "reports") fetchQuestions();
    }, [activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterSubject, activeTab]);

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("questions")
                .select("*")
                .order("subject", { ascending: true })
                .order("number", { ascending: true });
            if (error) throw error;
            setQuestions(data || []);
        } catch (err) {
            console.error("Error fetching questions:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editForm.number || !editForm.question)
            return alert("Vyplňte alespoň číslo a otázku.");

        const payload = { ...editForm, number: parseInt(editForm.number) };

        try {
            if (editingId) {
                const { error } = await supabase
                    .from("questions")
                    .update(payload)
                    .eq("id", editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("questions").insert([payload]);
                if (error) throw error;
            }

            if (activeReport) {
                const shouldResolve = window.confirm("Otázka uložena. Chcete označit hlášení jako vyřešené?");
                if (shouldResolve) {
                    await supabase.from("reports").update({ status: 'resolved' }).eq('id', activeReport.id);
                }
            }

            setEditingId(null);
            setActiveReport(null);
            setEditForm(prev => ({
                subject: prev.subject,
                number: "",
                question: "",
                options: ["", "", "", ""],
                correct_index: 0,
            }));

            setActiveTab("questions");
            fetchQuestions();
        } catch (err) {
            alert("Chyba při ukládání: " + err.message);
        }
    };

    const handleEdit = (q) => {
        setActiveReport(null);
        setEditingId(q.id);
        setEditForm({
            subject: q.subject,
            number: q.number,
            question: q.question,
            options: q.options || ["", "", "", ""],
            correct_index: q.correct_index,
        });
        setActiveTab("new");
    };

    const handleReportEdit = (report) => {
        let foundQ = questions.find(q => String(q.id) === String(report.question_id));

        if (!foundQ && report.additional_info) {
             const match = report.additional_info.match(/\[(SPS|STT) #(\d+)\]/);
             if (match) {
                 const s = match[1];
                 const n = parseInt(match[2]);
                 foundQ = questions.find(q => q.subject === s && q.number === n);
             }
        }

        if (foundQ) {
            setEditingId(foundQ.id);
            setEditForm({
                subject: foundQ.subject,
                number: foundQ.number,
                question: foundQ.question,
                options: foundQ.options || ["", "", "", ""],
                correct_index: foundQ.correct_index,
            });
            setActiveTab("new");
            setActiveReport(report);
        } else {
            alert(`Otázka nebyla nalezena (ID: ${report.question_id}). Možná byla již smazána.`);
        }
    };

    // OPRAVENÁ FUNKCE MAZÁNÍ OTÁZEK
    const handleDelete = async (id) => {
        if (!window.confirm("Opravdu smazat tuto otázku?")) return;
        try {
            const { error } = await supabase.from("questions").delete().eq("id", id);
            if (error) throw error;
            setQuestions(prev => prev.filter(q => q.id !== id));
        } catch (err) {
            console.error("Chyba při mazání otázky:", err);
            alert("Chyba při mazání otázky: " + err.message);
        }
    };

    const handleImport = async () => {
        try {
            const parsed = JSON.parse(importText);
            if (!Array.isArray(parsed)) throw new Error("JSON musí být pole objektů.");

            const { error } = await supabase.from("questions").insert(parsed);
            if (error) throw error;

            alert(`Úspěšně importováno ${parsed.length} otázek.`);
            setImportText("");
            setActiveTab("questions");
            fetchQuestions();
        } catch (e) {
            alert("Chyba importu: " + e.message);
        }
    };

    const filteredQuestions = questions.filter((q) => {
        const matchesSearch = 
            q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(q.number).includes(searchTerm);
        const matchesSubject = filterSubject === "ALL" || q.subject === filterSubject;
        return matchesSearch && matchesSubject;
    });

    const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentQuestions = filteredQuestions.slice(startIndex, startIndex + itemsPerPage);

    const countSPS = questions.filter(q => q.subject === 'SPS').length;
    const countSTT = questions.filter(q => q.subject === 'STT').length;

    return (
        <div className="container fadeIn">
            <AppHeader onBack={onBack} />

            <div className="admin-toolbar" style={{ marginTop: '1rem' }}>
                <div style={{ display: "flex", gap: "0.5rem", overflowX: 'auto', paddingBottom: '0.5rem', borderBottom: '1px solid #eee' }}>
                    <button 
                        className={`navButton ${activeTab === "questions" || activeTab === "new" || activeTab === "import" ? "primary" : ""}`} 
                        onClick={() => setActiveTab("questions")}
                    >
                        Otázky ({questions.length})
                    </button>
                    <button 
                        className={`navButton ${activeTab === "reports" ? "primary" : ""}`} 
                        onClick={() => setActiveTab("reports")}
                    >
                        📢 Hlášení
                    </button>
                </div>

                {activeTab === "questions" && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                                className="navButton primary" 
                                style={{ flex: 1, justifyContent: 'center' }}
                                onClick={() => { setActiveTab("new"); setEditingId(null); setActiveReport(null); }}
                            >
                                ➕ Nová otázka
                            </button>
                            <button 
                                className="navButton" 
                                style={{ flex: 1, justifyContent: 'center' }}
                                onClick={() => setActiveTab("import")}
                            >
                                📥 Importovat
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <select 
                                className="form-input-style" 
                                style={{ width: 'auto', minWidth: '100px' }}
                                value={filterSubject}
                                onChange={(e) => setFilterSubject(e.target.value)}
                            >
                                <option value="ALL">Vše</option>
                                <option value="SPS">SPS ({countSPS})</option>
                                <option value="STT">STT ({countSTT})</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Hledat (text nebo číslo)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ flex: 1 }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div style={{ marginTop: "1.5rem", paddingBottom: "2rem" }}>
                {activeTab === "questions" && (
                    <div className="fadeIn">
                        {loading ? <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Načítám data...</div> : 
                        filteredQuestions.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Žádné otázky nenalezeny.</div> : 
                        (
                            <>
                                {currentQuestions.map((q) => (
                                    <div key={q.id} className="admin-card">
                                        <div style={{ flex: 1 }}>
                                            <div style={{ marginBottom: "0.5rem", display: 'flex', alignItems: 'center' }}>
                                                <span className={`admin-badge ${q.subject === "SPS" ? "badge-sps" : "badge-stt"}`}>{q.subject}</span>
                                                <span className="admin-badge badge-num">#{q.number}</span>
                                            </div>
                                            <div className="question-text">{q.question}</div>
                                            <div className="correct-answer" style={{marginTop: '0.5rem'}}>✅ {q.options && q.options[q.correct_index]}</div>
                                        </div>
                                        <div className="admin-actions">
                                            <button className="btn-icon btn-edit" onClick={() => handleEdit(q)} title="Upravit">✎</button>
                                            <button className="btn-icon btn-delete" onClick={() => handleDelete(q.id)} title="Smazat">🗑</button>
                                        </div>
                                    </div>
                                ))}

                                {totalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
                                            <button 
                                                className="navButton" 
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                style={{ padding: '0.6rem 1.2rem', opacity: currentPage === 1 ? 0.5 : 1 }}
                                            >
                                                ← Předchozí
                                            </button>
                                            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 'bold' }}>
                                                Strana {currentPage} z {totalPages}
                                            </span>
                                            <button 
                                                className="navButton" 
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                style={{ padding: '0.6rem 1.2rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
                                            >
                                                Další →
                                            </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === "new" && (
                    <div className="admin-card fadeIn" style={{ display: "block" }}>
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--color-primary-light)' }}>{editingId ? "✏️ Upravit otázku" : "➕ Přidat novou otázku"}</h3>

                        {activeReport && (
                            <div style={{ 
                                marginBottom: '20px', 
                                padding: '15px', 
                                backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                                borderLeft: '4px solid #ef4444', 
                                borderRadius: '4px',
                                fontSize: '0.95rem'
                            }}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📢 Řešení hlášení
                                </h4>
                                <div style={{ marginBottom: '8px' }}>
                                    <strong>Důvod nahlášení:</strong> 
                                    <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{activeReport.reason}</div>
                                </div>
                                {activeReport.username && (
                                    <div style={{ marginBottom: '8px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                                        Od: {activeReport.username}
                                    </div>
                                )}
                                {activeReport.additional_info && (
                                    <div style={{ fontSize: '0.9em', color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: '8px', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '8px' }}>
                                        <strong>Info:</strong> {activeReport.additional_info}
                                    </div>
                                )}
                                <div style={{ marginTop: '10px', fontSize: '0.85em', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                    Nahlášeno: {new Date(activeReport.created_at).toLocaleString()}
                                </div>
                            </div>
                        )}

                        <div style={{ display: "grid", gap: "1rem" }}>
                            <div style={{ display: "flex", gap: "1rem" }}>
                                <div style={{flex: 1}}>
                                    <label style={{fontSize: '0.8rem', color: '#888', marginBottom: '4px', display: 'block'}}>Předmět</label>
                                    <select className="form-input-style" value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}>
                                        <option value="SPS">SPS</option>
                                        <option value="STT">STT</option>
                                    </select>
                                </div>
                                <div style={{flex: 1}}>
                                    <label style={{fontSize: '0.8rem', color: '#888', marginBottom: '4px', display: 'block'}}>Číslo otázky</label>
                                    <input type="number" className="form-input-style" value={editForm.number} onChange={(e) => setEditForm({ ...editForm, number: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label style={{fontSize: '0.8rem', color: '#888', marginBottom: '4px', display: 'block'}}>Znění otázky</label>
                                <textarea className="form-input-style" rows="3" value={editForm.question} onChange={(e) => setEditForm({ ...editForm, question: e.target.value })} />
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                                <label style={{fontSize: '0.9rem', color: 'var(--color-primary-light)', marginBottom: '8px', display: 'block', fontWeight: 'bold'}}>Možnosti odpovědí (vyber správnou)</label>
                                {editForm.options.map((opt, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: '0.5rem' }}>
                                        <input type="radio" name="correct" checked={editForm.correct_index === i} onChange={() => setEditForm({ ...editForm, correct_index: i })} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                                        <input type="text" placeholder={`Možnost ${i + 1}`} className="form-input-style" value={opt} onChange={(e) => { const newOpts = [...editForm.options]; newOpts[i] = e.target.value; setEditForm({ ...editForm, options: newOpts }); }} style={editForm.correct_index === i ? { borderColor: 'var(--color-success)', background: 'rgba(34, 197, 94, 0.1)' } : {}} />
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button className="navButton" onClick={() => { setActiveTab("questions"); setActiveReport(null); }} style={{ flex: 1 }}>Zrušit</button>
                                <button className="navButton primary" onClick={handleSave} style={{ flex: 2 }}>{editingId ? "Uložit změny" : "Vytvořit otázku"}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Zde předáváme funkci pro editaci do seznamu reportů */}
                {activeTab === "reports" && (
                    <AdminReportsList onEditQuestion={handleReportEdit} />
                )}

                {activeTab === "import" && (
                    <div className="admin-card fadeIn" style={{ display: "block" }}>
                        <h3>Hromadný import (JSON)</h3>
                        <p style={{ fontSize: '0.9rem', color: '#888', marginBottom: '1rem' }}>Vložte pole objektů ve formátu: <br/><code>[&#123;"subject":"SPS", "number":1, "question":"...", "options":["..."], "correct_index":0&#125;, ...]</code></p>
                        <textarea className="form-input-style" rows="10" value={importText} onChange={(e) => setImportText(e.target.value)} style={{ fontFamily: "monospace", fontSize: "0.85rem" }} />
                        <div style={{display:'flex', gap: '1rem', marginTop: '1rem'}}>
                            <button className="navButton" onClick={() => setActiveTab("questions")} style={{flex: 1}}>Zpět</button>
                            <button className="navButton primary" onClick={handleImport} style={{ flex: 2 }}>Spustit import</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};