/** A Mermaid block of a guide: the element that receives the SVG and the diagram source. */
export interface MermaidDiagram {
  readonly host: HTMLElement;
  readonly source: string;
  /** Mode the current SVG was drawn for; `null` while it has not been drawn. */
  renderedDark: boolean | null;
}

let sequence = 0;

/** Resolves a theme token to a concrete color Mermaid can parse (`rgb(...)`). */
function tokenColor(probe: HTMLElement, token: string): string {
  probe.style.color = `var(${token})`;
  return getComputedStyle(probe).color;
}

/**
 * Draws (or redraws, after a light/dark change) the diagrams with colors taken from the active
 * `--sol-*` tokens. Mermaid is imported on demand, so it never reaches the initial bundle, and runs
 * with `securityLevel: 'strict'`. A diagram that fails to render keeps its source as a code block.
 */
export async function renderMermaidDiagrams(diagrams: readonly MermaidDiagram[], dark: boolean): Promise<void> {
  const pending = diagrams.filter((diagram) => diagram.renderedDark !== dark && diagram.host.isConnected);
  if (pending.length === 0) return;

  const { default: mermaid } = await import('mermaid');
  const probe = document.createElement('span');
  document.body.append(probe);
  const color = (token: string) => tokenColor(probe, token);
  const fontFamily = getComputedStyle(document.body).fontFamily;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily,
    themeVariables: {
      darkMode: dark,
      fontFamily,
      fontSize: '14px',
      background: color('--sol-bg-surface'),
      primaryColor: color('--sol-bg-sunken'),
      primaryTextColor: color('--sol-color-text-primary'),
      primaryBorderColor: color('--sol-color-primary'),
      secondaryColor: color('--sol-bg-surface'),
      tertiaryColor: color('--sol-bg-surface'),
      clusterBkg: color('--sol-bg-page'),
      clusterBorder: color('--sol-border-color-default'),
      lineColor: color('--sol-color-text-secondary'),
      textColor: color('--sol-color-text-primary'),
      edgeLabelBackground: color('--sol-bg-surface'),
    },
  });
  probe.remove();

  for (const diagram of pending) {
    try {
      const { svg } = await mermaid.render(`docs-diagram-${++sequence}`, diagram.source);
      // Mermaid output for diagrams authored in this repository, sanitized by Mermaid (strict mode).
      diagram.host.innerHTML = svg;
      diagram.renderedDark = dark;
    } catch {
      diagram.renderedDark = dark;
    }
  }
}
