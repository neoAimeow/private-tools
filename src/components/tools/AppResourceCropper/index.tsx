import React, { useState, useRef, useCallback } from 'react';
import styles from './style.module.scss';

interface Spec {
    width: number;
    height: number;
    name: string;
    folder: string;
}

const SPECS: Spec[] = [
    // --- Store / Marketing ---
    { width: 512, height: 512, name: "android_play_store_512.png", folder: "store" },
    { width: 1024, height: 1024, name: "ios_app_store_1024.png", folder: "store" },

    // --- iOS App Icon ---
    { width: 20, height: 20, name: "Icon-Notification-20x20@1x.png", folder: "ios" },
    { width: 40, height: 40, name: "Icon-Notification-20x20@2x.png", folder: "ios" },
    { width: 60, height: 60, name: "Icon-Notification-20x20@3x.png", folder: "ios" },
    { width: 29, height: 29, name: "Icon-Settings-29x29@1x.png", folder: "ios" },
    { width: 58, height: 58, name: "Icon-Settings-29x29@2x.png", folder: "ios" },
    { width: 87, height: 87, name: "Icon-Settings-29x29@3x.png", folder: "ios" },
    { width: 40, height: 40, name: "Icon-Spotlight-40x40@1x.png", folder: "ios" },
    { width: 80, height: 80, name: "Icon-Spotlight-40x40@2x.png", folder: "ios" },
    { width: 120, height: 120, name: "Icon-Spotlight-40x40@3x.png", folder: "ios" },
    { width: 120, height: 120, name: "Icon-App-60x60@2x.png", folder: "ios" },
    { width: 180, height: 180, name: "Icon-App-60x60@3x.png", folder: "ios" },
    { width: 76, height: 76, name: "Icon-App-76x76@1x.png", folder: "ios" },
    { width: 152, height: 152, name: "Icon-App-76x76@2x.png", folder: "ios" },
    { width: 167, height: 167, name: "Icon-App-83.5x83.5@2x.png", folder: "ios" },
    { width: 1024, height: 1024, name: "Icon-App-1024x1024.png", folder: "ios" },

    // --- WatchOS ---
    { width: 48, height: 48, name: "Icon-Watch-Notification-24x24@2x.png", folder: "ios" },
    { width: 55, height: 55, name: "Icon-Watch-Notification-27.5x27.5@2x.png", folder: "ios" },
    { width: 58, height: 58, name: "Icon-Watch-Settings-29x29@2x.png", folder: "ios" },
    { width: 64, height: 64, name: "Icon-Watch-Settings-32x32@2x.png", folder: "ios" },
    { width: 80, height: 80, name: "Icon-Watch-App-40x40@2x.png", folder: "ios" },
    { width: 88, height: 88, name: "Icon-Watch-App-44x44@2x.png", folder: "ios" },
    { width: 100, height: 100, name: "Icon-Watch-App-50x50@2x.png", folder: "ios" },
    { width: 172, height: 172, name: "Icon-Watch-App-86x86@2x.png", folder: "ios" },
    { width: 196, height: 196, name: "Icon-Watch-App-98x98@2x.png", folder: "ios" },

    // --- macOS ---
    { width: 16, height: 16, name: "icon_16x16.png", folder: "macos" },
    { width: 32, height: 32, name: "icon_16x16@2x.png", folder: "macos" },
    { width: 32, height: 32, name: "icon_32x32.png", folder: "macos" },
    { width: 64, height: 64, name: "icon_32x32@2x.png", folder: "macos" },
    { width: 128, height: 128, name: "icon_128x128.png", folder: "macos" },
    { width: 256, height: 256, name: "icon_128x128@2x.png", folder: "macos" },
    { width: 256, height: 256, name: "icon_256x256.png", folder: "macos" },
    { width: 512, height: 512, name: "icon_256x256@2x.png", folder: "macos" },
    { width: 512, height: 512, name: "icon_512x512.png", folder: "macos" },
    { width: 1024, height: 1024, name: "icon_512x512@2x.png", folder: "macos" },

    // --- Android Mipmap ---
    { width: 48, height: 48, name: "ic_launcher.png", folder: "android/mipmap-mdpi" },
    { width: 72, height: 72, name: "ic_launcher.png", folder: "android/mipmap-hdpi" },
    { width: 96, height: 96, name: "ic_launcher.png", folder: "android/mipmap-xhdpi" },
    { width: 144, height: 144, name: "ic_launcher.png", folder: "android/mipmap-xxhdpi" },
    { width: 192, height: 192, name: "ic_launcher.png", folder: "android/mipmap-xxxhdpi" },
];

interface GeneratedImage {
    name: string;
    folder: string;
    width: number;
    height: number;
    url: string;
    blob: Blob;
}

