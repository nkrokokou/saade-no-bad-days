import { useState, ReactNode, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

export type KpiColumn = { key: string; label: string; format?: (v: any, row: any) => ReactNode };

type Props = {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  subtitle?: ReactNode;
  detailTitle?: string;
  detailDescription?: string;
  columns: KpiColumn[];
  rows: any[];
  exportFilename?: string;
  emptyMessage?: string;
  footer?: ReactNode;
  className?: string;
};

export function KpiCardClickable({
  title, value, icon, subtitle,
  detailTitle, detailDescription,
  columns, rows, exportFilename, emptyMessage = 'Aucune donnée',
  footer, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const t = q.toLowerCase();
    return rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(t)));
  }, [q, rows]);

  const handleExport = () => {
    const data = filtered.map(r => {
      const o: Record<string, any> = {};
      columns.forEach(c => { o[c.label] = r[c.key]; });
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Détail');
    XLSX.writeFile(wb, `${exportFilename || 'kpi-detail'}.xlsx`);
  };

  return (
    <>
      <Card
        className={`cursor-pointer transition hover:shadow-md hover:border-primary/50 ${className ?? ''}`}
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          <p className="text-[10px] text-muted-foreground/70 mt-2">Cliquer pour voir le détail</p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{detailTitle ?? title}</DialogTitle>
            {detailDescription && <DialogDescription>{detailDescription}</DialogDescription>}
          </DialogHeader>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" className="pl-8 h-8" />
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>

          <ScrollArea className="flex-1 border rounded">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  {columns.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={columns.length} className="text-center text-muted-foreground py-6">{emptyMessage}</TableCell></TableRow>
                ) : filtered.map((r, i) => (
                  <TableRow key={i}>
                    {columns.map(c => (
                      <TableCell key={c.key}>{c.format ? c.format(r[c.key], r) : (r[c.key] ?? '—')}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <p className="text-xs text-muted-foreground">{filtered.length} ligne(s)</p>
            <div className="flex gap-2">
              {footer}
              <Button variant="outline" onClick={() => setOpen(false)}>Fermer</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
