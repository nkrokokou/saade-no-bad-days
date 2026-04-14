import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchFilterProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchFilter({ value, onChange, placeholder = 'Rechercher un produit…', className = '' }: SearchFilterProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8 h-9"
      />
      {value && (
        <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-8" onClick={() => onChange('')}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
