import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { GameComponent } from './game/game.component';
import { GameService } from './game.service';

@NgModule({
  declarations: [AppComponent, GameComponent],
  imports: [BrowserModule, HttpClientModule, FormsModule],
  providers: [GameService],
  bootstrap: [AppComponent]
})
export class AppModule {}
