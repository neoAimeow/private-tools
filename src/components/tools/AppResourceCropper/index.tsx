import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Upload, Image as ImageIcon, Download, Loader2, FileDown, Trash2 } from 'lucide-react';

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
                    const scale = Math.max(w / sourceImage.width, h / sourceImage.height);
                    const bw = sourceImage.width * scale;
                    const bh = sourceImage.height * scale;
                    const bx = (w - bw) / 2;
                    const by = (h - bh) / 2;

                    ctx.filter = 'blur(30px)';
                    ctx.drawImage(sourceImage, bx - 20, by - 20, bw + 40, bh + 40);
                    ctx.filter = 'none';

                    // Dimming
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                    ctx.fillRect(0, 0, w, h);

                    // B. Foreground (Center Icon, Rounded)
                    const iconH = 320;
                    const iconW = (sourceImage.width / sourceImage.height) * iconH;
                    
                    const ix = (w - iconW) / 2;
                    const iy = (h - iconH) / 2;
                    const radius = Math.min(iconW, iconH) * 0.223;

                    ctx.save();
                    ctx.beginPath();
                    if ('roundRect' in ctx) {
                         // @ts-ignore
                         ctx.roundRect(ix, iy, iconW, iconH, radius);
                    } else {
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
        a.download = img.name; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const downloadAll = async () => {
        if (!confirm("This will attempt to download " + results.length + " files. Continue?")) return;
        
        for (const res of results) {
            downloadImage(res);
            await new Promise(r => setTimeout(r, 200));
        }
    };

    const reset = () => {
        setSourceImage(null);
        setSourceFile(null);
        setResults([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Upload Area */}
            <div 
                className={`
                    group relative flex flex-col items-center justify-center p-12 text-center 
                    border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer
                    ${isDragging 
                        ? 'border-primary bg-primary/5 scale-[1.01]' 
                        : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                    }
                    ${sourceImage ? 'hidden' : 'block'}
                `}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Drop App Icon Here</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                    Supports PNG, JPG, WEBP. <br/>
                    <span className="font-medium text-foreground">1024x1024 PNG</span> recommended for best results.
                </p>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    hidden 
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
            </div>

            {/* Preview & Action Area */}
            {sourceImage && (
                <Card className="overflow-hidden border-border/50 shadow-md">
                    <CardContent className="p-8">
                        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                            <div className="relative shrink-0">
                                <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-transparent rounded-3xl" />
                                <img 
                                    src={sourceImage.src} 
                                    alt="Source" 
                                    className="w-48 h-48 md:w-64 md:h-64 object-contain rounded-3xl shadow-xl bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2YwZjBmMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiAvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiAvPjwvc3ZnPg==')] bg-white"
                                />
                                <div className="absolute -bottom-4 -right-4 bg-background border border-border px-3 py-1 rounded-full text-xs font-mono shadow-sm">
                                    {sourceImage.width} x {sourceImage.height}
                                </div>
                            </div>
                            
                            <div className="flex-1 text-center md:text-left space-y-6">
                                <div>
                                    <h3 className="text-2xl font-bold mb-2">{sourceFile?.name}</h3>
                                    <p className="text-muted-foreground">
                                        Ready to generate {SPECS.length + 1} assets for iOS, Android, and Stores.
                                    </p>
                                </div>
                                
                                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                                    <Button 
                                        size="lg" 
                                        onClick={generateImages} 
                                        disabled={isProcessing}
                                        className="min-w-[160px]"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <ImageIcon className="w-4 h-4 mr-2" />
                                                Generate Assets
                                            </>
                                        )}
                                    </Button>
                                    <Button variant="outline" size="lg" onClick={reset}>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Clear
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Results Grid */}
            {results.length > 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold tracking-tight">Generated Assets <span className="text-muted-foreground text-lg font-normal ml-2">({results.length})</span></h2>
                        <Button onClick={downloadAll} variant="secondary">
                            <Download className="w-4 h-4 mr-2" />
                            Download All
                        </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {results.map((res, i) => (
                            <Card key={i} className="group overflow-hidden border-border/50 transition-all hover:shadow-lg hover:border-primary/20">
                                <div className="aspect-square relative p-4 flex items-center justify-center bg-muted/20 group-hover:bg-muted/30 transition-colors">
                                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2YwZjBmMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiAvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiAvPjwvc3ZnPg==')] opacity-30" />
                                    <img 
                                        src={res.url} 
                                        alt={res.name} 
                                        className="max-w-full max-h-full object-contain shadow-sm group-hover:scale-105 transition-transform duration-300"
                                    />
                                </div>
                                <CardContent className="p-3">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="min-w-0">
                                            <p className="font-medium text-xs truncate" title={res.name}>{res.name}</p>
                                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                {res.width} x {res.height}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                                            {res.folder}
                                        </span>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-6 w-6" 
                                            onClick={() => downloadImage(res)}
                                            title="Download"
                                        >
                                            <FileDown className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
