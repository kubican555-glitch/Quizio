import React from 'react';

export function CustomImportGuide({ onBack }) {
    return (
        <div className="container fadeIn" style={{ minHeight: "var(--vh)", paddingBottom: "2rem" }}>
            <div className="top-navbar">
                <button className="menuBackButton" onClick={onBack}>
                    <span style={{ fontSize: '1.2rem', marginRight: '0.2rem' }}>←</span>
                    <span className="mobile-hide-text">Zpět</span>
                </button>
                <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>📂 Vlastní otázky</div>
                <div style={{ width: '40px' }}></div>
            </div>

            <div className="quizContentWrapper" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div className="admin-section-card" style={{ marginBottom: '2rem' }}>
                    <h3 className="admin-section-title">Jak nahrát vlastní otázky?</h3>
                    <p className="admin-description">
                        Můžete si nahrát vlastní sadu otázek ve formátu JSON. Tato data budou uložena pouze 
                        ve vašem prohlížeči pro tuto relaci.
                    </p>
                    
                    <div style={{ background: 'rgba(0,0,0,0.1)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--color-card-border)', marginBottom: '1.5rem' }}>
                        <h4 style={{ marginBottom: '0.8rem', color: 'var(--color-primary-light)' }}>Struktura souboru:</h4>
                        <pre style={{ 
                            fontSize: '0.8rem', 
                            background: '#1e293b', 
                            padding: '1rem', 
                            borderRadius: '8px', 
                            overflowX: 'auto',
                            color: '#cbd5e1',
                            border: '1px solid #334155'
                        }}>
{`[
  {
    "number": 1,
    "question": "Znění vaší první otázky?",
    "options": ["Možnost A", "Možnost B", "Možnost C", "Možnost D"],
    "correctIndex": 0
  }
]`}
                        </pre>
                    </div>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{ border: '2px dashed var(--color-primary)', padding: '2rem', textAlign: 'center', borderRadius: '16px', background: 'rgba(59,130,246,0.03)' }}>
                            <input 
                                type="file" 
                                accept=".json" 
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            try {
                                                const json = JSON.parse(event.target.result);
                                                // We'll call a prop here to pass data back
                                                window.handleCustomImport(json);
                                            } catch (err) {
                                                alert("Chyba při čtení JSON souboru: " + err.message);
                                            }
                                        };
                                        reader.readAsText(file);
                                    }
                                }}
                                style={{ cursor: 'pointer' }} 
                            />
                            <div style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.6 }}>Vyberte soubor .json</div>
                        </div>
                    </div>
                </div>

                <div className="admin-section-card" style={{ opacity: 0.8 }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>💡 Tip pro učitele</h4>
                    <p className="admin-description" style={{ marginBottom: 0 }}>
                        Pokud chcete otázky nahrát trvale pro všechny studenty, použijte <strong>Administraci</strong> (ozubené kolečko v menu), 
                        kde můžete nahrávat CSV soubory a hromadně importovat obrázky.
                    </p>
                </div>
            </div>
        </div>
    );
}
