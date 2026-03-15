import { useState, useRef } from "react";
import { Upload, Camera, Image as ImageIcon } from "lucide-react";

interface ScanResult {
  classification: string;
  confidence: number;
  similarCount: number;
  affectedBlocks: string[];
  recommendation: string;
  similarImages: { path: string; score: number }[];
}

export function LeafScanner() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    const url = URL.createObjectURL(file);
    setSelectedImage(url);
    setLoading(true);

    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/images/search", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setResult(data);
    } catch {
      // Mock result for development
      setResult({
        classification: "Black Rot",
        confidence: 0.942,
        similarCount: 847,
        affectedBlocks: ["B3", "B7", "C2"],
        recommendation:
          "Apply mancozeb fungicide within 48 hours. Remove infected leaves and fruit mummies. Increase canopy airflow by shoot positioning.",
        similarImages: [
          { path: "/mock/img1.jpg", score: 0.96 },
          { path: "/mock/img2.jpg", score: 0.94 },
          { path: "/mock/img3.jpg", score: 0.91 },
          { path: "/mock/img4.jpg", score: 0.89 },
          { path: "/mock/img5.jpg", score: 0.87 },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-1">Crop Health Scanner</h2>
      <p className="text-sm text-slate-400 mb-6">
        Image similarity search &middot; 15K+ grape disease embeddings &middot;
        kNN on CLIP vectors
      </p>

      <div className="grid grid-cols-2 gap-6">
        {/* Upload Area */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />

          {selectedImage ? (
            <div className="relative">
              <img
                src={selectedImage}
                alt="Uploaded leaf"
                className="w-full rounded-lg border border-slate-700"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute top-2 right-2 p-2 bg-slate-900/80 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Camera size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-64 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center gap-3 text-slate-500 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
            >
              <Upload size={32} />
              <span className="text-sm">Upload leaf image</span>
              <span className="text-xs">or drag and drop</span>
            </button>
          )}
        </div>

        {/* Results */}
        <div>
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-sm text-slate-500 animate-pulse">
                Analyzing image...
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              {/* Classification */}
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-500 mb-1">Classification</div>
                <div className="text-xl font-bold text-red-400">
                  {result.classification}
                </div>
                <div className="text-sm text-slate-400">
                  {(result.confidence * 100).toFixed(1)}% confidence &middot;{" "}
                  {result.similarCount} similar cases
                </div>
              </div>

              {/* Affected Blocks */}
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-500 mb-2">
                  Affected Blocks
                </div>
                <div className="flex gap-2">
                  {result.affectedBlocks.map((b) => (
                    <span
                      key={b}
                      className="px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              {/* Recommendation */}
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <div className="text-xs text-amber-400 font-medium mb-1">
                  Recommendation
                </div>
                <p className="text-sm text-slate-300">{result.recommendation}</p>
              </div>

              {/* Similar Images */}
              <div>
                <div className="text-xs text-slate-500 mb-2">
                  Similar Images (kNN)
                </div>
                <div className="flex gap-2">
                  {result.similarImages.map((img, i) => (
                    <div
                      key={i}
                      className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center"
                    >
                      <ImageIcon size={16} className="text-slate-600" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-1">
                  {result.similarImages.map((img, i) => (
                    <div
                      key={i}
                      className="w-16 text-center text-[10px] text-slate-600 font-mono"
                    >
                      {img.score.toFixed(2)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
