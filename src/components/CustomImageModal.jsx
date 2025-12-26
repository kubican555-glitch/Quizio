import React from "react";
import { createPortal } from "react-dom";

export const CustomImageModal = ({ src, onClose }) => {
    if (!src) return null;
    return createPortal(
        <div 
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'zoom-out',
                backdropFilter: 'blur(5px)'
            }}
        >
            <style>{`
                .zoomed-image-responsive {
                    width: 100%;
                    max-height: 95vh;
                    object-fit: contain;
                    transition: width 0.3s ease;
                    border-radius: 8px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                }
                @media (min-width: 768px) {
                    .zoomed-image-responsive {
                        width: 50%;
                    }
                }
            `}</style>
            <img 
                src={src} 
                alt="Detail" 
                className="zoomed-image-responsive"
            />
        </div>,
        document.body
    );
};