import { ChangeDetectorRef, Component } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { GameService } from '../game.service';

@Component({
  selector: 'app-game',
  standalone: false,
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent {
  deckId: string | null = null;
  images: string[] = [];
  remaining = '';
  header = 'Game of War';
  // For local simulation
  playerDeck: any[] = [];
  computerDeck: any[] = [];
  playerCaptured = 0; // kept for backwards compatibility in some UI places
  computerCaptured = 0;
  drawDisabled = true;
  inBattle = false;
  lastBattleWasWar = false;
  playSpeedMs = 120; // ms between rounds
  warPhase: 'none' | 'facedown' | 'reveal' = 'none';
  warPlaced = false; // whether the facedown war cards have been placed (controls visual)
  // animation state
  animatingCards: Array<{id: string, style: any}> = [];
  private _pendingAnimResolvers = new Map<string, () => void>();
  // step-through state
  battleStage: 'idle' | 'drawn' | 'facedown' | 'reveal' | 'animating' = 'idle';
  currentStakes: any[] = [];
  flipCards = { left: false, right: false };
  lastWinner: 'player' | 'computer' | 'tie' | null = null;
  autoPlay = false;
  private _autoPlayRunning = false;
  get autoPlayRunning() { return this._autoPlayRunning; }
  autoStepDelayMs = 80; // ms between auto steps
  showConfetti = false;
  confettiArray: number[] = [];
  fastSim = false;

  constructor(private gameService: GameService, private cdr: ChangeDetectorRef) {}

  newGame() {
    // stop any running autoplay when starting a new game
    if (this.autoPlay) this.stopAutoPlay();

    this.gameService.newDeck().subscribe(async res => {
      this.deckId = res.deck_id;
      // draw entire deck and split locally for true War simulation
      const all: any = await lastValueFrom(this.gameService.draw(this.deckId!, 52));
      const cards = all.cards || [];
      // shuffle defensively (API returns shuffled deck already)
      // split 26/26
      this.playerDeck = cards.filter((_: any, i: number) => i % 2 === 0).map((c: any) => ({...c}));
      this.computerDeck = cards.filter((_: any, i: number) => i % 2 === 1).map((c: any) => ({...c}));
      this.playerCaptured = 0;
      this.computerCaptured = 0;
      this.images = [];
      this.header = 'Game of War';
      this.drawDisabled = false;
      this.cdr.detectChanges();
    });
  }

  toggleAutoPlay() {
    if (this.autoPlay) this.stopAutoPlay();
    else this.startAutoPlay();
  }

  // Autoplay drives the UI by calling nextStep() repeatedly so the center flips are visible
  async startAutoPlay() {
    if (this._autoPlayRunning) return;
    this.autoPlay = true;
    this._autoPlayRunning = true;
    // keep manual draw disabled while autoplay is active
    this.drawDisabled = true;

    if (this.fastSim) {
      // Fast simulation: skip animations and run full battles quickly
      while (this.autoPlay && this.playerDeck.length > 0 && this.computerDeck.length > 0) {
        await this.playOneBattle(true);
        this.cdr.detectChanges();
        // minimal pause so UI can breathe (very small)
        await this.sleep(Math.max(1, this.autoStepDelayMs));
      }
    } else {
      while (this.autoPlay && this.playerDeck.length > 0 && this.computerDeck.length > 0) {
        // If not currently mid-battle, start a new draw
        if (this.battleStage === 'idle' && !this.inBattle) {
          await this.nextStep(); // flip
          await this.sleep(this.autoStepDelayMs);
        }

        // step through the rest of the battle until it returns to idle
        while (this.autoPlay && this.battleStage !== 'idle' && this.playerDeck.length > 0 && this.computerDeck.length > 0) {
          await this.nextStep();
          await this.sleep(this.autoStepDelayMs);
        }
      }
    }

    this.autoPlay = false;
    this._autoPlayRunning = false;
    this.drawDisabled = (this.playerDeck.length === 0 || this.computerDeck.length === 0);

    // show confetti if someone won
    if (this.playerDeck.length === 0 || this.computerDeck.length === 0) {
      this.launchConfetti();
    }
    this.cdr.detectChanges();
  }

  stopAutoPlay() {
    this.autoPlay = false;
    this.drawDisabled = (this.playerDeck.length === 0 || this.computerDeck.length === 0);
    this.cdr.detectChanges();
  }

  private launchConfetti() {
    this.showConfetti = true;
    const count = 36;
    this.confettiArray = Array.from({ length: count }, () => Math.random() * 100);
    setTimeout(() => { this.showConfetti = false; this.confettiArray = []; }, 5000);
  }

  private checkForGameOver() {
    if (this.playerDeck.length === 0 || this.computerDeck.length === 0) {
      this.launchConfetti();
    }
  }


  get playerCapturedStack(): any[] { return Array.from({ length: this.playerDeck.length }); }
  get computerCapturedStack(): any[] { return Array.from({ length: this.computerDeck.length }); }

  // Automatic full-game simulation using local queues
  private sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

  // Step through the battle. Click the button to advance one step.
  async nextStep() {
    if (this.inBattle || (this.drawDisabled && !this.autoPlay)) return;
    // If we previously drew and determined a winner, the next click should animate and award
    if (this.battleStage === 'drawn' && this.lastWinner && this.lastWinner !== 'tie') {
      this.inBattle = true;
      const winner = this.lastWinner;
      // hide the center card visuals so we don't show duplicates while animating
      this.images = [];
      this.flipCards.left = false;
      this.flipCards.right = false;
      this.battleStage = 'animating';
      // animate and award the current stakes
      await this.animateStakes(this.currentStakes, winner);
      if (winner === 'player') this.playerDeck.push(...this.currentStakes);
      else this.computerDeck.push(...this.currentStakes);
      this.currentStakes = [];
      this.playerCaptured = this.playerDeck.length;
      this.computerCaptured = this.computerDeck.length;
      this.lastWinner = null;
      this.inBattle = false;
      this.checkForGameOver();
      // after awarding, automatically draw the next two cards (show next round flipped)
      if (this.playerDeck.length === 0 || this.computerDeck.length === 0) {
        this.battleStage = 'idle';
        this.cdr.detectChanges();
        return;
      }
      // draw next two
      const pCard = this.playerDeck.shift()!;
      const cCard = this.computerDeck.shift()!;
      this.currentStakes.push(pCard, cCard);
      // wait briefly so the animation has visual breathing room
      await this.sleep(400);
      // reveal the next two cards now that animation finished
      this.images = [cCard.image, pCard.image];
      this.flipCards.left = true;
      this.flipCards.right = true;
      this.battleStage = 'drawn';
      // store the next round winner so the following click will animate
      const nextWinner = this.compareCardValues(pCard, cCard);
      console.debug('Auto-next draw:', { player: pCard?.value, computer: cCard?.value, winner: nextWinner });
      if (nextWinner === 'tie') {
        // enter war facedown sequence
        this.lastBattleWasWar = true;
        this.warPhase = 'facedown';
        this.warPlaced = false;
        this.battleStage = 'facedown';
        this.flipCards.left = false;
        this.flipCards.right = false;
        this.inBattle = false;
        this.lastWinner = null;
        this.cdr.detectChanges();
        return;
      }
      this.lastWinner = nextWinner;
      this.cdr.detectChanges();
      return;
    }
    // Idle -> initial draw
    if (this.battleStage === 'idle') {
      if (this.playerDeck.length === 0 || this.computerDeck.length === 0) return;
      this.inBattle = true;
      this.currentStakes = [];
      const pCard = this.playerDeck.shift()!;
      const cCard = this.computerDeck.shift()!;
      this.currentStakes.push(pCard, cCard);
      // images[0] is the left slot (computer), images[1] is the right slot (player)
      this.images = [cCard.image, pCard.image];
      this.flipCards.left = true;
      this.flipCards.right = true;
      this.battleStage = 'drawn';
      // determine the winner for this draw and record it; animation/award happens on next click
      const winner = this.compareCardValues(pCard, cCard);
      console.debug('Battle draw:', { player: pCard?.value, computer: cCard?.value, winner });
      // record winner and let the UI flip remain visible; user will click again to animate/award
      this.lastWinner = winner;
      // if tie, enter facedown flow as before
      if (winner === 'tie') {
        // tie -> enter facedown phase; user must click Next to place facedown
        this.lastBattleWasWar = true;
        this.warPhase = 'facedown';
        this.warPlaced = false;
        this.battleStage = 'facedown';
        this.flipCards.left = false;
        this.flipCards.right = false;
        this.inBattle = false;
      }
      else {
        // for a normal win, leave battleStage='drawn' and wait for the user to click again
        this.battleStage = 'drawn';
        this.inBattle = false;
      }
      this.cdr.detectChanges();
      return;
    }

    // facedown -> draw facedown cards and move to reveal phase
    if (this.battleStage === 'facedown') {
      this.inBattle = true;
      // place up to 3 facedown from each
      for (let i = 0; i < 3; i++) {
        if (this.playerDeck.length > 0) this.currentStakes.push(this.playerDeck.shift());
        if (this.computerDeck.length > 0) this.currentStakes.push(this.computerDeck.shift());
      }
      this.warPhase = 'facedown';
      this.warPlaced = true; // show the small facedown cards now that they've been placed
      // show facedown for a short time (user asked to click through, so keep minimal automatic delay)
      await this.sleep(250);
      this.battleStage = 'reveal';
      this.inBattle = false;
      this.cdr.detectChanges();
      return;
    }

    // reveal -> draw one face-up card each, show flipped images, decide winner
    if (this.battleStage === 'reveal') {
      this.inBattle = true;
      if (this.playerDeck.length === 0 || this.computerDeck.length === 0) {
        this.inBattle = false;
        this.battleStage = 'idle';
        this.cdr.detectChanges();
        return;
      }
      const pFace = this.playerDeck.shift()!;
      const cFace = this.computerDeck.shift()!;
      this.currentStakes.push(pFace, cFace);
      // show reveal (left = computer, right = player)
      this.images = [cFace.image, pFace.image];
      this.flipCards.left = true;
      this.flipCards.right = true;
      this.warPhase = 'reveal';
      // wait a bit so user can see reveal; they can also click Next again to continue
      await this.sleep(200);
      const winner = this.compareCardValues(pFace, cFace);
      console.debug('Reveal:', { player: pFace?.value, computer: cFace?.value, winner });
      if (winner === 'tie') {
        // stay in facedown (another war); keep warPhase and let user click Next
        this.battleStage = 'facedown';
        this.inBattle = false;
        this.cdr.detectChanges();
        return;
      }
      // not tie: animate and award
      await this.animateStakes(this.currentStakes, winner);
      if (winner === 'player') this.playerDeck.push(...this.currentStakes);
      else this.computerDeck.push(...this.currentStakes);
      this.currentStakes = [];
      this.playerCaptured = this.playerDeck.length;
      this.computerCaptured = this.computerDeck.length;
      this.lastBattleWasWar = false;
      this.warPhase = 'none';
      this.warPlaced = false;
      this.battleStage = 'idle';
      this.inBattle = false;
      this.checkForGameOver();
      this.cdr.detectChanges();
      return;
    }

  }

  private async playOneBattle(skipAnimations = false) {
    if (this.playerDeck.length === 0 || this.computerDeck.length === 0) return;
    this.lastBattleWasWar = false;
    const stakes: any[] = [];

    // each plays top card
    const pCard = this.playerDeck.shift()!;
    const cCard = this.computerDeck.shift()!;
    stakes.push(pCard, cCard);
    // for display: left = computer, right = player
    this.images = [cCard.image, pCard.image];

    let winner = this.compareCardValues(pCard, cCard);
    console.debug('Auto play initial draw:', { player: pCard?.value, computer: cCard?.value, winner });

    while (winner === 'tie') {
      this.lastBattleWasWar = true;
      // show facedown phase
      this.warPhase = 'facedown';
      // each player puts up to 3 face-down cards (or as many as they have)
      for (let i = 0; i < 3; i++) {
        if (this.playerDeck.length > 0) stakes.push(this.playerDeck.shift());
        if (this.computerDeck.length > 0) stakes.push(this.computerDeck.shift());
      }
      // indicate the facedown cards have been placed so visuals may show
      this.warPlaced = true;
      // pause so user can see the facedown visuals (skip or shrink during fast sim)
      if (!skipAnimations) await this.sleep(700);
      else await this.sleep(1);

      // then one face-up if possible
      if (this.playerDeck.length === 0 || this.computerDeck.length === 0) {
        // someone ran out during war — the one with cards wins everything
        break;
      }
      const pFace = this.playerDeck.shift()!;
      const cFace = this.computerDeck.shift()!;
      stakes.push(pFace, cFace);
      // reveal phase: show the face-up cards (left = computer, right = player)
      this.images = [cFace.image, pFace.image];
      this.warPhase = 'reveal';
      if (!skipAnimations) await this.sleep(900);
      else await this.sleep(1);
      winner = this.compareCardValues(pFace, cFace);
      // continue loop if still tie
    }

    // if one deck is empty now, give stakes to the other
    if (this.playerDeck.length === 0 && this.computerDeck.length === 0) {
      // both out — split or tie: put stakes aside (we'll call it tie)
      return;
    }

    const cleanStakes = stakes.filter(Boolean);
    // animate stakes flying to winner stack before actually awarding (skip in fast sim)
    if (!skipAnimations) await this.animateStakes(cleanStakes, winner);
    // clear the war visual after animation
    this.lastBattleWasWar = false;
    this.warPhase = 'none';
    this.warPlaced = false;

    if (winner === 'player') {
      this.playerDeck.push(...cleanStakes);
      this.header = `You win a battle (+${cleanStakes.length} cards)`;
    } else if (winner === 'computer') {
      this.computerDeck.push(...cleanStakes);
      this.header = `Computer wins a battle (+${cleanStakes.length} cards)`;
    } else {
      if (this.playerDeck.length > this.computerDeck.length) this.playerDeck.push(...cleanStakes);
      else this.computerDeck.push(...cleanStakes);
    }
    this.checkForGameOver();
  }

  // Animate an array of card objects (must have .image) toward the winner ('player' | 'computer' | 'tie')
  private async animateStakes(stakes: any[], winner: 'player' | 'computer' | 'tie') {
    if (!stakes || stakes.length === 0) return;
    // compute start point (center of cards area)
    const cardsRect = document.getElementById('cards')?.getBoundingClientRect();
    if (!cardsRect) return;
    const startX = cardsRect.left + cardsRect.width / 2 - 35; // center offset (half card width)
    const startY = cardsRect.top + cardsRect.height / 2 - 48; // half card height

    // target stack elements (both sides) so we can compute a symmetric landing distance
    const playerStackEl = document.querySelector('.captured.player .stack') as HTMLElement | null;
    const computerStackEl = document.querySelector('.captured.computer .stack') as HTMLElement | null;
    const playerRect = playerStackEl?.getBoundingClientRect();
    const computerRect = computerStackEl?.getBoundingClientRect();
    // also compute targetRect for the winner (may be null if missing)
    const targetSelector = winner === 'player' ? '.captured.player .stack' : '.captured.computer .stack';
    const targetEl = document.querySelector(targetSelector) as HTMLElement | null;
    const targetRect = targetEl?.getBoundingClientRect();

    // if no target (tie or missing), just fade/scale out
    const duration = 600;
    this.animatingCards = [];

    // compute symmetric horizontal offset D from center
    const centerX = cardsRect.left + cardsRect.width / 2;
    const cardHalf = 35; // half of anim card width
    const leftInner = computerRect ? (computerRect.left + computerRect.width - cardHalf) : (centerX - 180);
    const rightInner = playerRect ? (playerRect.left + cardHalf) : (centerX + 180);
    const leftDist = Math.abs(leftInner - centerX);
    const rightDist = Math.abs(rightInner - centerX);
    // Use the smaller of the two distances so we don't overshoot the nearer stack's inner edge
    // Subtract a small gap so cards land slightly away from the stack edge for visual breathing room
    const gap = 8; // pixels
    const D = Math.max(8, Math.min(leftDist, rightDist) - gap);

    const waits: Promise<void>[] = [];

    for (let i = 0; i < stakes.length; i++) {
      const card = stakes[i];
      const id = `${Date.now()}-${i}`;
      const left = startX + (Math.random() - 0.5) * 20; // slight jitter
      const top = startY + (Math.random() - 0.5) * 20;
      const bg = `url(${card.image})`;
      const style: any = {
        left: `${left}px`,
        top: `${top}px`,
        backgroundImage: bg,
        transform: 'translate(0px,0px) scale(1)',
        opacity: 1,
      };
      this.animatingCards.push({ id, style });
      // schedule transform to target and create a promise that resolves when the animation should be finished
      const animPromise = new Promise<void>(resolve => {
        const idx = i;
        const startDelay = 30 + i * 30;
        setTimeout(() => {
          const cardObj = this.animatingCards.find(c => c.id === id);
          if (!cardObj) { resolve(); return; }
          let tx = 0, ty = 0; const branch = targetRect ? 'target' : 'fade';
          if (targetRect) {
            const destCenterX = (targetRect.left + targetRect.width / 2) - cardHalf;
            const destCenterY = (targetRect.top + targetRect.height / 2 - 48);
            tx = destCenterX - left + (idx * -2);
            ty = destCenterY - top + (idx * -2);
          } else {
            tx = (Math.random()-0.5)*20; ty = 40 + idx;
          }
          const newTransform = targetRect
            ? `translate(${tx}px, ${ty}px) scale(0.75)`
            : `translate(${tx}px, ${ty}px) scale(0.6)`;
          const newOpacity = targetRect ? 1 : 0.05;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!this.animatingCards.find(c => c.id === id)) { resolve(); return; }
              cardObj.style = { ...cardObj.style, transform: newTransform, opacity: newOpacity };
              this.cdr.detectChanges();
              setTimeout(() => resolve(), duration + 40);
            });
          });
        }, startDelay);
      });
      waits.push(animPromise);
      // wait a short stagger before creating next promise chain, but don't await here — we'll collect all promises
      // store promise in map as well
    }

    // wait for all scheduled animation promises to finish, with a fallback timeout
    await Promise.race([ Promise.all(waits), this.sleep(duration + 500 + stakes.length * 40) ]);
    // cleanup
    this.animatingCards = [];
    this._pendingAnimResolvers.clear();
    this.cdr.detectChanges();
  }

  // center pile getters removed — center piles are displayed from the main flip slots now

  onAnimTransitionEnd(id: string) {
    const resolver = this._pendingAnimResolvers.get(id);
    if (resolver) {
      resolver();
      this._pendingAnimResolvers.delete(id);
    }
  }

  private compareCardValues(card1: any, card2: any): 'player' | 'computer' | 'tie' {
    // Robust ranking map (handles unexpected casing/values)
    const ranks: Record<string, number> = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
      'JACK': 11, 'QUEEN': 12, 'KING': 13, 'ACE': 14
    };
    const v1 = card1 && card1.value ? String(card1.value).toUpperCase() : '';
    const v2 = card2 && card2.value ? String(card2.value).toUpperCase() : '';
    const r1 = ranks[v1] ?? -1;
    const r2 = ranks[v2] ?? -1;
    // Debugging: log unexpected values
    if (r1 === -1 || r2 === -1) console.debug('compareCardValues: unknown card value', v1, v2, card1, card2);
    if (r1 > r2) return 'player';
    if (r1 < r2) return 'computer';
    return 'tie';
  }
}
