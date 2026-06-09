export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achats_mp: {
        Row: {
          created_at: string
          created_by: string | null
          date_achat: string
          fournisseur: string
          id: string
          matiere_premiere_id: string | null
          prix_total: number
          prix_unitaire: number
          produit: string
          quantite: number
          unite: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_achat: string
          fournisseur?: string
          id?: string
          matiere_premiere_id?: string | null
          prix_total?: number
          prix_unitaire?: number
          produit: string
          quantite?: number
          unite?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_achat?: string
          fournisseur?: string
          id?: string
          matiere_premiere_id?: string | null
          prix_total?: number
          prix_unitaire?: number
          produit?: string
          quantite?: number
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achats_mp_matiere_premiere_id_fkey"
            columns: ["matiere_premiere_id"]
            isOneToOne: false
            referencedRelation: "matieres_premieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achats_mp_matiere_premiere_id_fkey"
            columns: ["matiere_premiere_id"]
            isOneToOne: false
            referencedRelation: "v_stock_matieres_premieres"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audits_ceo: {
        Row: {
          ameliorations: string | null
          commentaires: string | null
          created_at: string
          created_by: string | null
          date_audit: string
          defauts: string | null
          id: string
          rubriques: Json
          updated_at: string
        }
        Insert: {
          ameliorations?: string | null
          commentaires?: string | null
          created_at?: string
          created_by?: string | null
          date_audit?: string
          defauts?: string | null
          id?: string
          rubriques?: Json
          updated_at?: string
        }
        Update: {
          ameliorations?: string | null
          commentaires?: string | null
          created_at?: string
          created_by?: string | null
          date_audit?: string
          defauts?: string | null
          id?: string
          rubriques?: Json
          updated_at?: string
        }
        Relationships: []
      }
      bon_transfert_lignes: {
        Row: {
          bon_transfert_id: string
          created_at: string
          id: string
          perte: number
          produit_id: string
          qte_prevue: number
          qte_recue: number
          solde_fin: number
          solde_ouverture: number
        }
        Insert: {
          bon_transfert_id: string
          created_at?: string
          id?: string
          perte?: number
          produit_id: string
          qte_prevue?: number
          qte_recue?: number
          solde_fin?: number
          solde_ouverture?: number
        }
        Update: {
          bon_transfert_id?: string
          created_at?: string
          id?: string
          perte?: number
          produit_id?: string
          qte_prevue?: number
          qte_recue?: number
          solde_fin?: number
          solde_ouverture?: number
        }
        Relationships: [
          {
            foreignKeyName: "bon_transfert_lignes_bon_transfert_id_fkey"
            columns: ["bon_transfert_id"]
            isOneToOne: false
            referencedRelation: "bons_transfert"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bon_transfert_lignes_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      bons_transfert: {
        Row: {
          created_at: string
          created_by: string | null
          date_transfert: string
          id: string
          notes: string | null
          received_at: string | null
          received_by: string | null
          sent_at: string | null
          sent_by: string | null
          statut: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_transfert: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          sent_at?: string | null
          sent_by?: string | null
          statut?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_transfert?: string
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          sent_at?: string | null
          sent_by?: string | null
          statut?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: []
      }
      categories_produits: {
        Row: {
          actif: boolean
          created_at: string
          id: string
          imprimante_cible: string | null
          nom: string
          ordre: number
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          id?: string
          imprimante_cible?: string | null
          nom: string
          ordre?: number
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          id?: string
          imprimante_cible?: string | null
          nom?: string
          ordre?: number
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_produits_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_produits"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          actif: boolean
          adresse: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          nom: string
          notes: string | null
          plafond_credit: number
          telephone: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nom: string
          notes?: string | null
          plafond_credit?: number
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nom?: string
          notes?: string | null
          plafond_credit?: number
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cloture_journaliere: {
        Row: {
          created_at: string
          created_by: string | null
          date_cloture: string
          id: string
          prix_invendu_50: number
          produit_id: string
          qte_degustation: number
          qte_invendu: number
          qte_perte: number
          qte_recue: number
          qte_vendue: number
          stock_fin_compte: number | null
          stock_ouverture: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_cloture: string
          id?: string
          prix_invendu_50?: number
          produit_id: string
          qte_degustation?: number
          qte_invendu?: number
          qte_perte?: number
          qte_recue?: number
          qte_vendue?: number
          stock_fin_compte?: number | null
          stock_ouverture?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_cloture?: string
          id?: string
          prix_invendu_50?: number
          produit_id?: string
          qte_degustation?: number
          qte_invendu?: number
          qte_perte?: number
          qte_recue?: number
          qte_vendue?: number
          stock_fin_compte?: number | null
          stock_ouverture?: number
        }
        Relationships: [
          {
            foreignKeyName: "cloture_journaliere_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      credits_clients: {
        Row: {
          client_id: string | null
          client_nom: string
          created_at: string
          created_by: string | null
          date_credit: string
          id: string
          montant_initial: number
          montant_restant: number
          notes: string | null
          statut: string
          updated_at: string
          vente_id: string | null
        }
        Insert: {
          client_id?: string | null
          client_nom: string
          created_at?: string
          created_by?: string | null
          date_credit?: string
          id?: string
          montant_initial?: number
          montant_restant?: number
          notes?: string | null
          statut?: string
          updated_at?: string
          vente_id?: string | null
        }
        Update: {
          client_id?: string | null
          client_nom?: string
          created_at?: string
          created_by?: string | null
          date_credit?: string
          id?: string
          montant_initial?: number
          montant_restant?: number
          notes?: string | null
          statut?: string
          updated_at?: string
          vente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credits_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      degustations: {
        Row: {
          created_at: string
          created_by: string | null
          date_degustation: string
          id: string
          motif: string | null
          photo_url: string | null
          produit_id: string
          quantite: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_degustation: string
          id?: string
          motif?: string | null
          photo_url?: string | null
          produit_id: string
          quantite?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_degustation?: string
          id?: string
          motif?: string | null
          photo_url?: string | null
          produit_id?: string
          quantite?: number
        }
        Relationships: [
          {
            foreignKeyName: "degustations_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      economat_articles: {
        Row: {
          actif: boolean
          categorie: string
          created_at: string
          id: string
          nom: string
          notes: string | null
          prix_unitaire: number
          stock_initial: number
          stock_min: number
          unite: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          categorie?: string
          created_at?: string
          id?: string
          nom: string
          notes?: string | null
          prix_unitaire?: number
          stock_initial?: number
          stock_min?: number
          unite?: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          categorie?: string
          created_at?: string
          id?: string
          nom?: string
          notes?: string | null
          prix_unitaire?: number
          stock_initial?: number
          stock_min?: number
          unite?: string
          updated_at?: string
        }
        Relationships: []
      }
      economat_mouvements: {
        Row: {
          article_id: string
          created_at: string
          created_by: string | null
          date_mouvement: string
          id: string
          motif: string | null
          photo_url: string | null
          quantite: number
          type: string
        }
        Insert: {
          article_id: string
          created_at?: string
          created_by?: string | null
          date_mouvement?: string
          id?: string
          motif?: string | null
          photo_url?: string | null
          quantite?: number
          type: string
        }
        Update: {
          article_id?: string
          created_at?: string
          created_by?: string | null
          date_mouvement?: string
          id?: string
          motif?: string | null
          photo_url?: string | null
          quantite?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "economat_mouvements_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "economat_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "economat_mouvements_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "v_economat_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      fiches_techniques: {
        Row: {
          cout_unitaire_mp: number
          created_at: string
          created_by: string | null
          id: string
          matiere_premiere: string | null
          matiere_premiere_id: string | null
          produit_id: string
          quantite_mp: number
          unite_mp: string
        }
        Insert: {
          cout_unitaire_mp?: number
          created_at?: string
          created_by?: string | null
          id?: string
          matiere_premiere?: string | null
          matiere_premiere_id?: string | null
          produit_id: string
          quantite_mp?: number
          unite_mp?: string
        }
        Update: {
          cout_unitaire_mp?: number
          created_at?: string
          created_by?: string | null
          id?: string
          matiere_premiere?: string | null
          matiere_premiere_id?: string | null
          produit_id?: string
          quantite_mp?: number
          unite_mp?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiches_techniques_matiere_premiere_id_fkey"
            columns: ["matiere_premiere_id"]
            isOneToOne: false
            referencedRelation: "matieres_premieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiches_techniques_matiere_premiere_id_fkey"
            columns: ["matiere_premiere_id"]
            isOneToOne: false
            referencedRelation: "v_stock_matieres_premieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiches_techniques_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      inventaire: {
        Row: {
          created_at: string
          created_by: string | null
          date_inventaire: string
          id: string
          nom_produit: string
          quantite: number
          section: string
          unite: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_inventaire: string
          id?: string
          nom_produit: string
          quantite?: number
          section: string
          unite?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_inventaire?: string
          id?: string
          nom_produit?: string
          quantite?: number
          section?: string
          unite?: string | null
        }
        Relationships: []
      }
      matieres_premieres: {
        Row: {
          actif: boolean
          colisage: number
          created_at: string
          fournisseur: string | null
          id: string
          marque: string | null
          nom: string
          notes: string | null
          prix_achat: number
          prix_unitaire: number
          stock_min: number
          unite: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          colisage?: number
          created_at?: string
          fournisseur?: string | null
          id?: string
          marque?: string | null
          nom: string
          notes?: string | null
          prix_achat?: number
          prix_unitaire?: number
          stock_min?: number
          unite?: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          colisage?: number
          created_at?: string
          fournisseur?: string | null
          id?: string
          marque?: string | null
          nom?: string
          notes?: string | null
          prix_achat?: number
          prix_unitaire?: number
          stock_min?: number
          unite?: string
          updated_at?: string
        }
        Relationships: []
      }
      module_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_read: boolean
          can_update: boolean
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          submodule: string | null
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          submodule?: string | null
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_read?: boolean
          can_update?: boolean
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          submodule?: string | null
        }
        Relationships: []
      }
      mouvements_stock: {
        Row: {
          created_at: string
          created_by: string | null
          date_mouvement: string
          id: string
          motif: string | null
          produit_id: string
          quantite: number
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_mouvement: string
          id?: string
          motif?: string | null
          produit_id: string
          quantite?: number
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_mouvement?: string
          id?: string
          motif?: string | null
          produit_id?: string
          quantite?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mouvements_stock_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lien: string | null
          lue: boolean
          message: string
          role_cible: Database["public"]["Enums"]["app_role"] | null
          severite: string
          titre: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lien?: string | null
          lue?: boolean
          message: string
          role_cible?: Database["public"]["Enums"]["app_role"] | null
          severite?: string
          titre: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lien?: string | null
          lue?: boolean
          message?: string
          role_cible?: Database["public"]["Enums"]["app_role"] | null
          severite?: string
          titre?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      paiements_credits: {
        Row: {
          created_at: string
          created_by: string | null
          credit_id: string
          date_paiement: string
          id: string
          mode_paiement: string
          montant: number
          notes: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_id: string
          date_paiement?: string
          id?: string
          mode_paiement?: string
          montant?: number
          notes?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_id?: string
          date_paiement?: string
          id?: string
          mode_paiement?: string
          montant?: number
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_credits_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pertes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          jour: string
          photo_url: string | null
          produit_id: string
          quantite: number
          semaine_debut: string
          type_labo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          jour: string
          photo_url?: string | null
          produit_id: string
          quantite?: number
          semaine_debut: string
          type_labo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          jour?: string
          photo_url?: string | null
          produit_id?: string
          quantite?: number
          semaine_debut?: string
          type_labo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pertes_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      production_labo: {
        Row: {
          created_at: string
          created_by: string | null
          date_production: string
          id: string
          produit_id: string
          qte_perte: number
          qte_produite: number
          qte_sortie_en_salle: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_production: string
          id?: string
          produit_id: string
          qte_perte?: number
          qte_produite?: number
          qte_sortie_en_salle?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_production?: string
          id?: string
          produit_id?: string
          qte_perte?: number
          qte_produite?: number
          qte_sortie_en_salle?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_labo_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      produits: {
        Row: {
          actif: boolean
          categorie: string
          created_at: string
          id: string
          imprimante_cible: string | null
          nom: string
          photo_url: string | null
          poste_preparation: string
          prix_cout: number
          prix_vente: number
          sous_categorie: string | null
          unite: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean
          categorie?: string
          created_at?: string
          id?: string
          imprimante_cible?: string | null
          nom: string
          photo_url?: string | null
          poste_preparation?: string
          prix_cout?: number
          prix_vente?: number
          sous_categorie?: string | null
          unite?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean
          categorie?: string
          created_at?: string
          id?: string
          imprimante_cible?: string | null
          nom?: string
          photo_url?: string | null
          poste_preparation?: string
          prix_cout?: number
          prix_vente?: number
          sous_categorie?: string | null
          unite?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      rapports_journaliers: {
        Row: {
          created_at: string
          date_rapport: string
          email_destinataire: string
          error_message: string | null
          id: string
          payload: Json
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_rapport: string
          email_destinataire: string
          error_message?: string | null
          id?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_rapport?: string
          email_destinataire?: string
          error_message?: string | null
          id?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sessions_caisse: {
        Row: {
          ecart: number | null
          ferme_at: string | null
          ferme_par: string | null
          fond_final_attendu: number | null
          fond_final_compte: number | null
          fond_initial: number
          id: string
          motif_fermeture: string | null
          notes: string | null
          ouvert_at: string
          ouvert_par: string | null
          session_parent_id: string | null
          statut: string
        }
        Insert: {
          ecart?: number | null
          ferme_at?: string | null
          ferme_par?: string | null
          fond_final_attendu?: number | null
          fond_final_compte?: number | null
          fond_initial?: number
          id?: string
          motif_fermeture?: string | null
          notes?: string | null
          ouvert_at?: string
          ouvert_par?: string | null
          session_parent_id?: string | null
          statut?: string
        }
        Update: {
          ecart?: number | null
          ferme_at?: string | null
          ferme_par?: string | null
          fond_final_attendu?: number | null
          fond_final_compte?: number | null
          fond_initial?: number
          id?: string
          motif_fermeture?: string | null
          notes?: string | null
          ouvert_at?: string
          ouvert_par?: string | null
          session_parent_id?: string | null
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_caisse_session_parent_id_fkey"
            columns: ["session_parent_id"]
            isOneToOne: false
            referencedRelation: "sessions_caisse"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_tampon: {
        Row: {
          created_at: string
          created_by: string | null
          date_stock: string
          id: string
          produit_id: string
          quantite: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_stock: string
          id?: string
          produit_id: string
          quantite?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_stock?: string
          id?: string
          produit_id?: string
          quantite?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_tampon_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      tables_restaurant: {
        Row: {
          actif: boolean
          created_at: string
          id: string
          numero: string
          places: number
          updated_at: string
          zone: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          id?: string
          numero: string
          places?: number
          updated_at?: string
          zone?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          id?: string
          numero?: string
          places?: number
          updated_at?: string
          zone?: string | null
        }
        Relationships: []
      }
      ticket_templates: {
        Row: {
          exclude_boissons: boolean
          extra_css: string | null
          font_size_px: number
          footer_legal: string | null
          footer_message: string | null
          group_by_category: boolean
          header_address: string | null
          header_phone: string | null
          header_subtitle: string | null
          header_title: string
          id: string
          paper_width_mm: number
          show_caissier: boolean
          show_change: boolean
          show_datetime: boolean
          show_payment_mode: boolean
          show_prices: boolean
          show_serveur: boolean
          show_table: boolean
          show_ticket_number: boolean
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          exclude_boissons?: boolean
          extra_css?: string | null
          font_size_px?: number
          footer_legal?: string | null
          footer_message?: string | null
          group_by_category?: boolean
          header_address?: string | null
          header_phone?: string | null
          header_subtitle?: string | null
          header_title?: string
          id?: string
          paper_width_mm?: number
          show_caissier?: boolean
          show_change?: boolean
          show_datetime?: boolean
          show_payment_mode?: boolean
          show_prices?: boolean
          show_serveur?: boolean
          show_table?: boolean
          show_ticket_number?: boolean
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          exclude_boissons?: boolean
          extra_css?: string | null
          font_size_px?: number
          footer_legal?: string | null
          footer_message?: string | null
          group_by_category?: boolean
          header_address?: string | null
          header_phone?: string | null
          header_subtitle?: string | null
          header_title?: string
          id?: string
          paper_width_mm?: number
          show_caissier?: boolean
          show_change?: boolean
          show_datetime?: boolean
          show_payment_mode?: boolean
          show_prices?: boolean
          show_serveur?: boolean
          show_table?: boolean
          show_ticket_number?: boolean
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          palette: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          palette?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          palette?: string
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vente_lignes: {
        Row: {
          created_at: string
          id: string
          prix_unitaire: number
          produit_id: string
          produit_nom: string
          quantite: number
          remise: number
          total_ligne: number
          vente_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prix_unitaire?: number
          produit_id: string
          produit_nom: string
          quantite?: number
          remise?: number
          total_ligne?: number
          vente_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prix_unitaire?: number
          produit_id?: string
          produit_nom?: string
          quantite?: number
          remise?: number
          total_ligne?: number
          vente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vente_lignes_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vente_lignes_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      ventes: {
        Row: {
          client_id: string | null
          client_nom: string | null
          created_at: string
          date_vente: string
          encaisse_par: string | null
          id: string
          mode_paiement: string
          montant_recu: number | null
          notes: string | null
          numero_ticket: number
          remise_globale: number
          rendu: number | null
          serveur_id: string | null
          session_id: string | null
          statut: string
          table_id: string | null
          total: number
        }
        Insert: {
          client_id?: string | null
          client_nom?: string | null
          created_at?: string
          date_vente?: string
          encaisse_par?: string | null
          id?: string
          mode_paiement?: string
          montant_recu?: number | null
          notes?: string | null
          numero_ticket?: number
          remise_globale?: number
          rendu?: number | null
          serveur_id?: string | null
          session_id?: string | null
          statut?: string
          table_id?: string | null
          total?: number
        }
        Update: {
          client_id?: string | null
          client_nom?: string | null
          created_at?: string
          date_vente?: string
          encaisse_par?: string | null
          id?: string
          mode_paiement?: string
          montant_recu?: number | null
          notes?: string | null
          numero_ticket?: number
          remise_globale?: number
          rendu?: number | null
          serveur_id?: string | null
          session_id?: string | null
          statut?: string
          table_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ventes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_caisse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables_restaurant"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_economat_stock: {
        Row: {
          actif: boolean | null
          categorie: string | null
          id: string | null
          nom: string | null
          prix_unitaire: number | null
          stock_courant: number | null
          stock_initial: number | null
          stock_min: number | null
          total_entrees: number | null
          total_pertes: number | null
          total_sorties: number | null
          unite: string | null
          valeur_stock: number | null
        }
        Relationships: []
      }
      v_stock_matieres_premieres: {
        Row: {
          alerte_stock: boolean | null
          fournisseur: string | null
          id: string | null
          nom: string | null
          prix_unitaire: number | null
          stock_actuel: number | null
          stock_min: number | null
          total_achete: number | null
          total_consomme: number | null
          unite: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_close_open_sessions: { Args: never; Returns: undefined }
      can_perform: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      generer_alertes_systeme: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ceo: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "ceo"
        | "labo_patisserie"
        | "labo_viennoiserie"
        | "cuisine_salee"
        | "salle"
        | "economat"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "ceo",
        "labo_patisserie",
        "labo_viennoiserie",
        "cuisine_salee",
        "salle",
        "economat",
      ],
    },
  },
} as const
