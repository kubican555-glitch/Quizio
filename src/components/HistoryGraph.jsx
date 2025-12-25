import React from 'react';

// Bar Chart s barevným značením podle známek a procenty
// Hranice: 1 (84-100%), 2 (67-83%), 3 (50-66%), 4 (33-49%), 5 (0-32%)
export const HistoryGraph = ({ data = [] }) => {
    // Vezmeme jen posledních 20 záznamů a otočíme (nejstarší vlevo)
    const chartData = [...data]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-20)
        .map(item => {
            const total = item.score?.total || 1;
            const correct = item.score?.correct || 0;
            return Math.round((correct / total) * 100);
        });

    if (chartData.length === 0) {
        return (
            <div style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                opacity: 0.5,
                fontStyle: 'italic'
            }}>
                Zatím žádná data pro graf.
            </div>
        );
    }

    // Funkce pro barvu sloupce podle procent (známky)
    const getBarColor = (percentage) => {
        if (percentage >= 84) return '#22c55e'; // 1 - Výborně (Zelená)
        if (percentage >= 67) return '#84cc16'; // 2 - Chvalitebně (Lime)
        if (percentage >= 50) return '#eab308'; // 3 - Dobře (Žlutá)
        if (percentage >= 33) return '#f97316'; // 4 - Dostatečně (Oranžová)
        return '#ef4444'; // 5 - Nedostatečně (Červená)
    };

    // Konfigurace SVG
    const width = 100;
    const height = 50;

    // Výpočet Y pozic pro prahy (thresholds)
    // Y souřadnice běží shora dolů (0 = 100%, 50 = 0%)
    const y84 = height * (1 - 0.84); // Hranice pro 1
    const y67 = height * (1 - 0.67); // Hranice pro 2
    const y50 = height * (1 - 0.50); // Hranice pro 3
    const y33 = height * (1 - 0.33); // Hranice pro 4

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <svg 
                viewBox={`0 0 ${width} ${height}`} 
                preserveAspectRatio="none"
                style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
                {/* --- ZÓNY ZNÁMEK (PRUHY NA POZADÍ) --- */}

                {/* 1 (84-100%) */}
                <rect x="0" y="0" width={width} height={y84} fill="#22c55e" fillOpacity="0.1" />

                {/* 2 (67-83%) */}
                <rect x="0" y={y84} width={width} height={y67 - y84} fill="#84cc16" fillOpacity="0.05" />

                {/* 3 (50-66%) */}
                <rect x="0" y={y67} width={width} height={y50 - y67} fill="#eab308" fillOpacity="0.05" />

                {/* 4 (33-49%) */}
                <rect x="0" y={y50} width={width} height={y33 - y50} fill="#f97316" fillOpacity="0.04" />

                {/* 5 (0-32%) */}
                <rect x="0" y={y33} width={width} height={height - y33} fill="#ef4444" fillOpacity="0.03" />

                {/* --- HRANIČNÍ ČÁRY (Thresholds) --- */}
                {/* 84% */}
                <line x1="0" y1={y84} x2={width} y2={y84} stroke="#22c55e" strokeOpacity="0.3" strokeWidth="0.2" strokeDasharray="1" /> 
                {/* 67% */}
                <line x1="0" y1={y67} x2={width} y2={y67} stroke="#84cc16" strokeOpacity="0.3" strokeWidth="0.2" strokeDasharray="1" /> 
                {/* 50% */}
                <line x1="0" y1={y50} x2={width} y2={y50} stroke="#eab308" strokeOpacity="0.3" strokeWidth="0.2" strokeDasharray="1" /> 
                {/* 33% */}
                <line x1="0" y1={y33} x2={width} y2={y33} stroke="#f97316" strokeOpacity="0.3" strokeWidth="0.2" strokeDasharray="1" /> 

                {/* --- SLOUPCE (BARS) --- */}
                {chartData.map((val, i) => {
                    // Výpočet pozice X pro každý sloupec
                    const availableWidth = width; 
                    const itemWidth = availableWidth / chartData.length;
                    const barW = Math.max(2, itemWidth * 0.6); // Sloupec zabírá 60% prostoru pro položku
                    const x = (i * itemWidth) + (itemWidth - barW) / 2;

                    const barHeight = (val / 100) * height;
                    const y = height - barHeight;

                    return (
                        <g key={i}>
                            <rect 
                                x={x} 
                                y={y} 
                                width={barW} 
                                height={barHeight} 
                                fill={getBarColor(val)} 
                                rx="0.5" // Jemně zaoblené rohy
                            />
                            {/* Hodnota nad sloupcem - zobrazujeme pouze pokud je málo dat */}
                            {chartData.length <= 15 && (
                                <text 
                                    x={x + barW / 2} 
                                    y={y - 2} 
                                    textAnchor="middle" 
                                    fontSize="2.5" 
                                    fontWeight="bold"
                                    fill="currentColor" 
                                    opacity="0.7"
                                >
                                    {val}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Popisky osy Y (Známky) - VPRAVO (Zarovnáno na střed zóny) */}
            <div style={{ position: 'absolute', right: -15, top: '4%', fontSize: '0.6rem', opacity: 0.8, color: '#22c55e', fontWeight: 'bold' }}>1</div>
            <div style={{ position: 'absolute', right: -15, top: '22%', fontSize: '0.6rem', opacity: 0.8, color: '#84cc16', fontWeight: 'bold' }}>2</div>
            <div style={{ position: 'absolute', right: -15, top: '40%', fontSize: '0.6rem', opacity: 0.8, color: '#eab308', fontWeight: 'bold' }}>3</div>
            <div style={{ position: 'absolute', right: -15, top: '57%', fontSize: '0.6rem', opacity: 0.8, color: '#f97316', fontWeight: 'bold' }}>4</div>
            <div style={{ position: 'absolute', right: -15, top: '82%', fontSize: '0.6rem', opacity: 0.8, color: '#ef4444', fontWeight: 'bold' }}>5</div>

            {/* Popisky osy Y (Procenta) - VLEVO (Zarovnáno přesně na čáry) */}
            <div style={{ position: 'absolute', left: -25, top: '13%', fontSize: '0.6rem', opacity: 0.6, fontWeight: '500', color: '#22c55e', transform: 'translateY(-50%)' }}>84%</div>
            <div style={{ position: 'absolute', left: -25, top: '33%', fontSize: '0.6rem', opacity: 0.6, fontWeight: '500', color: '#84cc16', transform: 'translateY(-50%)' }}>67%</div>
            <div style={{ position: 'absolute', left: -25, top: '50%', fontSize: '0.6rem', opacity: 0.6, fontWeight: '500', color: '#eab308', transform: 'translateY(-50%)' }}>50%</div>
            <div style={{ position: 'absolute', left: -25, top: '67%', fontSize: '0.6rem', opacity: 0.6, fontWeight: '500', color: '#f97316', transform: 'translateY(-50%)' }}>33%</div>
        </div>
    );
};