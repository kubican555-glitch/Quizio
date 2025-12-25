                import React, { useState, useEffect, useRef } from 'react';
                import { createPortal } from 'react-dom';
                import * as supabaseModule from '../supabaseClient';
                import { getImageUrl } from '../utils/images'; // Import funkce pro získání URL obrázku

                const supabase = supabaseModule.supabase || supabaseModule.default;

                export const ReportModal = ({ 
                  isOpen, 
                  onClose, 
                  questionId, 
                  questionText, 
                  subject, 
                  questionNumber,
                  options = [],
                  correctIndex,
                  userAnswer,
                  mode,
                  username,
                  userId,
                  theme
                }) => {
                  const [reason, setReason] = useState('');
                  const [loading, setLoading] = useState(false);
                  const [submitStatus, setSubmitStatus] = useState(null);
                  const [imageSrc, setImageSrc] = useState(null); // URL obrázku
                  const [isImageZoomed, setIsImageZoomed] = useState(false); // Stav zvětšení
                  const textareaRef = useRef(null); 

                  const isDark = theme !== 'light';

                  const modeLabels = {
                    mock: "Test nanečisto",
                    random: "Flashcards",
                    training: "Trénink",
                    smart: "Chytré učení",
                    mistakes: "Opravna chyb",
                    review: "Prohlížení",
                    history: "Historie"
                  };

                  useEffect(() => {
                    if (isOpen) {
                       setSubmitStatus(null);
                       setReason('');
                       setIsImageZoomed(false);

                       // Zkusíme načíst URL obrázku, pokud máme předmět a číslo
                       if (subject && questionNumber) {
                           const url = getImageUrl(subject, questionNumber);
                           setImageSrc(url);
                       } else {
                           setImageSrc(null);
                       }
                    }
                  }, [isOpen, subject, questionNumber]);

                  useEffect(() => {
                    if (textareaRef.current) {
                        textareaRef.current.style.height = 'auto'; 
                        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                    }
                  }, [reason, isOpen]);

                  if (!isOpen) return null;

                  const handleKeyDown = (e) => {
                    e.stopPropagation();
                  };

                  const handleSubmit = async (e) => {
                    e.preventDefault();
                    if (!reason.trim()) return;

                    setLoading(true);
                    setSubmitStatus(null); 

                    try {
                      const { data: authData } = await supabase.auth.getUser();
                      const authUser = authData?.user;

                      let contextInfo = "";
                      if (mode) {
                        const modeName = modeLabels[mode] || mode;
                        contextInfo += `[${modeName}] `;
                      }
                      if (subject && questionNumber) {
                        contextInfo += `[${subject} #${questionNumber}] `;
                      }
                      if (questionText) {
                        const shortText = questionText.length > 100 ? questionText.substring(0, 100) + '...' : questionText;
                        contextInfo += shortText;
                      }

                      let finalUserId = authUser ? authUser.id : null;
                      if (!finalUserId && userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
                          finalUserId = userId; 
                      }

                      const reportPayload = {
                        question_id: questionId || 'unknown',
                        reason: reason,
                        user_id: finalUserId,
                        username: username || "Neznámý",
                        additional_info: contextInfo || "Bez kontextu",
                        status: 'pending',
                        created_at: new Date().toISOString()
                      };

                      const { error } = await supabase.from('reports').insert([reportPayload]);
                      if (error) throw error;

                      setSubmitStatus('success'); 
                      setTimeout(() => { onClose(); }, 2000);

                    } catch (error) {
                      console.error('Chyba odeslání:', error);
                      if (error.message && (error.message.includes('username') || error.message.includes('uuid'))) {
                          try {
                              const retryPayload = { 
                                  question_id: reportPayload.question_id,
                                  reason: reportPayload.reason,
                                  additional_info: reportPayload.additional_info + (username ? ` [User: ${username}]` : ""),
                                  status: 'pending'
                              };
                              await supabase.from('reports').insert([retryPayload]);
                              setSubmitStatus('success');
                              setTimeout(() => onClose(), 2000);
                              return;
                          } catch (retryError) { console.error(retryError); }
                      }
                      setSubmitStatus('error');
                    } finally {
                      setLoading(false);
                    }
                  };

                  return createPortal(
                    <>
                        {isImageZoomed && imageSrc && (
                            <div 
                                onClick={() => setIsImageZoomed(false)}
                                style={{
                                    position: 'fixed',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                                    zIndex: 2000,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'zoom-out'
                                }}
                            >
                                <style>{`
                                    .zoomed-image-responsive {
                                        width: 100%;
                                        max-height: 95vh;
                                        object-fit: contain;
                                        transition: width 0.3s ease;
                                    }
                                    @media (min-width: 768px) {
                                        .zoomed-image-responsive {
                                            width: 50%;
                                        }
                                    }
                                `}</style>
                                <img 
                                    src={imageSrc} 
                                    alt="Detail" 
                                    className="zoomed-image-responsive"
                                />
                            </div>
                        )}

                        <div 
                        onKeyDown={handleKeyDown}
                        style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                            backdropFilter: 'blur(5px)'
                        }}
                        >
                        <div style={{
                            backgroundColor: isDark ? '#1f2937' : '#ffffff', 
                            color: 'var(--color-text-main)',
                            padding: '24px', 
                            borderRadius: '12px', 
                            width: '90%', 
                            maxWidth: '600px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', 
                            position: 'relative',
                            maxHeight: '90vh', 
                            display: 'flex', 
                            flexDirection: 'column',
                            border: '1px solid var(--border-color)'
                        }}>
                            <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                            Nahlásit chybu
                            </h2>

                            <div style={{ 
                                marginBottom: '16px', 
                                padding: '15px', 
                                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px', 
                                fontSize: '0.95rem',
                                overflowY: 'auto',
                                flexShrink: 1,
                                maxHeight: '40vh'
                            }}>
                                <div style={{
                                    fontWeight: 'bold', marginBottom: '8px', 
                                    color: 'var(--color-primary-light)',
                                    borderBottom: '1px solid var(--border-color)', 
                                    paddingBottom: '4px',
                                    display: 'flex', justifyContent: 'space-between'
                                }}>
                                    <span>{subject && questionNumber ? `${subject} #${questionNumber}` : 'Otázka'}</span>
                                    {mode && (
                                        <span style={{fontSize: '0.85em', opacity: 0.8, color: 'var(--color-text-secondary)'}}>
                                            {modeLabels[mode] || mode}
                                        </span>
                                    )}
                                </div>

                                <div style={{ 
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: '1.5',
                                    color: 'var(--color-text-main)',
                                    marginBottom: '15px'
                                }}>
                                    {questionText || "Text otázky není k dispozici."}
                                </div>

                                {imageSrc && (
                                    <div style={{ marginBottom: '15px' }}>
                                        <img 
                                            src={imageSrc} 
                                            alt="Obrázek k otázce"
                                            style={{ 
                                                maxHeight: '120px', 
                                                maxWidth: '100%', 
                                                borderRadius: '6px', 
                                                border: '1px solid var(--border-color)',
                                                cursor: 'zoom-in',
                                                display: 'block' 
                                            }}
                                            onClick={() => setIsImageZoomed(true)}
                                            onError={(e) => e.target.style.display = 'none'} 
                                        />
                                    </div>
                                )}

                                {options && options.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Možnosti:</div>
                                        {options.map((opt, idx) => {
                                            const isCorrect = idx === correctIndex;
                                            const isSelected = idx === userAnswer;

                                            let bg = 'transparent';
                                            let border = '1px solid var(--border-color)';
                                            let icon = '⚪';
                                            let labelColor = 'var(--color-text-main)';

                                            if (isCorrect) {
                                                bg = 'rgba(34, 197, 94, 0.15)'; 
                                                border = '1px solid #22c55e';
                                                icon = '✅';
                                                labelColor = '#22c55e'; 
                                            } else if (isSelected) {
                                                bg = 'rgba(239, 68, 68, 0.15)'; 
                                                border = '1px solid #ef4444';
                                                icon = '❌';
                                                labelColor = '#ef4444'; 
                                            }

                                            return (
                                                <div key={idx} style={{ 
                                                    padding: '6px 10px', 
                                                    borderRadius: '6px', 
                                                    backgroundColor: bg, 
                                                    border: border,
                                                    fontSize: '0.9rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    color: labelColor
                                                }}>
                                                    <span>{icon}</span>
                                                    <span style={{ fontWeight: (isCorrect || isSelected) ? '600' : '400' }}>
                                                        {opt} {isSelected && isCorrect && "(Tvoje volba)"} {isSelected && !isCorrect && "(Tvoje volba)"}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', flex: 1}}>
                            <label style={{fontWeight: 500, marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-main)'}}>Popis problému:</label>
                            <textarea
                                ref={textareaRef}
                                autoFocus
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                                placeholder="Popište, co je špatně..."
                                required
                                disabled={loading || submitStatus === 'success'}
                                className="form-input-style"
                                style={{
                                width: '100%', 
                                minHeight: '80px', 
                                resize: 'none', 
                                marginBottom: '16px',
                                fontFamily: 'inherit',
                                overflow: 'hidden',
                                backgroundColor: isDark ? '#374151' : '#ffffff', 
                                color: 'var(--color-text-main)'
                                }}
                            />

                            {submitStatus === 'success' && <div style={{color: '#22c55e', marginBottom: '10px', textAlign: 'center', fontWeight: 'bold'}}>✓ Úspěšně odesláno</div>}
                            {submitStatus === 'error' && <div style={{color: '#ef4444', marginBottom: '10px', textAlign: 'center'}}>❌ Chyba při odesílání</div>}

                            {submitStatus !== 'success' && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 'auto' }}>
                                    <button 
                                    type="button" 
                                    onClick={onClose} 
                                    disabled={loading} 
                                    className="navButton"
                                    style={{ flex: 'none', width: 'auto' }}
                                    >
                                    Zrušit
                                    </button>
                                    <button 
                                    type="submit" 
                                    disabled={loading || !reason.trim()} 
                                    className="navButton primary"
                                    style={{ flex: 'none', width: 'auto' }}
                                    >
                                    {loading ? 'Odesílání...' : 'Nahlásit'}
                                    </button>
                                </div>
                            )}
                            </form>
                        </div>
                        </div>
                    </>,
                    document.body
                  );
                };

                export default ReportModal;