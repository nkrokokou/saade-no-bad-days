create or replace function public.update_consommation_mp() returns trigger language plpgsql as $$
begin
  -- When a new production_labo row is inserted, update the corresponding bon_transfert ligne
  -- Assuming a relation via bon_transfert_id stored in production_labo; adjust as needed
  if NEW.bon_transfert_id is not null then
    update public.bon_transfert_lignes
    set qte_prevue = qte_prevue + NEW.quantite_produite
    where bon_transfert_id = NEW.bon_transfert_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_update_consommation_mp
after insert on public.production_labo
for each row execute function public.update_consommation_mp();
