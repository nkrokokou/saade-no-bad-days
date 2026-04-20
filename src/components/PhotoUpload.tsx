import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Camera, X, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** Resolve a stored value (storage path or legacy public URL) to a displayable URL. */
async function resolvePhotoUrl(value: string): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const { data, error } = await supabase.storage.from('evidence-photos').createSignedUrl(value, 3600);
  if (error) {
    console.error('Signed URL error:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

function useResolvedPhoto(value?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!value) { setUrl(null); return; }
    resolvePhotoUrl(value).then(u => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [value]);
  return url;
}

interface PhotoUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  className?: string;
  size?: 'sm' | 'md';
}

/** Reusable photo upload component with camera capture, used for losses/tastings evidence. */
export function PhotoUpload({ value, onChange, className, size = 'md' }: PhotoUploadProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const resolvedUrl = useResolvedPhoto(value);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo trop lourde (max 5 Mo)');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('evidence-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      // Store the storage path; signed URLs are generated on demand for display
      onChange(path);
      toast.success('Photo ajoutée');
    } catch (e: any) {
      toast.error(e.message || 'Échec upload');
    } finally {
      setUploading(false);
    }
  };

  const remove = () => onChange(null);
  const dim = size === 'sm' ? 'h-10 w-10' : 'h-16 w-16';

  if (value) {
    return (
      <div className={cn('relative group inline-block', className)}>
        <a href={resolvedUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="block">
          {resolvedUrl ? (
            <img src={resolvedUrl} alt="Preuve" className={cn(dim, 'rounded-md object-cover border-2 border-border hover:border-primary transition-colors')} />
          ) : (
            <div className={cn(dim, 'rounded-md border-2 border-border flex items-center justify-center bg-muted')}>
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </div>
          )}
        </a>
        <button
          type="button"
          onClick={remove}
          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          aria-label="Supprimer la photo"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        size={size === 'sm' ? 'sm' : 'default'}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(size === 'sm' && 'h-8 px-2')}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        <span className="ml-1 text-xs">{uploading ? 'Envoi…' : 'Photo'}</span>
      </Button>
    </div>
  );
}

export function PhotoThumbnail({ url }: { url?: string | null }) {
  const resolved = useResolvedPhoto(url);
  if (!url) return <ImageIcon className="h-4 w-4 text-muted-foreground/40" />;
  if (!resolved) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />;
  return (
    <a href={resolved} target="_blank" rel="noopener noreferrer">
      <img src={resolved} alt="Preuve" className="h-8 w-8 rounded object-cover border" />
    </a>
  );
}
