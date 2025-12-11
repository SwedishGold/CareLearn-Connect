
import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './UI';
import { User, UserData } from '../types';
import * as storage from '../services/localStorageService';
import { playSuccess, playError } from '../services/soundService';

// Global declaration for QR libraries added via CDN in index.html
declare const QRCode: any;
declare const Html5QrcodeScanner: any;

interface SyncModalProps {
    mode: 'share' | 'scan';
    user: User;
    userData?: UserData;
    onClose: () => void;
    onScanSuccess?: (data: any) => void;
}

const SyncModal: React.FC<SyncModalProps> = ({ mode, user, userData, onClose, onScanSuccess }) => {
    const qrRef = useRef<HTMLDivElement>(null);
    const scannerRef = useRef<any>(null);
    const [manualCode, setManualCode] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');

    // --- Share Mode (Generate QR) ---
    useEffect(() => {
        if (mode === 'share' && userData && qrRef.current) {
            // 1. Prepare payload (Compact version of essential data)
            const payload = {
                id: user.id,
                name: user.name,
                role: user.role,
                check: userData.checklistProgress,
                logs: userData.logbookEntries.length, // Just count for brevity in QR? Or last few?
                // Full data might be too big for standard QR. 
                // Strategy: Use a compressed string or just sync essential metrics.
                // For this prototype, we'll try to sync essential progress.
                progress: {
                    goals: userData.goalsProgress,
                    test: userData.knowledgeTestHistory.slice(-1)[0]
                }
            };
            
            // Serialize
            const jsonString = JSON.stringify(payload);
            // Simple compression (fake for demo, real app would use lz-string)
            const compressed = btoa(jsonString);
            setGeneratedCode(compressed);

            // Clear previous
            qrRef.current.innerHTML = '';
            
            // Generate
            new QRCode(qrRef.current, {
                text: compressed,
                width: 256,
                height: 256,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.L
            });
        }
    }, [mode, userData, user]);

    // --- Scan Mode ---
    useEffect(() => {
        if (mode === 'scan') {
            const onScan = (decodedText: string) => {
                try {
                    // Decode
                    const jsonString = atob(decodedText);
                    const data = JSON.parse(jsonString);
                    
                    // Validate basic structure
                    if (data.id && data.name) {
                        playSuccess();
                        if (scannerRef.current) {
                            scannerRef.current.clear();
                        }
                        if (onScanSuccess) onScanSuccess(data);
                        onClose();
                    } else {
                        throw new Error("Ogiltigt dataformat");
                    }
                } catch (e) {
                    console.error("Scan error", e);
                    playError();
                    alert("Kunde inte läsa QR-koden. Är det rätt kod?");
                }
            };

            // Initialize scanner
            // Timeout to ensure modal DOM is ready
            setTimeout(() => {
                if (document.getElementById('reader')) {
                    const scanner = new Html5QrcodeScanner(
                        "reader", 
                        { fps: 10, qrbox: 250 }, 
                        /* verbose= */ false
                    );
                    scanner.render(onScan, (err: any) => { /* ignore frame errors */ });
                    scannerRef.current = scanner;
                }
            }, 100);

            return () => {
                if (scannerRef.current) {
                    scannerRef.current.clear().catch((e:any) => console.error(e));
                }
            };
        }
    }, [mode, onScanSuccess, onClose]);

    const handleManualInput = () => {
        try {
            const jsonString = atob(manualCode);
            const data = JSON.parse(jsonString);
            if (data.id && onScanSuccess) {
                playSuccess();
                onScanSuccess(data);
                onClose();
            }
        } catch (e) {
            alert("Ogiltig kod.");
        }
    };

    return (
        <Modal title={mode === 'share' ? "Dela dina framsteg" : "Synka student"} onClose={onClose}>
            <div className="flex flex-col items-center gap-6 p-4">
                {mode === 'share' ? (
                    <>
                        <p className="text-slate-300 text-center text-sm">
                            Låt din handledare skanna denna kod med sin app för att se dina senaste framsteg.
                        </p>
                        <div className="bg-white p-4 rounded-lg" ref={qrRef}></div>
                        
                        <div className="w-full mt-4">
                            <p className="text-xs text-slate-400 mb-2 text-center">Eller kopiera denna textkod:</p>
                            <textarea 
                                readOnly 
                                value={generatedCode} 
                                className="w-full h-24 bg-slate-800 text-xs text-slate-400 p-2 rounded border border-slate-600 font-mono break-all"
                                onClick={(e) => e.currentTarget.select()}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-slate-300 text-center text-sm">
                            Rikta kameran mot studentens QR-kod för att importera deras data.
                        </p>
                        <div id="reader" className="w-full max-w-sm bg-black overflow-hidden rounded-lg"></div>
                        
                        <div className="w-full border-t border-slate-700 pt-4 mt-2">
                            <p className="text-sm text-slate-400 mb-2 font-bold">Har du ingen kamera?</p>
                            <textarea 
                                placeholder="Klistra in text-koden här..."
                                value={manualCode}
                                onChange={e => setManualCode(e.target.value)}
                                className="w-full h-20 bg-slate-800 text-xs text-white p-2 rounded border border-slate-600 font-mono"
                            />
                            <button onClick={handleManualInput} className="mt-2 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded">
                                Synka via textkod
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default SyncModal;
