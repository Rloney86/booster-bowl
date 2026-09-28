export const WEEKLY_GAMES = [
  { id: "g1", away: "Varina", home: "Henrico", kickoff: "Fri 7:00 PM", board: "featured", district: "Capital" },
  { id: "g2", away: "Maury", home: "Churchland", kickoff: "Fri 7:00 PM", board: "featured", district: "Eastern" },
  { id: "g3", away: "King's Fork", home: "Oscar Smith", kickoff: "Fri 7:00 PM", board: "featured", district: "Southeastern" },
  { id: "g4", away: "L.C. Bird", home: "Highland Springs", kickoff: "Fri 7:00 PM", board: "featured" },
  { id: "g5", away: "Jefferson Forest", home: "Liberty Christian", kickoff: "Fri 7:00 PM", board: "featured", district: "Seminole" },
  { id: "g6", away: "Magna Vista", home: "Staunton River", kickoff: "Fri 7:00 PM", board: "featured" },
  { id: "g7", away: "Brooke Point", home: "Riverbend", kickoff: "Fri 7:00 PM", board: "featured" },
  { id: "g8", away: "Louisa County", home: "Fluvanna County", kickoff: "Fri 7:00 PM", board: "featured", district: "Jefferson" },
  { id: "g9", away: "Indian River", home: "Grassfield", kickoff: "Fri 7:00 PM", board: "featured", district: "Southeastern" },
  { id: "g10", away: "Hampton", home: "Glen Allen", kickoff: "Fri 7:00 PM", board: "featured" },
  { id: "g11", away: "Langley", home: "Chantilly", kickoff: "Fri 7:00 PM", board: "featured" },
  { id: "g12", away: "Turner Ashby", home: "Strasburg", kickoff: "Fri 7:00 PM", board: "featured" },
];

export const DOMINION_DISTRICT_GAMES = [
  { id: "dom-1", away: "Cosby", home: "Manchester", kickoff: "Fri 7:00 PM", board: "district", district: "Dominion", classLabel: "Class 6", region: "Region A" },
  { id: "dom-2", away: "Monacan", home: "Powhatan", kickoff: "Fri 7:00 PM", board: "district", district: "Dominion", classLabel: "Class 4", region: "Region B" },
];

// Phase 2 board catalog. A board can reuse the same game without creating a
// second pick: Supabase still identifies the real game by away/home + week.
export const PICK_BOARDS = [
  { id: "featured", type: "featured", group: "Featured", label: "Virginia Games of the Week", shortLabel: "Featured 12", description: "Booster Bowl's statewide featured matchups.", games: WEEKLY_GAMES },
  { id: "district-dominion", type: "district", group: "District", label: "Dominion District", shortLabel: "Dominion", description: "Weekly games involving Dominion District programs.", games: DOMINION_DISTRICT_GAMES },
  { id: "region-6a", type: "region", group: "Region", label: "Class 6 • Region A", shortLabel: "Region 6A", description: "Region A games involving Class 6 programs.", games: DOMINION_DISTRICT_GAMES.filter((g) => g.classLabel === "Class 6" && g.region === "Region A") },
  { id: "class-6", type: "class", group: "Classification", label: "VHSL Class 6", shortLabel: "Class 6", description: "Class 6 games currently available on Booster Bowl.", games: DOMINION_DISTRICT_GAMES.filter((g) => g.classLabel === "Class 6") },
  { id: "school-manchester", type: "school", group: "School", label: "Manchester Lancers", shortLabel: "Manchester", description: "Follow Manchester and pick the Lancers' available weekly matchup.", games: DOMINION_DISTRICT_GAMES.filter((g) => g.away === "Manchester" || g.home === "Manchester") },
];

export const PICK_BOARD_GROUPS = ["Featured", "District", "Region", "Classification", "School"];
