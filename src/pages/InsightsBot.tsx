import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Loader2, Sparkles, Gift } from 'lucide-react';
import { answerCeoQuestion, CEO_SUGGESTIONS } from '@/lib/ceoAssistantLocal';

interface Message { role: 'user' | 'assistant'; content: string; }

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
    setMessages(prev => [...prev, { role: 'user', content: text.trim() }]);
    setInput('');
    setLoading(true);
    try {
      const answer = await answerCeoQuestion(text);
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
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
        <span className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          <Gift className="h-3 w-3" /> Local · gratuit · illimité
        </span>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <ScrollArea className="flex-1 px-4 pt-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-4">
                <Bot className="h-16 w-16 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground max-w-md mx-auto">
                  Posez vos questions sur l'activité (ventes, stock, pertes, écarts caisse, ardoises…). Les réponses sont calculées en direct depuis vos données — sans crédits, sans limites.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
                  {CEO_SUGGESTIONS.map(s => (
                    <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => send(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-4 pb-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground whitespace-pre-wrap' : 'bg-muted'
                  }`}>
                    {m.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-table:my-2 prose-th:py-1 prose-td:py-1">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
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
                placeholder="Ex : « CA aujourd'hui », « Ruptures MP », « Écart de caisse »…"
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
