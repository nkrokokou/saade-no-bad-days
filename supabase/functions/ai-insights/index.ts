import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

    // Require authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const token = authHeader.replace('Bearer ', '')
    const authClient = createClient(supabaseUrl, supabaseKey)
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // User-scoped DB client (RLS enforced)
    const db = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } })

    // Fetch recent data for context
    const today = new Date().toISOString().slice(0, 10)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    const [
      { data: recentPertes },
      { data: recentProduction },
      { data: recentCloture },
      { data: recentAchats },
      { data: produits },
    ] = await Promise.all([
      db.from('pertes').select('*, produits(nom, categorie)').gte('semaine_debut', weekAgo).limit(100),
      db.from('production_labo').select('*, produits(nom, categorie)').gte('date_production', weekAgo).limit(100),
      db.from('cloture_journaliere').select('*, produits(nom, categorie)').gte('date_cloture', weekAgo).limit(200),
      db.from('achats_mp').select('*').gte('date_achat', monthAgo).limit(100),
      db.from('produits').select('nom, categorie').limit(200),
    ])

    const dataContext = `
DONNÉES SAADÉ (pâtisserie libanaise, Lomé, Togo) — Date: ${today}

PRODUITS: ${produits?.map(p => `${p.nom} (${p.categorie})`).join(', ') || 'Aucun'}

PERTES (7 derniers jours): ${JSON.stringify(recentPertes?.map(p => ({ produit: (p as any).produits?.nom, qte: p.quantite, jour: p.jour, labo: p.type_labo })) || [])}

PRODUCTION (7 derniers jours): ${JSON.stringify(recentProduction?.map(p => ({ produit: (p as any).produits?.nom, produite: p.qte_produite, perte: p.qte_perte, sortie_salle: p.qte_sortie_en_salle, date: p.date_production })) || [])}

CLÔTURE SALLE (7 derniers jours): ${JSON.stringify(recentCloture?.map(c => ({ produit: (c as any).produits?.nom, vendue: c.qte_vendue, invendu: c.qte_invendu, moins50: c.prix_invendu_50, perte: c.qte_perte, date: c.date_cloture })) || [])}

ACHATS MP (30 derniers jours): ${JSON.stringify(recentAchats?.map(a => ({ produit: a.produit, fournisseur: a.fournisseur, qte: a.quantite, total: a.prix_total, date: a.date_achat })) || [])}
`

    const { messages } = await req.json()

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `Tu es l'assistant analytique de SAADÉ, une pâtisserie libanaise à Lomé, Togo. Tu analyses les données de production, ventes, pertes et achats pour fournir des insights actionables. Réponds en français, sois concis et utilise des emojis pour la lisibilité. Fournis des chiffres précis quand disponibles. Suggère des actions concrètes.

${dataContext}`
          },
          ...messages,
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      const status = response.status
      if (status === 429) return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      if (status === 402) return new Response(JSON.stringify({ error: 'Credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const t = await response.text()
      console.error('AI error:', status, t)
      return new Response(JSON.stringify({ error: 'AI service unavailable' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(response.body, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } })
  } catch (e) {
    console.error('Error:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
