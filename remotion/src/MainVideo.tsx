import { AbsoluteFill, Series, Audio, staticFile } from "remotion";
import { Backdrop } from "./Backdrop";
import { SceneIntro } from "./scenes/SceneIntro";
import { FeatureScene } from "./scenes/FeatureScene";
import { SceneOutro } from "./scenes/SceneOutro";
import { theme } from "./theme";

const scenes = [
  { dur: 120, audio: "01-intro.mp3", el: <SceneIntro /> },
  { dur: 240, audio: "02-pilotage.mp3", el: <FeatureScene duration={240} number="01" title="Pilotage en temps réel" subtitle="Tableau de bord & Assistant IA" bullets={["CA du jour", "Tickets & panier moyen", "Marge brute", "Insights IA"]} accentColor={theme.gold} /> },
  { dur: 180, audio: "03-caisse.mp3", el: <FeatureScene duration={180} number="02" title="Caisse & ventes" subtitle="POS rapide, suivi des recettes" bullets={["Encaissement multi-modes", "Tables restaurant", "Rapports ventes", "Clôture journalière"]} /> },
  { dur: 240, audio: "04-stock.mp3", el: <FeatureScene duration={240} number="03" title="Catalogue & stocks" subtitle="Produits, matières, mouvements" bullets={["80+ références", "Catégories et photos", "Stock tampon", "Bons de transfert"]} accentColor={theme.gold} /> },
  { dur: 210, audio: "05-prod.mp3", el: <FeatureScene duration={210} number="04" title="Production labo" subtitle="Du gramme à la vitrine" bullets={["Fiches techniques", "Production journalière", "Achats MP", "Inventaire"]} /> },
  { dur: 210, audio: "06-clients.mp3", el: <FeatureScene duration={210} number="05" title="Clients & qualité" subtitle="Fidélité, crédits, dégustations" bullets={["Fiches clients", "Suivi des crédits", "Pertes maîtrisées", "Notes dégustation"]} accentColor={theme.gold} /> },
  { dur: 210, audio: "07-equipe.mp3", el: <FeatureScene duration={210} number="06" title="Équipe & sécurité" subtitle="Rôles, droits, traçabilité" bullets={["CEO, labos, salle", "Permissions fines", "Journal d'audit", "Import/Export Excel"]} /> },
  { dur: 150, audio: "08-outro.mp3", el: <SceneOutro /> },
];

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Series>
        {scenes.map((s, i) => (
          <Series.Sequence key={i} durationInFrames={s.dur}>
            <AbsoluteFill>
              {s.el}
              <Audio src={staticFile(`audio/${s.audio}`)} volume={1} />
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
