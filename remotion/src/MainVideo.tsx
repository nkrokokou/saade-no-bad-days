import { AbsoluteFill, Series } from "remotion";
import { Backdrop } from "./Backdrop";
import { SceneIntro } from "./scenes/SceneIntro";
import { FeatureScene } from "./scenes/FeatureScene";
import { SceneOutro } from "./scenes/SceneOutro";
import { theme } from "./theme";

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Series>
        <Series.Sequence durationInFrames={120}>
          <SceneIntro />
        </Series.Sequence>
        <Series.Sequence durationInFrames={120}>
          <FeatureScene
            number="01"
            title="Pilotage en temps réel"
            subtitle="Tableau de bord & Assistant IA"
            bullets={["CA du jour", "Tickets & panier moyen", "Marge brute", "Insights IA"]}
            accentColor={theme.gold}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={120}>
          <FeatureScene
            number="02"
            title="Caisse & ventes"
            subtitle="POS rapide, suivi des recettes"
            bullets={["Encaissement multi-modes", "Tables restaurant", "Rapports ventes", "Clôture journalière"]}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={120}>
          <FeatureScene
            number="03"
            title="Catalogue & stocks"
            subtitle="Produits, matières, mouvements"
            bullets={["80+ références", "Catégories et photos", "Stock tampon", "Bons de transfert"]}
            accentColor={theme.gold}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={120}>
          <FeatureScene
            number="04"
            title="Production labo"
            subtitle="Du gramme à la vitrine"
            bullets={["Fiches techniques", "Production journalière", "Achats MP", "Inventaire"]}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={120}>
          <FeatureScene
            number="05"
            title="Clients & qualité"
            subtitle="Fidélité, crédits, dégustations"
            bullets={["Fiches clients", "Suivi des crédits", "Pertes maîtrisées", "Notes dégustation"]}
            accentColor={theme.gold}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={120}>
          <FeatureScene
            number="06"
            title="Équipe & sécurité"
            subtitle="Rôles, droits, traçabilité"
            bullets={["CEO, labos, salle", "Permissions fines", "Journal d'audit", "Import/Export Excel"]}
          />
        </Series.Sequence>
        <Series.Sequence durationInFrames={210}>
          <SceneOutro />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
