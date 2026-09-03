export type Peer = {
  id: string;
  name: string;
  year: number;
  country: string;
  faculty: string;
  score: number;
  league: string;
  subject: string;
};

export const PEERS: Peer[] = [
  { id: "p1", name: "Miora R.", year: 5, country: "Madagascar", faculty: "HUJRA", score: 612, league: "Diamant", subject: "Cardiologie" },
  { id: "p2", name: "Andry K.", year: 6, country: "Madagascar", faculty: "CHU Mahajanga", score: 588, league: "Diamant", subject: "Urgences" },
  { id: "p3", name: "Haja F.", year: 4, country: "Madagascar", faculty: "Faculté d’Antananarivo", score: 541, league: "Platine", subject: "Infectiologie" },
  { id: "p4", name: "Soa L.", year: 5, country: "Madagascar", faculty: "CHU Toamasina", score: 503, league: "Platine", subject: "Neurologie" },
  { id: "p5", name: "Nivo T.", year: 3, country: "Madagascar", faculty: "Antananarivo", score: 466, league: "Or", subject: "Sémiologie" },
  { id: "p6", name: "Lalao B.", year: 2, country: "Madagascar", faculty: "Fianarantsoa", score: 421, league: "Or", subject: "Physiologie" },
  { id: "p7", name: "Jean-Marc D.", year: 5, country: "France", faculty: "Paris Cité", score: 397, league: "Or", subject: "Cardiologie" },
  { id: "p8", name: "Aina P.", year: 4, country: "Madagascar", faculty: "Toliara", score: 354, league: "Argent", subject: "Dermatologie" },
  { id: "p9", name: "Rado S.", year: 1, country: "Madagascar", faculty: "Antananarivo", score: 298, league: "Argent", subject: "Anatomie" },
  { id: "p10", name: "Farah M.", year: 6, country: "Maurice", faculty: "SSR", score: 271, league: "Argent", subject: "Urgences" },
];
