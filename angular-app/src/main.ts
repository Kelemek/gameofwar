import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

// Avoid referencing `process` in the browser build to prevent TypeScript
///node type issues in this scaffold. Production-mode enabling can be
// controlled by Angular CLI build flags instead.

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
