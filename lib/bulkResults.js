export function normalizeTeamName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bhigh school\b/g, " ")
    .replace(/\bhs\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseResultLine(line) {
  const csv = line.match(/^(.+?)\s*,\s*(\d+)\s*,\s*(.+?)\s*,\s*(\d+)$/);
  if (csv) return { leftTeam: csv[1], leftScore: Number(csv[2]), rightTeam: csv[3], rightScore: Number(csv[4]) };

  const separated = line.match(/^(.+?)\s+(\d+)\s+(?:-|–|—|\|)\s+(.+?)\s+(\d+)$/);
  if (separated) return { leftTeam: separated[1], leftScore: Number(separated[2]), rightTeam: separated[3], rightScore: Number(separated[4]) };

  return null;
}

export function parseBulkResults(text, games) {
  const gameList = games || [];
  const parsed = String(text || "")
    .split(/\r?\n/)
    .map((original, index) => ({ original: original.trim(), lineNumber: index + 1 }))
    .filter((row) => row.original)
    .map((row) => {
      const result = parseResultLine(row.original);
      if (!result) {
        return { ...row, status: "invalid", message: "Use: Away Team, 21, Home Team, 14" };
      }
      if (result.leftScore === result.rightScore) {
        return { ...row, ...result, status: "invalid", message: "Tied scores cannot be finalized." };
      }

      const left = normalizeTeamName(result.leftTeam);
      const right = normalizeTeamName(result.rightTeam);
      const matches = [];
      gameList.forEach((game) => {
        const away = normalizeTeamName(game.away_team);
        const home = normalizeTeamName(game.home_team);
        if (left === away && right === home) {
          matches.push({ game, awayScore: result.leftScore, homeScore: result.rightScore, reversed: false });
        } else if (left === home && right === away) {
          matches.push({ game, awayScore: result.rightScore, homeScore: result.leftScore, reversed: true });
        }
      });

      if (!matches.length) {
        return { ...row, ...result, status: "unmatched", message: "No exact matchup found in the selected week." };
      }
      if (matches.length > 1) {
        return { ...row, ...result, status: "ambiguous", message: "More than one exact matchup matched this line." };
      }

      const match = matches[0];
      if (match.game.is_final) {
        return { ...row, ...result, ...match, status: "final", message: "This game is already final." };
      }
      return { ...row, ...result, ...match, status: "ready", message: match.reversed ? "Matched with home/away order reversed." : "Exact matchup found." };
    });

  const counts = new Map();
  parsed.filter((row) => row.game).forEach((row) => counts.set(row.game.id, (counts.get(row.game.id) || 0) + 1));
  return parsed.map((row) => counts.get(row.game?.id) > 1 && row.status === "ready"
    ? { ...row, status: "duplicate", message: "This game appears more than once in the pasted results." }
    : row);
}
