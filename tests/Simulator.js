const NAMES = ['Notch', 'Dream', 'Tubbo', 'Ranboo', 'Phil', 'Tommy', 'Sapnap', 'George', 'John', 'William'];

const MODES = [
    { name: '1v1', total: 2 },
    { name: '2v2', total: 4 },
    { name: '4v4', total: 8 },
    { name: '5v5', total: 10 }
];

const GAME_DURATION_MS = 7500;
const HUB_RETURN_MS    = 10000;
const SPECTATOR_OFFSET = 11000;

module.exports = class Simulator {
    #handler;
    #sendUpdate;
    #timers  = [];
    #running = false;

    constructor(handler, sendUpdate) {
        this.#handler    = handler;
        this.#sendUpdate = sendUpdate;
    };

    get running() { return this.#running; };

    async #emit(log) {
        await this.#handler.parse(log);
        this.#sendUpdate();
    };

    #at(ms, log) {
        this.#timers.push(setTimeout(() => this.#emit(log), ms));
    };

    #rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    #shuffle(arr) {
        return [...arr].sort(() => Math.random() - 0.5);
    };

    #scheduleKills(names, eventZone) {
        const killCount = this.#rand(4, 8);

        for (let i = 0; i < killCount; i++) {
            const kt     = this.#rand(eventZone[0], eventZone[1]);
            const victim = names[this.#rand(0, names.length - 1)];
            const others = names.filter((n) => n !== victim);
            const killer = others[this.#rand(0, others.length - 1)];

            this.#at(kt, `⚔ ${victim} a été tué par ${killer}`);
        };
    };

    #scheduleDisconnect(names, eventZone) {
        const target    = names[this.#rand(0, names.length - 1)];
        const discTime  = this.#rand(eventZone[0], eventZone[1] - 1500);
        const reconTime = discTime + this.#rand(800, 1200);

        this.#at(discTime, `[Rush] ${target} s'est déconnecté`);

        if (reconTime <= eventZone[1]) {
            this.#at(reconTime, `[Rush] ${target} s'est reconnecté`);
        };
    };

    #scheduleEnd(offset, blue, red, winner) {
        const loser  = winner === 'Bleu' ? 'Rouge' : 'Bleu';
        const breaker = (winner === 'Bleu' ? blue : red)[0];
        const state  = winner === 'Bleu' ? 'victoire' : 'défaite';
        const secs   = Math.round(GAME_DURATION_MS / 1000);

        this.#at(offset,       `Le lit de l'équipe ${loser} a été détruit par ${breaker}`);
        this.#at(offset + 200, `RÉSUMÉ DE LA PARTIE - ${state}`);
        this.#at(offset + 400, `Vainqueur » ${winner}`);
        this.#at(offset + 600, `Durée » 0m ${secs}s`);
    };

    #runGame(o = 0) {
        const mode  = MODES[Math.floor(Math.random() * MODES.length)];
        const names = this.#shuffle(NAMES).slice(0, mode.total);
        const self  = names[0];
        const blue  = names.slice(0, mode.total / 2);
        const red   = names.slice(mode.total / 2);

        let t = o;

        this.#at(t, `Bonjour ${self}`);                                    t += 100;
        this.#at(t, `Vous avez rejoint la file Rush ${mode.name}`);         t += 200;
        this.#at(t, 'Hide downloading terrain');                            t += 150;

        for (const name of names) {
            this.#at(t, `[Rush] ${name} s'est connecté`);                  t += 120;
        };

        for (const name of blue) {
            this.#at(t, `${name} a rejoint l'équipe Bleu`);                t += 60;
        };

        for (const name of red) {
            this.#at(t, `${name} a rejoint l'équipe Rouge`);               t += 60;
        };

        const gameStart  = o + 1000;
        const gameEnd    = o + GAME_DURATION_MS;
        const eventZone  = [gameStart + 500, gameEnd - 600];
        const winner     = Math.random() > 0.3 ? 'Bleu' : 'Rouge';

        this.#at(gameStart, 'La partie a commencé');

        for (const name of blue) this.#at(gameStart + 200, `✴ Bleu ${name}`);
        for (const name of red)  this.#at(gameStart + 200, `✴ Rouge ${name}`);

        this.#scheduleKills(names, eventZone);
        if (mode.total > 2) this.#scheduleDisconnect(names, eventZone);
        this.#scheduleEnd(gameEnd, blue, red, winner);

        this.#at(o + HUB_RETURN_MS, 'Connexion au hub');
    };

    #runSpectator(o = 0) {
        const mode  = MODES[Math.floor(Math.random() * MODES.length)];
        const names = this.#shuffle(NAMES).slice(0, mode.total);
        const blue  = names.slice(0, mode.total / 2);
        const red   = names.slice(mode.total / 2);

        let t = o;

        this.#at(t, `Vous regardez maintenant ${names[0]}`);               t += 300;

        for (const name of names.slice(1)) {
            this.#at(t, `[Rush] ${name} s'est connecté`);                  t += 120;
        };

        for (const name of blue) this.#at(t, `✴ Bleu ${name}`);
        for (const name of red)  this.#at(t, `✴ Rouge ${name}`);

        const gameEnd   = o + GAME_DURATION_MS;
        const eventZone = [o + 800, gameEnd - 600];
        const winner    = Math.random() > 0.5 ? 'Bleu' : 'Rouge';

        this.#scheduleKills(names, eventZone);
        if (mode.total > 2) this.#scheduleDisconnect(names, eventZone);
        this.#scheduleEnd(gameEnd, blue, red, winner);
    };

    async start() {
        if (this.#running) return;
        this.#running = true;

        this.#sendUpdate();

        this.#runGame(0);
        this.#runSpectator(SPECTATOR_OFFSET);

        this.#timers.push(setTimeout(() => this.stop(), SPECTATOR_OFFSET + HUB_RETURN_MS + 500));
    };

    stop() {
        this.#timers.forEach(clearTimeout);
        this.#timers  = [];
        this.#running = false;
    };
};