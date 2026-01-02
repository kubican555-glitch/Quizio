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

    // Funkce pro barvu bodu/čáry podle procent (známky)
    const getPointColor = (percentage) => {
        if (percentage >= 84) return '#22c55e'; // 1 - Výborně (Zelená)
        if (percentage >= 67) return '#84cc16'; // 2 - Chvalitebně (Lime)
        if (percentage >= 50) return '#eab308'; // 3 - Dobře (Žlutá)
        if (percentage >= 43) return '#f97316'; // 4 - Dostatečně (Oranžová)
        return '#ef4444'; // 5 - Nedostatečně (Červená)
    };

    // Konfigurace SVG
    const width = 100;
    const height = 50;
    const padding = 5; // Padding pro body aby nebyly na kraji

    // Výpočet Y pozic pro prahy (thresholds)
    const y84 = height * (1 - 0.84);
    const y67 = height * (1 - 0.67);
    const y50 = height * (1 - 0.50);
    const y33 = height * (1 - 0.33);

    // Výpočet bodů pro čáru
    const points = chartData.map((val, i) => {
        const x = (i / (Math.max(1, chartData.length - 1))) * (width - padding * 2) + padding;
        const y = height - (val / 100) * height;
        return { x, y, val };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <svg 
                viewBox={`0 0 ${width} ${height}`} 
                preserveAspectRatio="none"
                style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
                {/* --- ZÓNY ZNÁMEK (PRUHY NA POZADÍ) --- */}
                <rect x="0" y="0" width={width} height={y84} fill="#22c55e" fillOpacity="0.08" />
                <rect x="0" y={y84} width={width} height={y67 - y84} fill="#84cc16" fillOpacity="0.04" />
                <rect x="0" y={y67} width={width} height={y50 - y67} fill="#eab308" fillOpacity="0.04" />
                <rect x="0" y={y50} width={width} height={y33 - y50} fill="#f97316" fillOpacity="0.03" />
                <rect x="0" y={y33} width={width} height={height - y33} fill="#ef4444" fillOpacity="0.02" />

                {/* --- HRANIČNÍ ČÁRY (Thresholds) --- */}
                <line x1="0" y1={y84} x2={width} y2={y84} stroke="#22c55e" strokeOpacity="0.2" strokeWidth="0.1" strokeDasharray="1" /> 
                <line x1="0" y1={y67} x2={width} y2={y67} stroke="#84cc16" strokeOpacity="0.2" strokeWidth="0.1" strokeDasharray="1" /> 
                <line x1="0" y1={y50} x2={width} y2={y50} stroke="#eab308" strokeOpacity="0.2" strokeWidth="0.1" strokeDasharray="1" /> 
                <line x1="0" y1={y33} x2={width} y2={y33} stroke="#f97316" strokeOpacity="0.2" strokeWidth="0.1" strokeDasharray="1" /> 

                {/* --- SPOJNICE (LINE) --- */}
                <path 
                    d={linePath} 
                    fill="none" 
                    stroke="var(--color-primary)" 
                    strokeWidth="0.8" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ opacity: 0.6 }}
                />

                {/* --- BODY (POINTS) --- */}
                {points.map((p, i) => (
                    <g key={i}>
                        <circle 
                            cx={p.x} 
                            cy={p.y} 
                            r="1.2" 
                            fill={getPointColor(p.val)}
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="0.3"
                        />
                        {/* Hodnota nad bodem - pouze pokud je málo dat */}
                        {chartData.length <= 12 && (
                            <text 
                                x={p.x} 
                                y={p.y - 2.5} 
                                textAnchor="middle" 
                                fontSize="2.2" 
                                fontWeight="bold"
                                fill="currentColor" 
                                opacity="0.8"
                            >
                                {p.val}%
                            </text>
                        )}
                    </g>
                ))}
            </svg>

            {/* Popisky osy Y (Známky) - VPRAVO (Zarovnáno na střed zóny) */}
            <div style={{ position: 'absolute', right: -15, top: '4%', fontSize: '0.65rem', opacity: 1, color: '#4ade80', fontWeight: '800' }}>1</div>
            <div style={{ position: 'absolute', right: -15, top: '22%', fontSize: '0.65rem', opacity: 1, color: '#a3e635', fontWeight: '800' }}>2</div>
            <div style={{ position: 'absolute', right: -15, top: '40%', fontSize: '0.65rem', opacity: 1, color: '#fde047', fontWeight: '800' }}>3</div>
            <div style={{ position: 'absolute', right: -15, top: '57%', fontSize: '0.65rem', opacity: 1, color: '#fb923c', fontWeight: '800' }}>4</div>
            <div style={{ position: 'absolute', right: -15, top: '82%', fontSize: '0.65rem', opacity: 1, color: '#f87171', fontWeight: '800' }}>5</div>

            {/* Popisky osy Y (Procenta) - VLEVO (Zarovnáno přesně na čáry) */}
            <div style={{ position: 'absolute', left: -25, top: '13%', fontSize: '0.6rem', opacity: 0.9, fontWeight: '700', color: '#4ade80', transform: 'translateY(-50%)' }}>84%</div>
            <div style={{ position: 'absolute', left: -25, top: '33%', fontSize: '0.6rem', opacity: 0.9, fontWeight: '700', color: '#a3e635', transform: 'translateY(-50%)' }}>67%</div>
            <div style={{ position: 'absolute', left: -25, top: '50%', fontSize: '0.6rem', opacity: 0.9, fontWeight: '700', color: '#fde047', transform: 'translateY(-50%)' }}>50%</div>
            <div style={{ position: 'absolute', left: -25, top: '67%', fontSize: '0.6rem', opacity: 0.9, fontWeight: '700', color: '#fb923c', transform: 'translateY(-50%)' }}>33%</div>
        </div>
    );
};