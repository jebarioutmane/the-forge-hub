import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";

interface ExcelUploaderProps {
  onDataExtracted: (data: any[]) => void;
  className?: string;
}

export function ExcelUploader({ onDataExtracted, className }: ExcelUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result;
        if (!buffer) return;
        const workbook = XLSX.read(buffer, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log("Extracted Data:", jsonData);
        setFileName(file.name);
        onDataExtracted(jsonData);
      };
      reader.readAsArrayBuffer(file);
    },
    [onDataExtracted]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all duration-200",
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleChange}
        className="hidden"
      />

      {fileName ? (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <div>
            <p className="text-sm font-medium text-foreground">File loaded</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {fileName}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Drag & drop Excel or CSV to auto-fill
            </p>
            <p className="text-xs text-muted-foreground">
              .xlsx, .xls, .csv supported
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
