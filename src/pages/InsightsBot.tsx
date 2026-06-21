import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bot, Send, Loader2, Sparkles, Gift, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { answerCeoQuestion, CEO_SUGGESTIONS, type ConversationCtx } from '@/lib/ceoAssistantLocal';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Message { role: 'user' | 'assistant'; content: string; }

const MODE_KEY = 'saade.assistant.mode';

export default function InsightsBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'local' | 'ai'>(() => (localStorage.getItem(MODE_KEY) as 'local' | 'ai') || 'local');
  const scrollRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<ConversationCtx>({});

  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendLocal = async (text: string) => {
    const answer = await answerCeoQuestion(text, ctxRef.current);
    setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
  };

  const sendAi = async (text: string, history: Message[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-insights`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: text }] }),
      });
      if (res.status === 429) throw new Error('Limite de débit atteinte. Réessayez dans quelques secondes.');
      if (res.status === 402) throw new Error('Crédits IA épuisés. Basculez en mode Local (gratuit) ou rechargez vos crédits.');
      if (!res.ok) throw new Error(`Erreur IA (${res.status})`);

      // SSE streaming
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              acc += delta;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: acc };
                return next;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${e.message || 'Erreur'}` }]);
    }
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);
    try {
      if (mode === 'ai') await sendAi(text, messages);
      else await sendLocal(text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">Assistant CEO — SAADÉ</h1>
        <Sparkles className="h-4 w-4 text-primary animate-pulse" />

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card">
            <Gift className={`h-3.5 w-3.5 ${mode === 'local' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
            <Label htmlFor="mode" className="text-xs cursor-pointer">Local</Label>
            <Switch id="mode" checked={mode === 'ai'} onCheckedChange={v => setMode(v ? 'ai' : 'local')} />
            <Label htmlFor="mode" className="text-xs cursor-pointer">Lovable AI</Label>
            <Zap className={`h-3.5 w-3.5 ${mode === 'ai' ? 'text-amber-500' : 'text-muted-foreground'}`} />
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${mode === 'local' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}`}>
            {mode === 'local' ? '🆓 gratuit · illimité' : '✨ IA générative · crédits'}
          </span>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <ScrollArea className="flex-1 px-4 pt-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-4">
                <Bot className="h-16 w-16 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground max-w-md mx-auto">
                  {mode === 'local'
                    ? "Mode Local — réponses instantanées depuis votre base, sans crédits. Comprend dates absolues (« CA du 18/06/2026 ») et conserve le contexte."
                    : "Mode Lovable AI — l'IA générative analyse, croise les données et fait des suggestions plus créatives. Consomme des crédits."}
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
                  {CEO_SUGGESTIONS.map(s => (
                    <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => send(s)}>{s}</Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 Pour le <strong>cycle de vie d'une matière première</strong>, allez dans <Link to="/matieres-premieres" className="text-primary underline">Matières Premières</Link> et cliquez sur l'icône <span className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary">📈</span> à droite de la ligne.
                </p>
              </div>
            )}
            <div className="space-y-4 pb-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground whitespace-pre-wrap' : 'bg-muted'
                  }`}>
                    {m.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-table:my-2 prose-th:py-1 prose-td:py-1 prose-a:text-primary">
                        <ReactMarkdown
                          components={{
                            a: ({ href, children }) => href?.startsWith('/')
                              ? <Link to={href} className="text-primary underline">{children}</Link>
                              : <a href={href} target="_blank" rel="noreferrer">{children}</a>,
                          }}
                        >{m.content}</ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
              <Input
                value={input} onChange={e => setInput(e.target.value)}
                placeholder={mode === 'local'
                  ? "Ex : « CA du 18/06/2026 », « Écart de caisse hier », « Pourquoi pas de vente le … »"
                  : "Posez une question ouverte à l'IA…"}
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
            {messages.length > 0 && (
              <div className="flex justify-end mt-2">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setMessages([]); ctxRef.current = {}; toast.success('Conversation effacée'); }}>
                  Nouvelle conversation
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
