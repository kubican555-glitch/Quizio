import React, { useState } from 'react';
import Papa from 'papaparse';

export function CustomImportGuide({ onBack }) {
    const [status, setStatus] = useState({ text: '', type: '' });

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isCSV = file.name.endsWith(".csv");
        // Excel files are harder to parse purely in browser without heavy libs, 
        // but we can support CSV which Excel exports easily.
        if (!isCSV) {
            setStatus({ text: "Prosím nahrajte soubor ve formátu .csv", type: 'error' });
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const data = results.data;
                    if (data.length === 0) throw new Error("Soubor je prázdný");

                    const mapped = data.map((row, i) => {
                        // Support various header names
                        const number = parseInt(row.number || row.id || i + 1);
                        const question = row.question || row.otazka;
                        const correctIndex = parseInt(row.correctIndex || row.spravne || 0);
                        
                        // Options can be in columns option0, option1... or A, B, C...
                        let options = [];
                        if (row.option0 !== undefined) {
                            options = [row.option0, row.option1, row.option2, row.option3].filter(o => o !== undefined && o !== '');
                        } else if (row.A !== undefined) {
                            options = [row.A, row.B, row.C, row.D].filter(o => o !== undefined && o !== '');
                        } else {
                            // Try to find any columns that look like options
                            options = Object.keys(row)
                                .filter(k => k.toLowerCase().includes('option') || k.toLowerCase().includes('moznost'))
                                .map(k => row[k]);
                        }

                        return { number, question, options, correctIndex };
                    });

                    window.handleCustomImport(mapped);
                } catch (err) {
                    setStatus({ text: "Chyba při zpracování CSV: " + err.message, type: 'error' });
                }
            },
            error: (err) => {
                setStatus({ text: "Chyba při čtení souboru: " + err.message, type: 'error' });
            }
        });
    };

    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
            <div className="top-navbar">
                <button className="menuBackButton" onClick={onBack}>
                    <span style={{ fontSize: '1.2rem', marginRight: '0.2rem' }}>←</span>
                    <span className="mobile-hide-text">Zpět</span>
                </button>
                <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>📂 Import vlastních otázek</div>
                <div style={{ width: '40px' }}></div>
            </div>

            <div className="quizContentWrapper" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div className="admin-section-card" style={{ marginBottom: '2rem' }}>
                    <h3 className="admin-section-title">Průvodce nahráním (.csv)</h3>
                    <p className="admin-description">
                        Exportujte svou tabulku z Excelu jako <strong>CSV (oddělený čárkou)</strong>. 
                        Data budou uložena pouze dočasně ve vašem prohlížeči.
                    </p>
                    
                    <div style={{ background: 'rgba(0,0,0,0.1)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--color-card-border)', marginBottom: '1.5rem' }}>
                        <h4 style={{ marginBottom: '0.8rem', color: 'var(--color-primary-light)' }}>Požadované sloupce v CSV:</h4>
                        <ul style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', paddingLeft: '1.2rem', lineHeight: '1.6' }}>
                            <li><strong>question</strong> (nebo <i>otazka</i>) - Text otázky</li>
                            <li><strong>A, B, C, D</strong> - Jednotlivé možnosti</li>
                            <li><strong>correctIndex</strong> (nebo <i>spravne</i>) - Číslo správné odpovědi (0 pro A, 1 pro B...)</li>
                            <li><strong>number</strong> - Číslo otázky (volitelné)</li>
                        </ul>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{ border: '2px dashed var(--color-primary)', padding: '2.5rem', textAlign: 'center', borderRadius: '16px', background: 'rgba(59,130,246,0.03)', position: 'relative' }}>
                            <input 
                                type="file" 
                                accept=".csv" 
                                onChange={handleFile}
                                style={{ 
                                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                                    opacity: 0, cursor: 'pointer', zIndex: 2 
                                }} 
                            />
                            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📊</div>
                            <div style={{ fontWeight: '700', color: 'var(--color-primary-light)' }}>Klikněte pro výběr CSV souboru</div>
                            <div style={{ marginTop: '5px', fontSize: '0.8rem', opacity: 0.6 }}>Podporujeme exporty z Excelu a Google Tabulek</div>
                        </div>
                    </div>

                    {status.text && (
                        <div style={{ 
                            marginTop: '1.5rem', padding: '1rem', borderRadius: '10px', 
                            background: status.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                            color: status.type === 'error' ? 'var(--color-error)' : 'var(--color-success)',
                            border: `1px solid ${status.type === 'error' ? 'var(--color-error)' : 'var(--color-success)'}`,
                            textAlign: 'center', fontSize: '0.9rem'
                        }}>
                            {status.text}
                        </div>
                    )}
                </div>

                <div className="admin-section-card" style={{ opacity: 0.8 }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>💡 Tip</h4>
                    <p className="admin-description" style={{ marginBottom: 0 }}>
                        V Excelu použijte "Uložit jako" a vyberte formát <strong>CSV (oddělený čárkami) (*.csv)</strong>.
                    </p>
                </div>
            </div>
        </div>
    );
}
