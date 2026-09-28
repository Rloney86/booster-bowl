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

// First category board. These matchups are kept separate from the original
// Featured 12 so the existing production pick/scoring flow stays intact.
// Future district/region/class boards can be populated from the same shape.
export const DOMINION_DISTRICT_GAMES = [
  { id: "dom-1", away: "Cosby", home: "Manchester", kickoff: "Fri 7:00 PM", board: "district", district: "Dominion", classLabel: "Class 6", region: "Region A" },
  { id: "dom-2", away: "Monacan", home: "Powhatan", kickoff: "Fri 7:00 PM", board: "district", district: "Dominion", classLabel: "Class 4", region: "Region B" },
];

export const PICK_BOARDS = [
  { id: "featured", type: "featured", label: "Virginia Games of the Week", shortLabel: "Featured 12", description: "Booster Bowl's statewide featured matchups.", games: WEEKLY_GAMES },
  { id: "district-dominion", type: "district", label: "Dominion District", shortLabel: "Dominion", description: "Weekly games involving Dominion District programs.", games: DOMINION_DISTRICT_GAMES },
];
