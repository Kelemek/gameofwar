# Angular scaffold for Game of War

This `scaffold/` folder contains example Angular (v12+) component and service files you can copy into a CLI-generated Angular app.

Recommended steps (Option A - using Angular CLI):

1. Install Angular CLI if needed:

```bash
npm install -g @angular/cli
```

2. Create a new Angular app in a subfolder (from repo root):

```bash
ng new angular-app --routing=false --style=css
cd angular-app
```

3. Add the scaffold files into the app:

- copy `scaffold/game.service.ts` to `src/app/game.service.ts`
- copy `scaffold/game.component.ts` to `src/app/game/game.component.ts`
- copy `scaffold/game.component.html` to `src/app/game/game.component.html`
- create `src/app/game/game.component.css` and copy your styles or import `../../index.css`

4. Register the component in `app.module.ts` and import `HttpClientModule`:

```ts
import { HttpClientModule } from '@angular/common/http';
import { GameComponent } from './game/game.component';

@NgModule({
  declarations: [AppComponent, GameComponent],
  imports: [BrowserModule, HttpClientModule],
  bootstrap: [AppComponent]
})
export class AppModule {}
```

5. Add `<app-game></app-game>` to `app.component.html` and run:

```bash
ng serve
```

Option B: If you prefer I can generate a full `angular-app/` folder here (manual scaffold). Tell me and I'll create it.
