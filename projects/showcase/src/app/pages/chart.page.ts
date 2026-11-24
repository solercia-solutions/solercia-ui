import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SolChartComponent, type SolChartData } from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-chart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolChartComponent],
  template: `
    <app-page
      title="Chart"
      lead="Declarative wrapper over Chart.js. Colors, fonts and grid come from the active theme and re-render on light/dark changes."
      [selectors]="['sol-chart']"
    >
      <div class="grid">
        <app-demo title="Line" [code]="lineCode" [stack]="true">
          <sol-chart type="line" [data]="revenue" ariaLabelKey="showcase.chart.revenue" />
        </app-demo>
        <app-demo title="Bar with yMax and no legend" [code]="barCode" [stack]="true">
          <sol-chart type="bar" [data]="tickets" [options]="{ legend: false, yMax: 120 }" ariaLabelKey="showcase.chart.tickets" />
        </app-demo>
        <app-demo title="Doughnut" [code]="doughnutCode" [stack]="true">
          <sol-chart type="doughnut" [data]="status" ariaLabelKey="showcase.chart.status" height="240px" />
        </app-demo>
        <app-demo title="Sparkline" description="No axes; for KPI tiles." [code]="sparkCode" [stack]="true">
          <sol-chart type="sparkline" [data]="signups" ariaLabelKey="showcase.chart.spark" height="64px" />
        </app-demo>
      </div>
    </app-page>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
      gap: var(--sol-space-lg);
    }
  `,
})
export class ChartPage {
  protected readonly revenue: SolChartData = {
    labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
    series: [
      { label: '2026', data: [42, 48, 51, 58, 63, 71] },
      { label: '2025', data: [35, 38, 40, 44, 47, 50] },
    ],
  };
  protected readonly tickets: SolChartData = {
    labels: ['Email', 'Chat', 'Phone', 'Portal'],
    series: [{ label: 'Tickets', data: [96, 74, 31, 58] }],
  };
  protected readonly status: SolChartData = {
    labels: ['On track', 'At risk', 'Delayed', 'Done'],
    series: [{ label: 'Projects', data: [14, 5, 3, 9] }],
  };
  protected readonly signups: SolChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    series: [{ label: 'Sign-ups', data: [12, 18, 9, 22, 30, 16, 25] }],
  };

  protected readonly lineCode = `<sol-chart type="line" [data]="revenue" ariaLabelKey="showcase.chart.revenue" />

revenue: SolChartData = {
  labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
  series: [
    { label: '2026', data: [42, 48, 51, 58, 63, 71] },
    { label: '2025', data: [35, 38, 40, 44, 47, 50] },
  ],
};`;
  protected readonly barCode = `<sol-chart type="bar" [data]="tickets" [options]="{ legend: false, yMax: 120 }" ariaLabelKey="showcase.chart.tickets" />`;
  protected readonly doughnutCode = `<sol-chart type="doughnut" [data]="status" ariaLabelKey="showcase.chart.status" height="240px" />`;
  protected readonly sparkCode = `<sol-chart type="sparkline" [data]="signups" ariaLabelKey="showcase.chart.spark" height="64px" />`;
}
