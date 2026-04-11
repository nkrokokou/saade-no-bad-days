import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload, FileText } from 'lucide-react';

interface Props {
  onExport: () => void;
  onExportPDF: () => void;
  onImport: (file: File) => void;
  importing?: boolean;
}

export function ExcelImportExport({ onExport, onExportPDF, onImport, importing }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex gap-1 flex-wrap">
      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="h-3.5 w-3.5 mr-1" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={onExportPDF}>
        <FileText className="h-3.5 w-3.5 mr-1" /> PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={importing}>
        <Upload className="h-3.5 w-3.5 mr-1" /> Importer
      </Button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
    </div>
  );
}
