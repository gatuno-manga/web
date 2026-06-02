# Gatuno — Design System e Guia de Estilização

Este documento serve como fonte de verdade para as regras de estilo, arquitetura CSS e sistema de design do projeto Gatuno. Todas as novas implementações e refatorações devem seguir rigorosamente estas diretrizes.

## 1. Sistema de Cores e Temas

O projeto suporta três temas (`light`, `dark` e `true-dark`). Para que os temas funcionem corretamente, **NUNCA use cores hardcoded (hex, rgb, rgba explícitos) no CSS dos componentes.** Use sempre os tokens semânticos (CSS Variables).

Os tokens estão definidos em `public/assets/scss/_color-definitions.scss`.

### Tokens Estruturais e de Texto
- `--app-background-color`: Fundo principal da aplicação. (Alias: `--app-bg-color`)
- `--app-text-color`: Texto principal (primário).
- `--app-text-color-secondary`: Texto secundário, descrições ou textos atenuados.
- `--primary-color`: Cor de destaque e identidade da marca (laranja no dark, lilás no light).
- `--secondary-color`: Fundo de elementos em destaque secundário (inputs, cards, paginação).
- `--context-menu-bg`: Fundo base para menus, dropdowns e modais flutuantes.

### Tokens Utilitários
- `--border-color`: Cor padrão para bordas e divisores (substitui `rgba(255,255,255,0.1)`).
- `--hover-color`: Cor de fundo sutil para estados de hover.
- `--white-muted`: Para elementos esbranquiçados translúcidos, que se adaptam no light mode.
- `--shadow-color`: Cor base para box-shadows.

### Tokens de Feedback (Semânticos)
- `--success-color` e `--scraping-status-ready-color`: Sucesso / Pronto.
- `--warning-color` e `--scraping-status-processing-color`: Aviso / Em processamento.
- `--danger-color`, `--erro-message-color`, `--scraping-status-error-color`: Erro / Destrutivo.

### Opacidade Segura (Transparência com Tokens)
Quando precisar aplicar opacidade sobre um token, use a função `rgb()` moderna:
```scss
// ✅ CORRETO
background-color: rgb(from var(--primary-color) r g b / 0.1);
box-shadow: 0 4px 10px rgb(from var(--black) r g b / 0.5);

// ❌ INCORRETO (quebra em light mode)
background-color: rgba(255, 255, 255, 0.1);
background-color: rgba(0, 0, 0, 0.5);
```

---

## 2. Tipografia

A tipografia é controlada por tokens para garantir consistência. Nunca faça hardcode de strings como `font-family: 'Inknut Antiqua', serif;`.

- `--font-display`: Fontes de cabeçalho, títulos principais e identidade visual (Inknut Antiqua).
- `--font-body`: Texto comum e leitura prolongada (Manrope).
- `--font-ui`: Elementos de interface, botões e controles (Plus Jakarta Sans).
- `--font-secondary`: Fontes secundárias (Epilogue).

```scss
// ✅ CORRETO
h1, h2, .section-title {
  font-family: var(--font-display);
}

// ❌ INCORRETO
h1 {
  font-family: 'Inknut Antiqua', serif;
}
```

---

## 3. Elementos e Mixins Globais

Os componentes devem usar os mixins disponíveis na pasta `public/assets/scss/` para garantir homogeneidade.

### Dropdowns e Menus (`_dropdown-menu.scss`)
Qualquer dropdown, menu de contexto ou painel flutuante deve herdar esta base:
```scss
@use 'dropdown-menu' as dropdown;

.meu-dropdown {
  @include dropdown.dropdown-menu-base;
  
  .item {
    @include dropdown.dropdown-menu-item;
  }
}
```

### Skeletons e Loadings (`_mixins.scss`)
Para estados de loading, use os mixins em vez de criar animações do zero:
```scss
@use 'mixins';

.loading-card {
  @include mixins.skeleton-block($width: 100%, $height: 200px, $radius: 12px);
}
```
*Dica: Você também pode usar a classe utilitária `.placeholder` do `global.scss` diretamente no HTML.*

---

## 4. Componentes Reutilizáveis (UI)

Sempre verifique `src/app/shared/ui/` antes de estilizar botões ou inputs.

### Botões (`app-button`)
**Nunca crie botões "do zero" no SCSS de um componente** (como antigamente na Home com `.btn-primary`). Use o componente `<app-button>`:
```html
<app-button variant="primary" rounded="small" padding="normal">
  Ler agora
</app-button>
```
O botão já implementa estados de hover, disabled, focus, e variações (`primary`, `outline`, `text`, `rounded`, etc.).

---

## 5. Antipadrões e Violações Identificadas (O que NÃO Fazer)

As análises iniciais do sistema detectaram vários antipadrões que vêm sendo gradativamente corrigidos e que **não devem ser repetidos**:

1. **Combater o Encapsulamento do Angular:**
   Usar `::ng-deep` ou colocar estilos em componentes-pai (`header.component.scss`) tentando atingir classes de componentes-filhos (`search.molecule.scss`). O encapsulamento `Emulated` do Angular bloqueia isso, gerando CSS morto.
   *Solução: Mantenha os estilos no componente correspondente, ou use `@Input` para passar variações de estilo.*

2. **Hardcode de Temas Fixos:**
   Aplicar `color: var(--white)` e `background: var(--black)` dentro de containers. Isso destrói o Light Mode, tornando os textos invisíveis (branco no branco).
   *Solução: Use sempre `--app-text-color` e `--app-background-color`.*

3. **Z-index Arbitrário:**
   Uso de `z-index: 1000, 1001, 9999` sem contexto gera conflito visual (dropdowns aparecendo atrás de headers).
   *Solução: Controle empilhamentos contextualmente ou crie tokens estruturais.*

4. **Sombra e Bordas Ocultas (Hardcode):**
   Uso excessivo de `border: 1px solid rgba(255, 255, 255, 0.1)`. No modo claro, essa borda se torna invisível ou suja o layout.
   *Solução: Use a variável `--border-color`, calibrada para cada tema.*

---

## 6. Layout e Formas (Geometria)

- **Bordas arredondadas:** O sistema prefere arredondamentos consistentes. Elementos como inputs e dropdowns comumente usam `12px` (`0.75rem`). Evite misturar variações aleatórias (`8px`, `20px`) em um mesmo fluxo.
- **Focus:** Todo elemento interativo DEVE ter feedback visual claro no teclado. Use o estilo nativo ou o padrão do projeto:
  ```scss
  &:focus-visible, &:focus-within {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  ```
