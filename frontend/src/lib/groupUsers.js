import { displayName } from './format.js';

const thai = (a, b) => a.localeCompare(b, 'th');

// Pure helper: split users into a "no team" group plus one group per team.
// Empty teams are kept so the page can still show them.
export function groupUsersByTeam(users, teams) {
  const byTeam = new Map(teams.map((t) => [t.id, []]));
  const none = [];
  for (const user of users) {
    const bucket = user.team ? byTeam.get(user.team.id) : undefined;
    // A team id missing from `teams` (stale list) falls back to "none".
    (bucket ?? none).push(user);
  }
  const sortUsers = (list) => [...list].sort((a, b) => thai(displayName(a), displayName(b)));
  const groups = [...teams]
    .sort((a, b) => thai(a.team_name, b.team_name))
    .map((team) => ({ key: String(team.id), team, users: sortUsers(byTeam.get(team.id)) }));
  if (none.length > 0) groups.unshift({ key: 'none', team: null, users: sortUsers(none) });
  return groups;
}
