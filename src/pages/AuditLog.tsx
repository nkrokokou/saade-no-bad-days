import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, User } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EmptyState } from '@/components/EmptyState';

const actionColor: Record<string, string> = {
  create: 'bg-green-500/15 text-green-700 dark:text-green-400',
  update: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  delete: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

export default function AuditLog() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
        <History className="h-6 w-6 text-primary" /> Journal d'activité
      </h1>
      <Card>
        <CardHeader><CardTitle>500 dernières actions</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : logs.length === 0 ? (
            <EmptyState icon={History} title="Aucune activité enregistrée" description="Les actions des utilisateurs apparaîtront ici." />
          ) : (
            <ScrollArea className="h-[600px] pr-2">
              <div className="space-y-2">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                    <div className="rounded-full bg-muted p-2">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm truncate">{log.user_email || 'Système'}</span>
                        <Badge className={actionColor[log.action] || 'bg-muted'} variant="secondary">{log.action}</Badge>
                        <span className="text-xs text-muted-foreground">sur</span>
                        <Badge variant="outline" className="text-xs">{log.table_name}</Badge>
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="mt-1 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1 overflow-x-auto">
                          {JSON.stringify(log.details, null, 0).slice(0, 200)}
                        </pre>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: fr })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