export default function AppResourceCropper() {
    const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<GeneratedImage[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) return;
        
        const img = new Image();
        img.onload = () => {
            setSourceImage(img);
            setSourceFile(file);
            setResults([]); // Clear previous results
        };
        img.src = URL.createObjectURL(file);
    };

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, []);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    // Canvas Processing Logic
    const generateImages = async () => {
        if (!sourceImage) return;
        setIsProcessing(true);

        const newResults: GeneratedImage[] = [];

        try {
            // 1. Generate Standard Icons
            for (const spec of SPECS) {
                const canvas = document.createElement('canvas');
                canvas.width = spec.width;
                canvas.height = spec.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) continue;

                // High quality scaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                ctx.drawImage(sourceImage, 0, 0, spec.width, spec.height);
                
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    newResults.push({
                        ...spec,
                        url: URL.createObjectURL(blob),
                        blob
                    });
                }
            }

            // 2. Generate Feature Graphic (1024x500)
            // Logic: Blur BG + Dim + Center Round Icon
            {
                const w = 1024;
                const h = 500;
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    // A. Background (Fill & Blur)
                    // Calculate fill scale
                    const scale = Math.max(w / sourceImage.width, h / sourceImage.height);
                    const bw = sourceImage.width * scale;
                    const bh = sourceImage.height * scale;
                    const bx = (w - bw) / 2;
                    const by = (h - bh) / 2;

                    // Draw BG
                    ctx.filter = 'blur(30px)';
                    // Scale slightly up to avoid blur edges showing white
                    ctx.drawImage(sourceImage, bx - 20, by - 20, bw + 40, bh + 40);
                    ctx.filter = 'none'; // Reset filter

                    // Dimming (Dark Overlay)
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                    ctx.fillRect(0, 0, w, h);

                    // B. Foreground (Center Icon, Rounded)
                    const iconH = 320;
                    const iconW = (sourceImage.width / sourceImage.height) * iconH; // Keep aspect
                    // If square source, iconW is 320.
                    
                    const ix = (w - iconW) / 2;
                    const iy = (h - iconH) / 2;

                    // Radius calculation (iOS style: 22.3% of size)
                    const radius = Math.min(iconW, iconH) * 0.223;

                    ctx.save();
                    // Clip rounded rect
                    ctx.beginPath();
                    if ('roundRect' in ctx) {
                         // @ts-ignore
                         ctx.roundRect(ix, iy, iconW, iconH, radius);
                    } else {
                        // Fallback for older browsers
                        ctx.rect(ix, iy, iconW, iconH);
                    }
                    ctx.clip();

                    ctx.drawImage(sourceImage, ix, iy, iconW, iconH);
                    ctx.restore();

                    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                    if (blob) {
                        newResults.push({
                            width: 1024,
                            height: 500,
                            name: 'google_play_feature_graphic_1024x500.png',
                            folder: 'store',
                            url: URL.createObjectURL(blob),
                            blob
                        });
                    }
                }
            }

            setResults(newResults);

        } catch (err) {
            console.error(err);
            alert("Error processing images.");
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadImage = (img: GeneratedImage) => {
        const a = document.createElement('a');
        a.href = img.url;
        // Construct filename with folder structure if needed, but for single download flat name is often better.
        // Let's use just the name for simplicity, or we could handle folders if downloading all (zip).
        // Requirement: "Click to download corresponding".
        a.download = img.name; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const downloadAll = async () => {
        // Simple sequential download for now as we don't have JSZip installed
        // (and cannot easily add it without permissions).
        // Browsers might block multiple downloads.
        // Alerting user.
        if (!confirm("This will attempt to download " + results.length + " files. Continue?")) return;
        
        for (const res of results) {
            downloadImage(res);
            await new Promise(r => setTimeout(r, 200)); // Delay to help browser cope
        }
    };

    return (
        <div className={styles.container}>
            <div 
                className={`${styles.uploadSection} ${isDragging ? styles.dragActive : ''}`}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className={styles.icon}>🖼️</div>
                <div className={styles.text}>
                    {sourceFile ? sourceFile.name : "Drop App Icon Here"}
                </div>
                <div className={styles.subtext}>
                    1024x1024 PNG recommended
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    hidden 
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
            </div>

            {sourceImage && (
                <div className={styles.previewSection}>
                    <img src={sourceImage.src} alt="Source" />
                    <div className={styles.actions}>
                        <button 
                            className={`${styles.button} ${styles.primary}`}
                            onClick={generateImages}
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Generating...' : 'Generate Resources'}
                        </button>
                    </div>
                </div>
            )}

            {results.length > 0 && (
                <div className={styles.resultsSection}>
                    <h2>
                        Generated Assets
                        <button className={styles.button} onClick={downloadAll}>
                            Download All
                        </button>
                    </h2>
                    <div className={styles.resultsGrid}>
                        {results.map((res, i) => (
                            <div key={i} className={styles.resultCard}>
                                <div className={styles.imageWrapper}>
                                    <img src={res.url} alt={res.name} />
                                </div>
                                <div className={styles.info}>
                                    <div className={styles.name} title={res.name}>{res.name}</div>
                                    <div className={styles.meta}>
                                        <span className={styles.badge}>{res.folder}</span>
                                        <span>{res.width}x{res.height}</span>
                                    </div>
                                </div>
                                <button 
                                    className={styles.button}
                                    onClick={() => downloadImage(res)}
                                >
                                    Download
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
