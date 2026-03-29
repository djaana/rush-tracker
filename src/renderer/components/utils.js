export const kd = (k, d) => d === 0 ? k.toFixed(2) : (k / d).toFixed(2);

export const kdVal = (p) => p.deaths === 0 ? p.kills : p.kills / p.deaths;

export const bestPlayer = (players) =>
  players?.length ? players.reduce((a, b) => kdVal(b) > kdVal(a) ? b : a) : null;

export function fmtPoints(n) {
  if (!n) return '0';

  const suffixes = ['', 'K', 'M'];
  const i = Math.floor(Math.log(n) / Math.log(1000));

  return `${parseFloat((n / Math.pow(1000, i)).toFixed(1))}${suffixes[i]}`;
}

export function fmtTime(seconds) {
  return `${Math.floor(seconds / 3600)}`;
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const TEAM_EMOJI = { blue: '🟦', red: '🟥' };

export function exportPlayerLine(player, isBest) {
  const emoji = TEAM_EMOJI[player.team] || '❓';
  const ratio = kd(player.kills, player.deaths);
  const crown = isBest && player.kills > 0 ? ' 👑' : '';
  const breaker = player.breaker ? ' 💥' : '';

  return `${emoji} \`${player.username}\` ${player.kills}/${player.deaths} (${ratio})${crown}${breaker}`;
}

export function exportGame(game) {
  const players = game.players || [];
  const best = bestPlayer(players);

  const lines = ['\`[rush tracker]\`'];

  if (game.state === 'draw') {
    lines.push('égalité');
  } else if (game.winner) {
    const labels = { blue: 'bleu', red: 'rouge' };
    lines.push(`vainqueur: ${labels[game.winner]}`);
  }

  lines.push(`durée: ${game.duration || '—'}`);

  const byKd = (arr) => [...arr].sort((a, b) => kdVal(b) - kdVal(a));
  const blue = byKd(players.filter((p) => p.team === 'blue'));
  const red = byKd(players.filter((p) => p.team === 'red'));
  const unknown = byKd(players.filter((p) => !p.team));

  for (const group of [blue, red, unknown].filter((g) => g.length)) {
    lines.push('');
    for (const p of group) {
      lines.push(exportPlayerLine(p, p.username === best?.username));
    }
  }

  return lines.join('\n');
}

export function startOfWeekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfMonthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}