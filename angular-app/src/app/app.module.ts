import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { GameComponent } from './game/game.component';
import { GameService } from './game.service';

@NgModule({
  declarations: [AppComponent, GameComponent],
  imports: [BrowserModule, FormsModule],
  providers: [provideHttpClient(), GameService],
  bootstrap: [AppComponent]
})
export class AppModule {}
