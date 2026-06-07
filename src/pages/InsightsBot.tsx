import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Loader2, Sparkles, Paperclip, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Message { role: 'user' | 'assistant'; content: string; }
interface Attachment { name: string; content: string; }

const SUGGESTIONS = [
  "Quel est le stock actuel d'économat ?",
  "Quels articles sont en alerte stock ?",
  "Top 5 produits les plus vendus cette semaine",
  "Analyse de rentabilité par catégorie",
  "Résumé des pertes du mois",
];

async function fileToContext(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
      parts.push(`--- Feuille "${name}" ---\n${csv.slice(0, 15000)}`);
    }
    return parts.join('\n\n');
  }
  if (ext === 'pdf') {
    // Texte brut : on extrait le décodage simple ; pour OCR complet utiliser un service serveur
    const buf = await file.arrayBuffer();
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    // Garde uniquement les segments lisibles
    const readable = text.replace(/[^\x20-\x7E\n\r\t\u00C0-\u017F]+/g, ' ').replace(/\s+/g, ' ').trim();
    return readable.slice(0, 15000);
  }
  // Fichiers texte
  const t = await file.text();
  return t.slice(0, 15000);
}

export default function InsightsBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const f of files) {
      try {
        const content = await fileToContext(f);
        if (!content.trim()) { toast.warning(`${f.name} : aucun contenu lisible`); continue; }
        setAttachments(prev => [...prev, { name: f.name, content }]);
        toast.success(`${f.name} prêt à analyser`);
      } catch (err: any) {
        toast.error(`${f.name} : ${err?.message || 'lecture impossible'}`);
      }
    }
  };

  const send = async (text: string) => {
    if ((!text.trim() && attachments.length === 0) || loading) return;
    let userContent = text.trim();
    if (attachments.length) {
      userContent += '\n\n[Fichiers joints]\n' + attachments.map(a => `### ${a.name}\n\`\`\`\n${a.content}\n\`\`\``).join('\n\n');
    }
    const userMsg: Message = { role: 'user', content: userContent };
    const allMessages = [...messages, userMsg];
    setMessages(prev => [...prev, { role: 'user', content: text.trim() || `📎 ${attachments.map(a => a.name).join(', ')}` }]);
    setAttachments([]);
    setInput('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) { setMessages(m => [...m, { role: 'assistant', content: "⚠️ Trop de requêtes. Réessayez dans quelques instants." }]); return; }
        if (resp.status === 402) { setMessages(m => [...m, { role: 'assistant', content: "⚠️ Crédits IA épuisés. Rechargez vos crédits Lovable AI." }]); return; }
        throw new Error('Erreur serveur');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantSoFar = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch { buffer = line + '\n' + buffer; break; }
        }
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: "❌ Erreur de connexion. Réessayez." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">Assistant CEO — SAADÉ</h1>
        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <ScrollArea className="flex-1 px-4 pt-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-4">
                <Bot className="h-16 w-16 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground max-w-md mx-auto">
                  Votre assistante personnelle. Posez n'importe quelle question sur l'activité (stock, ventes, pertes, achats, économat, production) ou joignez un fichier Excel / PDF pour l'analyser.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                  {SUGGESTIONS.map(s => (
                    <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => send(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-4 pb-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {m.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {attachments.length > 0 && (
            <div className="px-4 pt-2 flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <Badge key={i} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                  <FileText className="h-3 w-3" /> {a.name}
                  <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="ml-1 hover:bg-background/50 rounded">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="p-4 border-t">
            <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
              <input ref={fileRef} type="file" multiple accept=".xlsx,.xls,.csv,.pdf,.txt" className="hidden" onChange={onPickFile} />
              <Button type="button" size="icon" variant="outline" onClick={() => fileRef.current?.click()} disabled={loading} title="Joindre un fichier Excel / PDF">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={input} onChange={e => setInput(e.target.value)}
                placeholder="Ex : ‘Quel est le stock de farine ?’ ou joindre un fichier…"
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={loading || (!input.trim() && attachments.length === 0)}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
