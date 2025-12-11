import { Component } from '@angular/core';
import { GameService } from './game.service';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent {
  deckId: string | null = null;
  images: string[] = [];
  remaining = '';
  header = 'Game of War';
  computerScore = 0;
  myScore = 0;
  drawDisabled = true;

  constructor(private gameService: GameService) {}

  newGame() {
    this.gameService.newDeck().subscribe(res => {
      this.deckId = res.deck_id;
      this.remaining = `Remaining cards: ${res.remaining}`;
      this.computerScore = 0;
      this.myScore = 0;
      this.images = [];
      this.header = 'Game of War';
      this.drawDisabled = false;
    });
  }

  drawCards() {
    if (!this.deckId) return;
    this.gameService.draw(this.deckId).subscribe(res => {
      this.remaining = `Remaining cards: ${res.remaining}`;
      this.images = [res.cards[0].image, res.cards[1].image];
      const winner = this.determineCardWinner(res.cards[0], res.cards[1]);
      this.header = winner;

      if (res.remaining === 0) {
        this.drawDisabled = true;
        if (this.computerScore > this.myScore) this.header = 'The computer won the game!';
        else if (this.myScore > this.computerScore) this.header = 'You won the game!';
        else this.header = "It's a tie game!";
      }
    });
  }

  private determineCardWinner(card1: any, card2: any): string {
    const valueOptions = ["2","3","4","5","6","7","8","9","10","JACK","QUEEN","KING","ACE"];
    const i1 = valueOptions.indexOf(card1.value);
    const i2 = valueOptions.indexOf(card2.value);
    if (i1 > i2) { this.computerScore++; return 'Computer wins!'; }
    if (i1 < i2) { this.myScore++; return 'You win!'; }
    return 'Tie!';
  }
}
