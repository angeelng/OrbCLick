/** Ayudas mínimas de DOM: el MVP no usa framework de UI. */
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { className?: string; text?: string; attrs?: Record<string, string> } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className !== undefined) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    node.setAttribute(name, value);
  }
  return node;
}

export function mustFind(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`Falta el contenedor #${id} en index.html`);
  return node;
}

/** Escribe solo si el texto cambió: evita repintados y reflows inútiles. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Igual que `setText` pero para estilos que se actualizan cada tick. */
export function setStyle(node: HTMLElement, property: string, value: string): void {
  if (node.style.getPropertyValue(property) !== value) {
    node.style.setProperty(property, value);
  }
}
