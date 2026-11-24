import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SolButtonComponent, SolCardComponent, SolRevealDirective, SolTrendComponent } from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-card-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolCardComponent, SolRevealDirective, SolButtonComponent, SolTrendComponent],
  template: `
    <app-page
      title="Card & reveal"
      lead="The themed surface, and an entrance animation driven by the theme motion tokens (respects reduced motion)."
      [selectors]="['sol-card', '[solReveal]']"
    >
      <app-demo title="Card" [code]="cardCode">
        <div class="cards">
          <sol-card>
            <p class="label">Active projects</p>
            <p class="value">24 <sol-trend [current]="24" [previous]="20" /></p>
          </sol-card>
          <sol-card [hoverable]="true">
            <p class="label">Hoverable</p>
            <p class="text">Lifts on hover with the card shadow token.</p>
          </sol-card>
          <sol-card [padding]="false">
            <img class="cover" src="solercia-mark.svg" alt="" />
            <p class="text pad">No padding: media goes edge to edge.</p>
          </sol-card>
        </div>
      </app-demo>

      <app-demo title="Reveal" description="Staggered by solRevealIndex; changing solRevealReplay replays it." [code]="revealCode" [stack]="true">
        <sol-button variant="secondary" (clicked)="replay.set(replay() + 1)">Replay animation</sol-button>
        <div class="cards">
          @for (item of items; track item; let i = $index) {
            <sol-card solReveal [solRevealIndex]="i" [solRevealReplay]="replay()">
              <p class="text">{{ item }}</p>
            </sol-card>
          }
        </div>
      </app-demo>
    </app-page>
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--sol-space-md);
      width: 100%;
    }
    .label {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
    .value {
      display: flex;
      align-items: center;
      gap: var(--sol-space-sm);
      margin: var(--sol-space-xs) 0 0;
      font-size: var(--sol-font-size-xl);
      font-weight: var(--sol-font-weight-bold);
      font-family: var(--sol-font-numeric);
    }
    .text {
      margin: 0;
      color: var(--sol-color-text-primary);
    }
    .pad {
      padding: var(--sol-space-md);
    }
    .cover {
      display: block;
      width: 100%;
      height: 96px;
      object-fit: contain;
      background: var(--sol-bg-sunken);
    }
  `,
})
export class CardPage {
  protected readonly replay = signal(0);
  protected readonly items = ['Discovery', 'Design', 'Build', 'Test', 'Launch', 'Measure'];

  protected readonly cardCode = `<sol-card>…</sol-card>
<sol-card [hoverable]="true">…</sol-card>
<sol-card [padding]="false"><img src="cover.png" alt="" /></sol-card>`;
  protected readonly revealCode = `@for (item of items; track item; let i = $index) {
  <sol-card solReveal [solRevealIndex]="i" [solRevealReplay]="filter()">{{ item }}</sol-card>
}`;
}
