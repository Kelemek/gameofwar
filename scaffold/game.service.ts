import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GameService {
  constructor(private http: HttpClient) {}

  newDeck(): Observable<any> {
    return this.http.get('https://apis.scrimba.com/deckofcards/api/deck/new/shuffle/');
  }

  draw(deckId: string, count = 2): Observable<any> {
    return this.http.get(`https://apis.scrimba.com/deckofcards/api/deck/${deckId}/draw/?count=${count}`);
  }
}
