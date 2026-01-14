import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { ThemeToggle } from "./ThemeToggle";
import UserManagement from "./UserManagement";

// --- SUB-KOMPONENTA: Horní lišta ---
const AdminHeader = ({ onBack }) => {
    const [theme, setTheme] = useState(
        () => localStorage.getItem("quizio_theme") || "dark",
    );

    useEffect(() => {
        document.body.className = theme === "light" ? "light-mode" : "";
        localStorage.setItem("quizio_theme", theme);
    }, [theme]);

    const toggleTheme = () =>
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));

    return (
        <div className="top-navbar">
            <div className="navbar-group">
                <button className="menuBackButton" onClick={onBack}>
                    <span style={{ fontSize: "1.2rem", marginRight: "0.2rem" }}>
                        ←
                    </span>
                    <span className="mobile-hide-text">Zpět do menu</span>
                </button>
            </div>
            <div
                style={{
                    fontWeight: "800",
                    fontSize: "1.1rem",
                    letterSpacing: "-0.5px",
                }}
            >
                ⚙️ Administrace
            </div>
            <div className="navbar-group">
                <ThemeToggle currentTheme={theme} toggle={toggleTheme} />
            </div>
        </div>
    );
};

// --- SUB-KOMPONENTA: Paginace (Navigátor) ---
const AdminPagination = ({ currentPage, totalPages, onPageChange }) => {
    // Logika pro generování čísel stránek s mezerami (např. 1 ... 4 5 6 ... 20)
    const getPageNumbers = () => {
        const delta = 2; // Kolik stránek okolo aktuální zobrazit
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 ||
                i === totalPages ||
                (i >= currentPage - delta && i <= currentPage + delta)
            ) {
                range.push(i);
            }
        }

        for (let i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push("...");
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    };

    if (totalPages <= 1) return null;

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "0.5rem",
                marginTop: "2rem",
                flexWrap: "wrap",
            }}
        >
            <button
                className="navButton"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                style={{ padding: "0.5rem 1rem", minHeight: "40px" }}
            >
                ←
            </button>

            {getPageNumbers().map((page, index) => (
                <button
                    key={index}
                    className={`navButton ${page === currentPage ? "primary" : ""}`}
                    onClick={() =>
                        typeof page === "number" ? onPageChange(page) : null
                    }
                    disabled={page === "..."}
                    style={{
                        width: "40px",
                        height: "40px",
                        padding: 0,
                        minHeight: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: page === "..." ? "default" : "pointer",
                        opacity: page === "..." ? 0.5 : 1,
                        background: page === "..." ? "transparent" : undefined,
                        border: page === "..." ? "none" : undefined,
                        fontWeight: page === currentPage ? "bold" : "normal",
                    }}
                >
                    {page}
                </button>
            ))}

            <button
                className="navButton"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                style={{ padding: "0.5rem 1rem", minHeight: "40px" }}
            >
                →
            </button>
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
            // 1. Načíst reporty
            const { data: reportsData, error } = await supabase
                .from("reports")
                .select("*");

            if (error) throw error;

            let enrichedReports = reportsData || [];

            // 2. Získat seznam ID otázek
            const questionIds = [
                ...new Set(
                    enrichedReports.map((r) => r.question_id).filter(Boolean),
                ),
            ];

            // 3. Načíst detaily otázek
            if (questionIds.length > 0) {
                const { data: questionsData } = await supabase
                    .from("questions")
                    .select("id, question, image_base64, subject, number")
                    .in("id", questionIds);

                const questionMap = {};
                if (questionsData) {
                    questionsData.forEach((q) => (questionMap[q.id] = q));
                }

                enrichedReports = enrichedReports.map((r) => ({
                    ...r,
                    question_details: questionMap[r.question_id] || null,
                }));
            }

            // 4. Dohledání jmen uživatelů
            const reportsWithMissingNames = enrichedReports.filter(
                (r) => (!r.username || r.username === "Neznámý") && r.user_id,
            );
            if (reportsWithMissingNames.length > 0) {
                try {
                    const userIds = [
                        ...new Set(
                            reportsWithMissingNames.map((r) => r.user_id),
                        ),
                    ];
                    const { data: profiles } = await supabase
                        .from("profiles")
                        .select("id, username")
                        .in("id", userIds);

                    if (profiles) {
                        const profileMap = {};
                        profiles.forEach(
                            (p) => (profileMap[p.id] = p.username),
                        );
                        enrichedReports.forEach((r) => {
                            if (
                                (!r.username || r.username === "Neznámý") &&
                                r.user_id &&
                                profileMap[r.user_id]
                            ) {
                                r.username = profileMap[r.user_id];
                            }
                        });
                    }
                } catch (e) {
                    console.error("Chyba jmen:", e);
                }
            }

            // 5. ŘAZENÍ: Nevyřešené první, pak podle data
            enrichedReports.sort((a, b) => {
                // Pokud je jeden resolved a druhý ne
                const aResolved = a.status === "resolved";
                const bResolved = b.status === "resolved";

                if (aResolved && !bResolved) return 1; // a (vyřešené) jde dolů
                if (!aResolved && bResolved) return -1; // a (nevyřešené) jde nahoru

                // Pokud jsou oba stejné, řadíme podle data (nejnovější nahoře)
                return new Date(b.created_at) - new Date(a.created_at);
            });

            setReports(enrichedReports);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const deleteReport = async (id) => {
        if (!window.confirm("Opravdu smazat toto hlášení?")) return;
        try {
            const { error } = await supabase
                .from("reports")
                .delete()
                .eq("id", id);
            if (error) throw error;
            setReports((prev) => prev.filter((r) => r.id !== id));
        } catch (e) {
            console.error("Chyba mazání reportu:", e);
            alert("Nepodařilo se smazat hlášení.");
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    if (loading)
        return (
            <div
                style={{ textAlign: "center", padding: "2rem", color: "#888" }}
            >
                Načítám hlášení...
            </div>
        );

    return (
        <div className="fadeIn">
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                }}
            >
                <h3>Nahlášené chyby ({reports.length})</h3>
                <button className="navButton" onClick={fetchReports}>
                    🔄 Obnovit
                </button>
            </div>

            {reports.length === 0 ? (
                <div
                    className="admin-card"
                    style={{
                        textAlign: "center",
                        color: "#888",
                        padding: "2rem",
                        background: "var(--color-card-bg)",
                        borderRadius: "12px",
                    }}
                >
                    <p>Žádná hlášení k řešení. 🎉</p>
                </div>
            ) : (
                reports.map((report) => {
                    const isResolved = report.status === "resolved";
                    return (
                        <div
                            key={report.id}
                            className="admin-card"
                            style={{
                                borderLeft: isResolved
                                    ? "5px solid var(--color-success)"
                                    : "5px solid var(--color-error)",
                                marginBottom: "1.5rem",
                                background: "var(--color-card-bg)",
                                padding: "1.2rem",
                                borderRadius: "16px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "1rem",
                                position: "relative",
                                opacity: isResolved ? 0.6 : 1, // Vyřešené trochu zprůhledníme
                                transition: "all 0.3s",
                            }}
                        >
                            {/* HORNÍ HLAVIČKA: Status a Předmět */}
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    {/* STATUS BADGE */}
                                    <span
                                        style={{
                                            padding: "4px 8px",
                                            borderRadius: "6px",
                                            fontSize: "0.75rem",
                                            fontWeight: "bold",
                                            textTransform: "uppercase",
                                            background: isResolved
                                                ? "rgba(34, 197, 94, 0.15)"
                                                : "rgba(239, 68, 68, 0.15)",
                                            color: isResolved
                                                ? "var(--color-success)"
                                                : "var(--color-error)",
                                            border: `1px solid ${isResolved ? "var(--color-success)" : "var(--color-error)"}`,
                                        }}
                                    >
                                        {isResolved
                                            ? "Vyřešeno"
                                            : "Čeká na opravu"}
                                    </span>

                                    {/* PŘEDMĚT A ČÍSLO */}
                                    {report.question_details ? (
                                        <div
                                            style={{
                                                fontSize: "1.2rem",
                                                fontWeight: "800",
                                                color: "var(--color-text-main)",
                                            }}
                                        >
                                            {report.question_details.subject}{" "}
                                            <span
                                                style={{
                                                    color: "var(--color-primary-light)",
                                                }}
                                            >
                                                #
                                                {report.question_details.number}
                                            </span>
                                        </div>
                                    ) : (
                                        <span
                                            style={{
                                                color: "var(--color-text-secondary)",
                                            }}
                                        >
                                            ID: {report.question_id}
                                        </span>
                                    )}
                                </div>

                                <div className="admin-actions">
                                    <button
                                        className="btn-icon btn-edit"
                                        onClick={() => onEditQuestion(report)}
                                        title="Upravit otázku"
                                        style={{
                                            width: "40px",
                                            height: "40px",
                                        }}
                                    >
                                        ✎
                                    </button>
                                    <button
                                        className="btn-icon btn-delete"
                                        onClick={() => deleteReport(report.id)}
                                        title="Smazat hlášení"
                                        style={{
                                            width: "40px",
                                            height: "40px",
                                        }}
                                    >
                                        🗑
                                    </button>
                                </div>
                            </div>

                            {/* TĚLO: Znění a Obrázek */}
                            {report.question_details ? (
                                <div
                                    style={{
                                        background: "rgba(0,0,0,0.2)",
                                        padding: "1rem",
                                        borderRadius: "12px",
                                        border: "1px solid var(--color-card-border)",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "1rem",
                                            fontWeight: "600",
                                            marginBottom: report
                                                .question_details.image_base64
                                                ? "1rem"
                                                : "0",
                                            lineHeight: "1.5",
                                        }}
                                    >
                                        {report.question_details.question}
                                    </div>

                                    {report.question_details.image_base64 && (
                                        <div style={{ textAlign: "left" }}>
                                            <img
                                                src={
                                                    report.question_details
                                                        .image_base64
                                                }
                                                alt="Náhled otázky"
                                                style={{
                                                    maxHeight: "180px",
                                                    maxWidth: "100%",
                                                    borderRadius: "8px",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div
                                    style={{
                                        color: "var(--color-error)",
                                        fontStyle: "italic",
                                        padding: "0.5rem",
                                    }}
                                >
                                    ⚠️ Otázka byla pravděpodobně smazána z
                                    databáze.
                                </div>
                            )}

                            {/* SPODEK: Důvod a Uživatel */}
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.5rem",
                                    borderTop:
                                        "1px solid var(--color-card-border)",
                                    paddingTop: "0.8rem",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "0.85rem",
                                        color: "var(--color-text-neutral)",
                                        fontWeight: "bold",
                                    }}
                                >
                                    DŮVOD NAHLÁŠENÍ:
                                </div>
                                <div
                                    style={{
                                        color: "var(--color-review-wrong)",
                                        background: "rgba(252, 165, 165, 0.1)",
                                        padding: "0.6rem",
                                        borderRadius: "8px",
                                        borderLeft:
                                            "3px solid var(--color-review-wrong)",
                                    }}
                                >
                                    {report.reason}
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "flex-end",
                                        gap: "15px",
                                        fontSize: "0.85rem",
                                        color: "var(--color-text-secondary)",
                                        marginTop: "0.5rem",
                                    }}
                                >
                                    {report.username && (
                                        <span>👤 {report.username}</span>
                                    )}
                                    <span>
                                        📅{" "}
                                        {new Date(
                                            report.created_at,
                                        ).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};

// --- POMOCNÁ FUNKCE: Převod na WebP ---
const convertToWebP = (file, maxWidth = 800) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                const webpData = canvas.toDataURL("image/webp", 0.75);
                resolve(webpData);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

// --- HLAVNÍ KOMPONENTA: AdminPanel ---
export function AdminPanel({ onBack }) {
    const [activeTab, setActiveTab] = useState("questions");
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const hasFetchedRef = useRef(false);

    // Pagination & Filter
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    const [searchTerm, setSearchTerm] = useState("");
    const [filterSubject, setFilterSubject] = useState("ALL");
    const [filterVisibility, setFilterVisibility] = useState("ALL");

    // Edit Form State
    const [editingId, setEditingId] = useState(null);
    const [editingReportId, setEditingReportId] = useState(null);
    const [resolveReport, setResolveReport] = useState(true);

    const [editForm, setEditForm] = useState({
        subject: "SPS",
        number: "",
        question: "",
        options: ["", "", "", ""],
        correct_index: null,
        is_active: true,
        image_base64: null,
    });

    // Import State
    const [csvFile, setCsvFile] = useState(null);
    const [importSubject, setImportSubject] = useState("SPS");
    const [imageImportSubject, setImageImportSubject] = useState("SPS");
    const [importStatus, setImportStatus] = useState({
        text: "",
        type: "",
        progress: 0,
    });
    const [importAsHidden, setImportAsHidden] = useState(false);

    useEffect(() => {
        if (
            !hasFetchedRef.current &&
            (activeTab === "questions" || activeTab === "reports")
        )
            fetchQuestions();
    }, [activeTab]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterSubject, filterVisibility, activeTab]);

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            let all = [];
            let from = 0;
            let hasMore = true;
            while (hasMore) {
                const { data, error } = await supabase
                    .from("questions")
                    .select("*")
                    .order("subject")
                    .order("number")
                    .range(from, from + 999);
                if (error) throw error;
                if (data && data.length > 0) {
                    all = [...all, ...data];
                    if (data.length < 1000) hasMore = false;
                    else from += 1000;
                } else hasMore = false;
                if (from > 25000) break;
            }
            setQuestions(all);
            hasFetchedRef.current = true;
        } catch (err) {
            console.error(err);
            alert("Chyba při stahování dat.");
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
                await supabase
                    .from("questions")
                    .update(payload)
                    .eq("id", editingId);
                if (editingReportId && resolveReport) {
                    await supabase
                        .from("reports")
                        .update({ status: "resolved" })
                        .eq("id", editingReportId);
                }
            } else {
                await supabase.from("questions").insert([payload]);
            }

            alert("Uloženo!");
            hasFetchedRef.current = false;
            fetchQuestions();

            if (editingReportId) {
                setActiveTab("reports");
                setEditingReportId(null);
            } else {
                setActiveTab("questions");
            }
        } catch (err) {
            alert(err.message);
        }
    };

    const handleEdit = (q) => {
        setEditingId(q.id);
        setEditForm({ ...q, is_active: q.is_active !== false });
        setEditingReportId(null);
        setActiveTab("new");
    };

    const handleReportEdit = (report) => {
        let q = questions.find(
            (x) => String(x.id) === String(report.question_id),
        );
        if (!q && report.question_details) {
            q = report.question_details;
        }

        if (q) {
            setEditingId(q.id);
            setEditForm({
                subject: q.subject,
                number: q.number,
                question: q.question,
                options: q.options || ["", "", "", ""],
                correct_index: q.correct_index,
                is_active: q.is_active !== false,
                image_base64: q.image_base64,
            });
            setEditingReportId(report.id);
            setResolveReport(true);
            setActiveTab("new");
        } else {
            alert("Otázka nebyla nalezena.");
        }
    };

    const handleCancelEdit = () => {
        if (editingReportId) {
            setActiveTab("reports");
            setEditingReportId(null);
        } else {
            setActiveTab("questions");
            setEditingId(null);
        }
    };

    const toggleActive = async (q) => {
        const newState = !q.is_active;
        try {
            await supabase
                .from("questions")
                .update({ is_active: newState })
                .eq("id", q.id);
            setQuestions((prev) =>
                prev.map((item) =>
                    item.id === q.id ? { ...item, is_active: newState } : item,
                ),
            );
        } catch (err) {
            alert("Chyba při změně viditelnosti.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Opravdu smazat otázku?")) return;
        try {
            await supabase.from("questions").delete().eq("id", id);
            setQuestions((prev) => prev.filter((q) => q.id !== id));
        } catch (e) {
            alert("Chyba při mazání.");
        }
    };

    const processCSV = async () => {
        if (!csvFile)
            return setImportStatus({ text: "Vyberte soubor.", type: "error" });
        setLoading(true);
        setImportStatus({ text: "Zpracovávám CSV...", type: "info" });

        const reader = new FileReader();
        reader.onload = async (e) => {
            const rows = e.target.result.split("\n");
            const toInsert = [];
            let hiddenCount = 0;

            for (let row of rows) {
                if (!row.trim()) continue;
                const delimiter = row.includes(";") ? ";" : ",";
                const cols = row.split(delimiter);
                if (cols.length < 2) continue;

                const number = parseInt(cols[0].trim());
                const question = cols[1].trim();
                const rawOptions = [cols[2], cols[3], cols[4], cols[5]]
                    .map((o) => o?.trim() || "")
                    .filter((o) => o !== "");

                let rawIdx =
                    cols.length > 6 ? cols[cols.length - 1].trim() : "";
                let correct_index = null;
                if (/^[a-dA-D]$/i.test(rawIdx))
                    correct_index = rawIdx.toLowerCase().charCodeAt(0) - 97;
                else if (rawIdx !== "" && !isNaN(parseInt(rawIdx))) {
                    let p = parseInt(rawIdx);
                    if (
                        p > 0 &&
                        p <= rawOptions.length &&
                        rawOptions[p] === undefined
                    )
                        correct_index = p - 1;
                    else correct_index = p;
                }

                const isComplete =
                    !isNaN(number) &&
                    question &&
                    rawOptions.length >= 2 &&
                    correct_index !== null;
                const active = !importAsHidden && isComplete;
                if (!isComplete && !isNaN(number)) hiddenCount++;

                if (!isNaN(number)) {
                    toInsert.push({
                        subject: importSubject,
                        number,
                        question,
                        options: rawOptions,
                        correct_index,
                        is_active: active,
                    });
                }
            }

            const { error } = await supabase
                .from("questions")
                .upsert(toInsert, { onConflict: "subject,number" });
            if (error)
                setImportStatus({
                    text: "Chyba: " + error.message,
                    type: "error",
                });
            else {
                setImportStatus({
                    text: `✅ Nahráno ${toInsert.length} otázek do ${importSubject}. Skryto: ${hiddenCount}`,
                    type: "success",
                });
                hasFetchedRef.current = false;
                fetchQuestions();
            }
            setLoading(false);
        };
        reader.readAsText(csvFile);
    };

    const handleFolderUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setLoading(true);
        setImportStatus({
            text: `Zpracovávám obrázky pro ${imageImportSubject}...`,
            progress: 0,
            type: "info",
        });

        const updates = [];
        let done = 0;

        for (const file of files) {
            const fileName = file.name.split(".")[0];
            const number = parseInt(fileName);

            if (!isNaN(number) && file.type.startsWith("image/")) {
                try {
                    const b64 = await convertToWebP(file);
                    updates.push({
                        subject: imageImportSubject,
                        number,
                        image_base64: b64,
                    });
                } catch (err) {
                    console.warn("Chyba konverze", file.name);
                }
            }
            done++;
            setImportStatus((prev) => ({
                ...prev,
                progress: Math.round((done / files.length) * 100),
            }));
        }

        if (updates.length > 0) {
            setImportStatus((prev) => ({
                ...prev,
                text: "Nahrávám do databáze...",
            }));
            const { error } = await supabase
                .from("questions")
                .upsert(updates, { onConflict: "subject,number" });
            if (error)
                setImportStatus({
                    text: "Chyba databáze: " + error.message,
                    type: "error",
                    progress: 0,
                });
            else {
                setImportStatus({
                    text: `✅ Úspěšně nahráno ${updates.length} obrázků pro ${imageImportSubject}.`,
                    type: "success",
                    progress: 100,
                });
                hasFetchedRef.current = false;
                fetchQuestions();
            }
        } else {
            setImportStatus({
                text: "Ve složce nebyl nalezen žádný očíslovaný obrázek.",
                type: "error",
                progress: 0,
            });
        }
        setLoading(false);
    };

    const filtered = questions.filter((q) => {
        const matchSearch =
            q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(q.number).includes(searchTerm);
        const matchSubj =
            filterSubject === "ALL" || q.subject === filterSubject;
        let matchVis = true;
        if (filterVisibility === "ACTIVE") matchVis = q.is_active !== false;
        if (filterVisibility === "HIDDEN") matchVis = q.is_active === false;
        return matchSearch && matchSubj && matchVis;
    });

    const currentQuestions = filtered.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
    );
    const totalP = Math.ceil(filtered.length / itemsPerPage);

    return (
        <div
            className="container fadeIn"
            style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}
        >
            <AdminHeader onBack={onBack} />

            <div className="quizContentWrapper">
                {/* --- TABS --- */}
                <div className="admin-tabs">
                    <button
                        className={`navButton ${activeTab === "questions" ? "primary" : ""}`}
                        onClick={() => setActiveTab("questions")}
                    >
                        Otázky ({questions.length})
                    </button>
                    <button
                        className={`navButton ${activeTab === "new" ? "primary" : ""}`}
                        onClick={() => {
                            setEditingId(null);
                            setEditingReportId(null);
                            setEditForm({
                                subject: "SPS",
                                number: "",
                                question: "",
                                options: ["", "", "", ""],
                                correct_index: null,
                                is_active: true,
                                image_base64: null,
                            });
                            setActiveTab("new");
                        }}
                    >
                        {editingId ? "Upravit" : "Nová"}
                    </button>
                    <button
                        className={`navButton ${activeTab === "import" ? "primary" : ""}`}
                        onClick={() => setActiveTab("import")}
                    >
                        Import
                    </button>
                    <button
                        className={`navButton ${activeTab === "reports" ? "primary" : ""}`}
                        onClick={() => setActiveTab("reports")}
                    >
                        Hlášení
                    </button>
                    <button
                        className={`navButton ${activeTab === "users" ? "primary" : ""}`}
                        onClick={() => setActiveTab("users")}
                    >
                        Správa uživatelů
                    </button>
                </div>

                {/* --- TAB: OTÁZKY (SEZNAM) --- */}
                {activeTab === "questions" && (
                    <div className="fadeIn">
                        <div
                            style={{
                                display: "flex",
                                gap: "0.8rem",
                                marginBottom: "1rem",
                                flexWrap: "wrap",
                            }}
                        >
                            <select
                                className="form-input-style"
                                value={filterSubject}
                                onChange={(e) =>
                                    setFilterSubject(e.target.value)
                                }
                                style={{ width: "auto", minWidth: "100px" }}
                            >
                                <option value="ALL">Vše</option>
                                <option value="SPS">SPS</option>
                                <option value="STT">STT</option>
                            </select>
                            <select
                                className="form-input-style"
                                value={filterVisibility}
                                onChange={(e) =>
                                    setFilterVisibility(e.target.value)
                                }
                                style={{ width: "auto", minWidth: "120px" }}
                            >
                                <option value="ALL">Viditelnost</option>
                                <option value="ACTIVE">Aktivní</option>
                                <option value="HIDDEN">Skryté</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Hledat..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: "0.6rem",
                                    borderRadius: "10px",
                                    background: "var(--color-card-bg)",
                                    color: "var(--color-text-main)",
                                    border: "1px solid var(--color-card-border)",
                                }}
                            />
                        </div>

                        {loading && questions.length === 0 ? (
                            <p style={{ textAlign: "center", padding: "2rem" }}>
                                Načítám...
                            </p>
                        ) : (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.6rem",
                                }}
                            >
                                {currentQuestions.map((q) => (
                                    <div
                                        key={q.id}
                                        className="admin-card"
                                        style={{
                                            opacity:
                                                q.is_active === false ? 0.7 : 1,
                                        }}
                                    >
                                        <div className="admin-card-content">
                                            <div className="admin-card-meta">
                                                <span
                                                    className={`admin-badge ${q.subject === "SPS" ? "badge-sps" : "badge-stt"}`}
                                                >
                                                    {q.subject}
                                                </span>
                                                <span
                                                    style={{
                                                        fontWeight: "800",
                                                        fontSize: "0.9rem",
                                                        color: "var(--color-primary-light)",
                                                        minWidth: "45px",
                                                    }}
                                                >
                                                    #{q.number}
                                                </span>
                                                {q.is_active === false && (
                                                    <span className="admin-badge badge-hidden">
                                                        Skryté
                                                    </span>
                                                )}
                                                {q.image_base64 && (
                                                    <span
                                                        title="Má obrázek"
                                                        style={{
                                                            fontSize: "1.1rem",
                                                        }}
                                                    >
                                                        🖼️
                                                    </span>
                                                )}
                                            </div>
                                            <div className="admin-card-question">
                                                {q.question}
                                            </div>
                                        </div>
                                        <div className="admin-actions">
                                            <button
                                                className="btn-icon"
                                                onClick={() => toggleActive(q)}
                                                title="Viditelnost"
                                            >
                                                {q.is_active === false
                                                    ? "🚫"
                                                    : "👁️"}
                                            </button>
                                            <button
                                                className="btn-icon btn-edit"
                                                onClick={() => handleEdit(q)}
                                            >
                                                ✎
                                            </button>
                                            <button
                                                className="btn-icon btn-delete"
                                                onClick={() =>
                                                    handleDelete(q.id)
                                                }
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* POUŽITÍ NOVÉHO NAVIGÁTORU */}
                        <AdminPagination
                            currentPage={currentPage}
                            totalPages={totalP}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}

                {/* --- TAB: NOVÁ / UPRAVIT --- */}
                {activeTab === "new" && (
                    <div className="admin-section-card fadeIn">
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "1rem",
                            }}
                        >
                            <h3
                                className="admin-section-title"
                                style={{ margin: 0 }}
                            >
                                {editingId
                                    ? "✏️ Upravit otázku"
                                    : "➕ Přidat novou otázku"}
                            </h3>
                            <button
                                className="navButton"
                                onClick={handleCancelEdit}
                                style={{
                                    minHeight: "auto",
                                    padding: "0.5rem 1rem",
                                    fontSize: "0.9rem",
                                }}
                            >
                                ❌ Zrušit / Zpět
                            </button>
                        </div>

                        {/* KONTEXT REPORTU - Checkbox pro vyřešení */}
                        {editingReportId && (
                            <div
                                style={{
                                    marginBottom: "1.5rem",
                                    padding: "1rem",
                                    background: "rgba(34, 197, 94, 0.1)",
                                    border: "1px solid var(--color-success)",
                                    borderRadius: "12px",
                                }}
                            >
                                <label
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.8rem",
                                        cursor: "pointer",
                                        fontWeight: "bold",
                                        color: "var(--color-success)",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={resolveReport}
                                        onChange={(e) =>
                                            setResolveReport(e.target.checked)
                                        }
                                        style={{
                                            width: "20px",
                                            height: "20px",
                                        }}
                                    />
                                    ✅ Označit nahlášení jako vyřešené (změnit
                                    status na "resolved")
                                </label>
                                <div
                                    style={{
                                        fontSize: "0.8rem",
                                        marginTop: "5px",
                                        color: "var(--color-text-secondary)",
                                        marginLeft: "32px",
                                    }}
                                >
                                    Po uložení se vrátíte zpět na seznam
                                    hlášení.
                                </div>
                            </div>
                        )}

                        <div style={{ display: "grid", gap: "1rem" }}>
                            <div style={{ display: "flex", gap: "1rem" }}>
                                <select
                                    className="form-input-style"
                                    value={editForm.subject}
                                    onChange={(e) =>
                                        setEditForm({
                                            ...editForm,
                                            subject: e.target.value,
                                        })
                                    }
                                    style={{ flex: 1 }}
                                >
                                    <option value="SPS">SPS</option>
                                    <option value="STT">STT</option>
                                </select>
                                <input
                                    type="number"
                                    placeholder="Číslo"
                                    value={editForm.number}
                                    onChange={(e) =>
                                        setEditForm({
                                            ...editForm,
                                            number: e.target.value,
                                        })
                                    }
                                    className="form-input-style"
                                    style={{ flex: 1 }}
                                />
                            </div>
                            <textarea
                                rows="3"
                                placeholder="Znění otázky"
                                value={editForm.question}
                                onChange={(e) =>
                                    setEditForm({
                                        ...editForm,
                                        question: e.target.value,
                                    })
                                }
                                className="form-input-style"
                            />

                            <div
                                style={{
                                    background: "rgba(0,0,0,0.1)",
                                    padding: "0.8rem",
                                    borderRadius: "12px",
                                    border: "1px solid var(--color-card-border)",
                                }}
                            >
                                <label
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.6rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={editForm.is_active}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                is_active: e.target.checked,
                                            })
                                        }
                                        style={{
                                            width: "18px",
                                            height: "18px",
                                        }}
                                    />
                                    <span style={{ fontWeight: "600" }}>
                                        Aktivní (zobrazovat v aplikaci)
                                    </span>
                                </label>
                            </div>

                            <div
                                style={{
                                    padding: "1rem",
                                    border: "2px dashed var(--color-card-border)",
                                    borderRadius: "12px",
                                }}
                            >
                                <label
                                    style={{
                                        fontSize: "0.85rem",
                                        display: "block",
                                        marginBottom: "0.5rem",
                                        fontWeight: "bold",
                                    }}
                                >
                                    Obrázek (převede se na WebP)
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            setLoading(true);
                                            const b64 =
                                                await convertToWebP(file);
                                            setEditForm({
                                                ...editForm,
                                                image_base64: b64,
                                            });
                                            setLoading(false);
                                        }
                                    }}
                                />
                                {editForm.image_base64 && (
                                    <div
                                        style={{
                                            marginTop: "10px",
                                            position: "relative",
                                            display: "inline-block",
                                        }}
                                    >
                                        <img
                                            src={editForm.image_base64}
                                            style={{
                                                maxHeight: "120px",
                                                borderRadius: "8px",
                                                border: "1px solid #555",
                                            }}
                                            alt=""
                                        />
                                        <button
                                            onClick={() =>
                                                setEditForm({
                                                    ...editForm,
                                                    image_base64: null,
                                                })
                                            }
                                            style={{
                                                position: "absolute",
                                                top: -8,
                                                right: -8,
                                                background:
                                                    "var(--color-error)",
                                                color: "white",
                                                border: "none",
                                                borderRadius: "50%",
                                                width: 24,
                                                height: 24,
                                                cursor: "pointer",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: "0.5rem" }}>
                                <label
                                    style={{
                                        fontSize: "0.9rem",
                                        marginBottom: "8px",
                                        display: "block",
                                        fontWeight: "bold",
                                    }}
                                >
                                    Možnosti (vyber správnou):
                                </label>
                                {editForm.options.map((opt, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.8rem",
                                            marginBottom: "0.6rem",
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="correct"
                                            checked={
                                                editForm.correct_index === i
                                            }
                                            onChange={() =>
                                                setEditForm({
                                                    ...editForm,
                                                    correct_index: i,
                                                })
                                            }
                                            style={{
                                                width: "20px",
                                                height: "20px",
                                                cursor: "pointer",
                                            }}
                                        />
                                        <input
                                            type="text"
                                            value={opt}
                                            onChange={(e) => {
                                                const ns = [
                                                    ...editForm.options,
                                                ];
                                                ns[i] = e.target.value;
                                                setEditForm({
                                                    ...editForm,
                                                    options: ns,
                                                });
                                            }}
                                            className="form-input-style"
                                            style={{
                                                flex: 1,
                                                padding: "0.7rem",
                                            }}
                                            placeholder={`Možnost ${i + 1}`}
                                        />
                                    </div>
                                ))}
                                {editForm.correct_index !== null && (
                                    <button
                                        className="navButton"
                                        onClick={() =>
                                            setEditForm({
                                                ...editForm,
                                                correct_index: null,
                                            })
                                        }
                                        style={{
                                            marginTop: "0.5rem",
                                            padding: "0.4rem 1rem",
                                            minHeight: "auto",
                                            fontSize: "0.8rem",
                                            background: "rgba(239,68,68,0.1)",
                                            color: "var(--color-error)",
                                            borderColor: "var(--color-error)",
                                        }}
                                    >
                                        Zrušit označení správné
                                    </button>
                                )}
                            </div>
                            <button
                                className="navButton primary"
                                onClick={handleSave}
                                disabled={loading}
                                style={{
                                    marginTop: "1rem",
                                    fontSize: "1.1rem",
                                }}
                            >
                                {loading
                                    ? "Ukládám..."
                                    : editingId
                                      ? "Uložit změny"
                                      : "Vytvořit otázku"}
                            </button>
                        </div>
                    </div>
                )}

                {/* --- TAB: IMPORT --- */}
                {activeTab === "import" && (
                    <div
                        className="fadeIn"
                        style={{ display: "grid", gap: "2rem" }}
                    >
                        <div className="admin-section-card">
                            <h3 className="admin-section-title">
                                📂 CSV Import Otázek
                            </h3>
                            <p className="admin-description">
                                Nahraje otázky a automaticky skryje ty s
                                neúplnými daty nebo bez indexu (A-D).
                            </p>

                            <div
                                style={{
                                    display: "flex",
                                    gap: "1rem",
                                    marginBottom: "1rem",
                                }}
                            >
                                {["SPS", "STT"].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setImportSubject(s)}
                                        className="navButton"
                                        style={{
                                            flex: 1,
                                            background:
                                                importSubject === s
                                                    ? "var(--color-primary)"
                                                    : "rgba(255,255,255,0.05)",
                                            color:
                                                importSubject === s
                                                    ? "#fff"
                                                    : "",
                                        }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <input
                                id="csvInput"
                                type="file"
                                accept=".csv"
                                onChange={(e) => {
                                    setCsvFile(e.target.files[0]);
                                    setImportStatus({ text: "", type: "" });
                                }}
                                style={{ width: "100%", marginBottom: "1rem" }}
                            />
                            <label
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.6rem",
                                    cursor: "pointer",
                                    background: "rgba(0,0,0,0.1)",
                                    padding: "0.8rem",
                                    borderRadius: "10px",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={importAsHidden}
                                    onChange={(e) =>
                                        setImportAsHidden(e.target.checked)
                                    }
                                    style={{ width: "18px", height: "18px" }}
                                />
                                <span>
                                    Importovat vše jako skryté (vypnuté)
                                </span>
                            </label>
                            <button
                                className="navButton primary"
                                onClick={processCSV}
                                disabled={loading || !csvFile}
                                style={{ width: "100%", marginTop: "1.5rem" }}
                            >
                                {loading
                                    ? "Zpracovávám..."
                                    : "Spustit CSV import"}
                            </button>
                        </div>

                        <div className="admin-section-card">
                            <h3 className="admin-section-title">
                                🖼️ Hromadný import obrázků
                            </h3>
                            <p className="admin-description">
                                Vyber předmět a pak zvol složku s obrázky. Názvy
                                souborů musí být čísla (např. 1.jpg). Vše bude
                                převedeno na úsporný WebP.
                            </p>
                            <div
                                style={{
                                    display: "flex",
                                    gap: "1rem",
                                    marginBottom: "1.5rem",
                                }}
                            >
                                {["SPS", "STT"].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setImageImportSubject(s)}
                                        className="navButton"
                                        style={{
                                            flex: 1,
                                            background:
                                                imageImportSubject === s
                                                    ? "var(--color-primary)"
                                                    : "rgba(255,255,255,0.05)",
                                            color:
                                                imageImportSubject === s
                                                    ? "#fff"
                                                    : "",
                                        }}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <div
                                style={{
                                    border: "3px dashed var(--color-primary)",
                                    padding: "2.5rem",
                                    textAlign: "center",
                                    borderRadius: "16px",
                                    background: "rgba(59,130,246,0.03)",
                                }}
                            >
                                <input
                                    type="file"
                                    webkitdirectory="true"
                                    directory="true"
                                    onChange={handleFolderUpload}
                                    disabled={loading}
                                    style={{ cursor: "pointer" }}
                                />
                                <div
                                    style={{
                                        marginTop: "10px",
                                        fontSize: "0.8rem",
                                        opacity: 0.6,
                                    }}
                                >
                                    Vyber celou složku s obrázky
                                </div>
                            </div>
                        </div>

                        {importStatus.text && (
                            <div
                                style={{
                                    padding: "1.2rem",
                                    borderRadius: "16px",
                                    background:
                                        importStatus.type === "error"
                                            ? "rgba(239,68,68,0.15)"
                                            : "rgba(34,197,94,0.15)",
                                    border: `1px solid ${importStatus.type === "error" ? "var(--color-error)" : "var(--color-success)"}`,
                                    textAlign: "center",
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight: "bold",
                                        color:
                                            importStatus.type === "error"
                                                ? "var(--color-error)"
                                                : "var(--color-success)",
                                        marginBottom:
                                            importStatus.progress > 0
                                                ? "10px"
                                                : "0",
                                    }}
                                >
                                    {importStatus.text}
                                </div>
                                {importStatus.progress > 0 &&
                                    importStatus.progress < 100 && (
                                        <div
                                            className="progressBarContainer"
                                            style={{ height: "10px" }}
                                        >
                                            <div
                                                className="progressBarFill"
                                                style={{
                                                    width: `${importStatus.progress}%`,
                                                }}
                                            ></div>
                                        </div>
                                    )}
                            </div>
                        )}
                    </div>
                )}

                {/* --- TAB: REPORTY --- */}
                {activeTab === "reports" && (
                    <AdminReportsList onEditQuestion={handleReportEdit} />
                )}

                {activeTab === "users" && (
                    <div className="fadeIn">
                        <UserManagement />
                    </div>
                )}

                <div
                    style={{
                        textAlign: "center",
                        opacity: 0.4,
                        fontSize: "0.8rem",
                        marginTop: "2rem",
                    }}
                >
                    Správa databáze Quizio • Načteno {questions.length} záznamů
                </div>
            </div>
        </div>
    );
}
