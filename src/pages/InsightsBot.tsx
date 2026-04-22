import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Loader2, Sparkles } from 'lucide-react';

interface Message { role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = [
  "Quelles sont les tendances de pertes cette semaine ?",
  "Quel produit se vend le mieux ?",
  "Résumé des achats MP du mois",
  "Analyse de rentabilité par catégorie",
];

export default function InsightsBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
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
        if (resp.status === 402) { setMessages(m => [...m, { role: 'assistant', content: "⚠️ Crédits épuisés. Rechargez vos crédits." }]); return; }
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
        <h1 className="text-2xl font-heading font-bold">Assistant SAADÉ</h1>
        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <ScrollArea className="flex-1 px-4 pt-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-4">
                <Bot className="h-16 w-16 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground">Posez une question sur vos données — ventes, pertes, achats, production…</p>
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

          <div className="p-4 border-t">
            <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
              <Input
                value={input} onChange={e => setInput(e.target.value)}
                placeholder="Posez votre question…"
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
