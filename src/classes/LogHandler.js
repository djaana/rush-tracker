const EventEmitter = require('events');
const Logger = require('./Logger');

const TEAMS = { bleu: 'blue', blue: 'blue', rouge: 'red', red: 'red' };
const TEAM_LIST = [...new Set(Object.values(TEAMS))];
const STATES = { victoire: 'win', défaite: 'loose', égalité: 'draw' };
const CHAT_FLAG = '✴';

const GAMEMODES = [
  { name: '1v1', label: '1v1 [FAST]', total: 2 },
  { name: '2v2', label: '2v2 [FAST]', total: 4 },
  { name: '4v4', label: '4v4 [FAST]', total: 8 },
  { name: '5v5', label: '5v5 [MDT]', total: 10 },
  { name: 'spectator', label: 'Spectateur' }
];

module.exports = class LogHandler extends EventEmitter {
  #logger;
  #store;

  constructor(store) {
    super();

    this.#logger = new Logger();
    this.#store = store;

    this.game = this.#defaultGame();
    this.self = null;

    this.patterns = [
      {
        regex: /Bonjour (\w+)/u,
        run: async ([, username]) => {
          await this.setSelf(username);
        }
      },
      {
        regex: /Hide downloading terrain/u,
        run: async () => {
          if (!this.game.mode) return;

          if (this.game.spectator) return await this.reset();
          if (!this.game.lobby) await this.setLobby(true);

          await this.#setPending(true);
        }
      },
      {
        regex: /Disconnecting/u,
        run: async () => {
          if (!this.self || !this.game.started) return;
          
          await this.addDeath(this.self);
        }
      },
      {
        regex: /\[Rush\] (?:\+ )?(\w+) s'est (re)?connecté/u,
        run: async ([, username]) => {
          if (!this.game.lobby && !this.game.spectator) return;

          if (!this.game.started && this.pending) await this.setSelf(username);
          if (this.game.started || this.game.spectator) return await this.setConnected(username);

          await this.fixPlayer(username);
          await this.#clearPending();
        }
      },
      {
        regex: /\[Rush\] (?:- )?(\w+) s'est déconnecté/u,
        run: async ([, username]) => {
          if (!this.game.lobby && !this.game.spectator) return;

          if (this.game.started || this.game.spectator) {
            await this.addDeath(username);
            await this.setDisconnected(username, true);

            return;
          }

          await this.removePlayer(username);
        }
      },
      {
        regex: /Vous regardez maintenant (\w+)/u,
        run: async ([, username]) => {
          await this.reset();
          await this.setSpectator();
          await this.startGame();
          await this.setGameMode('spectator');
          await this.fixPlayer(username);

          this.emit('notification:push', { message: 'mode spectateur' });
        }
      },
      {
        regex: /(?:Le groupe rejoint la file d'attente pour Rush|Vous avez rejoint la file Rush) (\d+v\d+)/u,
        run: async ([, name]) => {
          await this.setGameMode(name);
        }
      },
      {
        regex: /Vous avez quitté la file d'attente/u,
        run: async () => {
          await this.reset();
        }
      },
      {
        regex: /Connexion au hub/u,
        run: async () => {
          if (this.game.mode && !this.game.lobby && !this.game.spectator) return;

          await this.reset();
        }
      },
      {
        regex: /La partie a commencé/u,
        run: async () => {
          if (!this.game.lobby) return;

          await this.startGame();
        }
      },
      {
        regex: /(?:\[(\w+) -> (\w+)\]|(Bleu|Rouge) (\w+))/u,
        fromChat: true,
        run: async ([, privateUser, privateTeam, globalTeam, globalUser]) => {
          if (!this.game.started) return;

          await this.setTeam(privateUser || globalUser, privateTeam || globalTeam);
        }
      },
      {
        regex: /⚔ (\w+) a été tué par (.+)/u,
        run: async ([, victim, killers]) => {
          if (!this.game.started) return;

          await this.addDeath(victim);

          for (const killer of killers.split(',').map((k) => k.trim()).filter((k) => k !== 'le vide')) {
            await this.addKill(killer);
          }
        }
      },
      {
        regex: /Lit intermédiaire détruit par (\w+)/u,
        run: async ([, breaker]) => {
          if (!this.game.started) return;

          await this.#setPending(breaker);
        }
      },
      {
        regex: /\+2♥ pour l'équipe (\w+)/u,
        run: async ([, team]) => {
          if (!this.game.started) return;

          await this.setTeam(this.pending, team);
          await this.#clearPending();
        }
      },
      {
        regex: /Le lit de l'équipe (Bleu|Rouge) a été détruit par (\w+)/u,
        run: async ([, team, username]) => {
          if (!this.game.started) return;

          await this.setTeam(username, TEAM_LIST.find((t) => t !== TEAMS[team.toLowerCase()]));
          await this.setBreaker(username);
        }
      },
      {
        regex: /RÉSUMÉ DE LA PARTIE - (.+)/u,
        run: async ([, state]) => {
          if (!this.game.started) return;

          await this.setState(state);
        }
      },
      {
        regex: /Résultat » (ÉGALITÉ)/u,
        run: async ([, state]) => {
          if (!this.game.started) return;

          await this.setState(state);
        }
      },
      {
        regex: /Vainqueur » (Bleu|Rouge)/u,
        run: async ([, team]) => {
          if (!this.game.started) return;

          await this.setWinner(team);
        }
      },
      {
        regex: /Durée » (\d+m \d+s)/u,
        run: async ([, duration]) => {
          if (!this.game.started) return;

          await this.setDuration(duration);
          await this.save();
        }
      }
    ];
  }

  #defaultGame() {
    return {
      mode: null,
      lobby: false,
      started: false,
      spectator: false,
      players: [],
      duration: null,
      state: null,
      winner: null
    };
  }

  async setGameMode(name) {
    this.game.mode = GAMEMODES.find((gm) => gm.name === name) || null;

    this.#logger.log(`mode: ${this.game.mode.label}`);

    return this.game.mode;
  }

  async setLobby(value) {
    this.game.lobby = value;

    if (value) this.emit('notification:push', { message: 'partie détectée', sub: this.game.mode.label });

    this.#logger.log('lobby rejoint');

    return value;
  }

  async setSpectator() {
    this.game.spectator = true;

    this.#logger.log('mode spectateur');

    return this.game.mode;
  }

  async startGame() {
    this.game.started = true;

    if (!this.game.spectator) this.emit('notification:push', { message: 'partie commencée', sub: this.game.mode.label });

    this.#logger.log('partie démarrée');
  }

  async setState(state) {
    this.game.state = STATES[state.toLowerCase()] ?? null;

    this.#logger.log(`résultat: ${state.toLowerCase()}`);

    return this.game.state;
  }

  async setWinner(team) {
    this.game.winner = TEAMS[team.toLowerCase()];
    await this.#checkSelfTeam();

    this.#logger.log(`vainqueur: ${this.game.winner}`);

    return this.game.winner;
  }

  async setDuration(duration) {
    this.game.duration = duration;

    this.#logger.log(`durée: ${duration}`);

    return duration;
  }

  async setSelf(username) {
    this.self = username;

    this.#logger.log(`joueur identifié: ${username}`);

    return username;
  }

  async fixPlayer(username) {
    let player = this.#findPlayer(username);

    if (!player) {
      player = {
        username,
        team: null,
        kills: 0,
        deaths: 0,
        self: this.self === username,
        breaker: false,
        connection: true
      };

      this.game.players.push(player);

      this.#logger.log(`joueur ajouté: ${username}`);
    }

    await this.fixTeams();

    return player;
  }

  async removePlayer(username) {
    this.game.players = this.game.players.filter((p) => p.username !== username);

    this.#logger.log(`joueur retiré: ${username}`);

    return this.game.players;
  }

  async setBreaker(username) {
    const player = await this.fixPlayer(username);

    player.breaker = true;

    this.emit('notification:push', { message: 'lit adverse détruit', sub: `par ${username}` });

    this.#logger.log(`casseur: ${username}`);

    return player;
  }

  async setConnected(username) {
    const player = await this.fixPlayer(username);

    player.connection = true;

    this.#logger.log(`reconnecté: ${username}`);

    return player;
  }

  async setDisconnected(username) {
    const player = await this.fixPlayer(username);

    player.connection = false;

    this.#logger.log(`déconnecté: ${username}`);

    return player;
  }

  async setTeam(username, team) {
    team = TEAMS[team?.toLowerCase()];
    if (!team) return;

    const player = await this.fixPlayer(username);
    player.team = team;
    
    await this.fixTeams();

    this.#logger.log(`équipe: ${username} → ${team}`);

    return player;
  }

  async fixTeams() {
    if (!this.game.mode || !this.game.mode.total) return;

    const teamSize = this.game.mode.total / 2;
    const fullTeam = TEAM_LIST.find((team) => this.game.players.filter((p) => p.team === team).length === teamSize);

    if (!fullTeam) return;

    const otherTeam = TEAM_LIST.find((t) => t !== fullTeam);
    for (const player of this.game.players) {
      if (!player.team) player.team = otherTeam;
    }
  }

  async addKill(username) {
    const player = await this.fixPlayer(username);
    ++player.kills;

    this.#logger.log(`kill: ${username} (${player.kills})`);

    return player;
  }

  async addDeath(username) {
    const player = await this.fixPlayer(username);
    ++player.deaths;

    this.#logger.log(`mort: ${username} (${player.deaths})`);

    return player;
  }

  #findPlayer(username) {
    return this.game.players.find((p) => p.username === username);
  }

  async #checkSelfTeam() {
    const self = this.#findPlayer(this.self);
    if (!self || self.team) return;

    const team = this.game.state === STATES.victoire ? this.game.winner : TEAM_LIST.find((t) => t !== this.game.winner);
    await this.setTeam(self.username, team);
  }

  async #setPending(value) {
    this.pending = value;
  }

  async #clearPending() {
    delete this.pending;
  }

  async reset() {
    this.game = this.#defaultGame();

    this.#logger.log('reset');

    return this.game;
  }

  async save() {
    const id = Date.now();

    const entry = {
      id,
      mode: this.game.mode,
      state: this.game.state,
      winner: this.game.winner,
      duration: this.game.duration,
      players: this.game.players,
      spectator: this.game.spectator
    };

    const games = this.#store.read();
    games.unshift(entry);
    this.#store.write(games);

    this.#logger.log(`partie sauvegardée (id: ${entry.id})`);

    this.emit('game:saved', entry);
    this.emit('notification:push', { message: 'partie sauvegardée', sub: `identifiant: ${id}` });

    await this.reset();

    return entry;
  }

  async parse(log) {
    for (const pattern of this.patterns) {
      if ((pattern.fromChat === true) !== log.includes(CHAT_FLAG)) continue;

      const match = pattern.regex.exec(log);
      if (!match) continue;

      await pattern.run(match);

      break;
    }

    return log;
  }
}