"use client";

import { useRef, useState } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "react-hot-toast";

export function ImageUpload({
  value,
  onChange,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    onChange(file);
    setPreview(URL.createObjectURL(file));
  };

  if (preview) {
    return (
      <div className="group relative overflow-hidden rounded-lg border border-border bg-surface">
        <img src={preview} alt="Token preview" className="h-48 w-full object-cover" />
        <div className="absolute inset-0 flex items-end justify-end bg-black/50 p-3 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              onChange(null);
            }}
            className="rounded-md bg-error px-3 py-1.5 text-sm text-white"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
      className={`flex h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-surface transition ${
        dragOver ? "border-primary bg-surface-hover" : "border-border"
      }`}
    >
      <Upload className={`h-8 w-8 ${dragOver ? "text-primary" : "text-text-secondary"}`} />
      <span className="text-sm text-text-secondary">Drag & drop your token image, or click to browse</span>
      <span className="text-xs text-text-secondary">PNG, JPG, GIF · max 5MB</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </button>
  );
}