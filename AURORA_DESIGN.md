# Aurora Glassmorphism — Guia de Estilo Gatuno

> Complementa o [`styling-guidelines.md`](./styling-guidelines.md). Leia os dois antes de implementar qualquer página ou componente novo.

---

## O que é o Aurora Glassmorphism?

O estilo Aurora Glassmorphism é a nova linguagem visual do Gatuno. Combina dois conceitos:

- **Glassmorphism** — superfícies translúcidas com desfoque de fundo, sensação de profundidade e camadas de vidro
- **Aurora UI** — gradientes orgânicos e fluidos que evocam a aurora boreal, com cores que fluem suavemente pelo fundo

O resultado é uma interface que parece **viva e tridimensional**, mantendo legibilidade total e compatibilidade com light/dark mode.

---

## Paleta Aurora

As cores da aurora derivam diretamente dos tokens já existentes em `_color.scss`. Nenhuma cor nova foi criada — apenas combinadas com opacidade:

| Papel | Token | Valor |
|---|---|---|
| Calor / Energia | `--primary-color` (dark) | `#f18522` — laranja |
| Frio / Nebulosa | `--lilac` | `#a972ff` — lilás |
| Base / Profundidade | `--secondary-color` | `#20142a` — roxo escuro |
| Vazio / Espaço | `--app-background-color` | `#000212` — preto azulado |
| Acento frio | `--cyan` | `#17a2b8` — ciano |

> **Regra:** Nunca use esses valores em hex direto nos componentes. Use sempre os tokens via `var(--...)`.

---

## Camadas da interface

A interface é construída em **4 camadas sobrepostas**:

```
┌─────────────────────────────────────────┐
│  4. Conteúdo  (z-index: 1+)             │  Texto, ícones, formulários
├─────────────────────────────────────────┤
│  3. Superfície Glass  (z-index: 1)      │  Cards, modais, navbar
├─────────────────────────────────────────┤
│  2. Aurora Mesh  (z-index: 0)           │  Gradientes radiais fixos
├─────────────────────────────────────────┤
│  1. Aurora Orbs  (z-index: 0)           │  Bolhas de luz animadas
└─────────────────────────────────────────┘
        background-color da página
```

---

## Orbes Aurora (fundo animado)

As orbes são `div`s decorativos com `position: fixed`, `border-radius: 50%` e `filter: blur()`. Elas ficam **atrás de tudo** e criam o ambiente visual da página.

### Onde adicionar

Adicione dentro do componente de layout da seção (ex: `outlet.component.html`, futuramente `app.component.html`):

```html
<div class="aurora-scene" aria-hidden="true">
  <div class="aurora-orb aurora-orb--warm"></div>
  <div class="aurora-orb aurora-orb--cold"></div>
  <div class="aurora-orb aurora-orb--accent"></div>
  <div class="aurora-mesh"></div>
</div>
```

### SCSS padrão das orbes

```scss
.aurora-scene {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.aurora-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  will-change: transform;

  &--warm {
    width: 700px;
    height: 500px;
    background: radial-gradient(
      circle,
      rgba(241, 133, 34, 0.22) 0%,
      rgba(241, 133, 34, 0.08) 60%,
      transparent 100%
    );
    top: -15%;
    right: -10%;
    animation: orb-float-a 22s ease-in-out infinite;
  }

  &--cold {
    width: 500px;
    height: 500px;
    background: radial-gradient(
      circle,
      rgba(169, 114, 255, 0.18) 0%,
      rgba(169, 114, 255, 0.06) 60%,
      transparent 100%
    );
    bottom: 5%;
    left: -8%;
    animation: orb-float-b 28s ease-in-out infinite;
    animation-delay: -10s;
  }
}

@keyframes orb-float-a {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%       { transform: translate(-30px, 40px) scale(1.06); }
  66%       { transform: translate(20px, -20px) scale(0.96); }
}
```

> **Importante:** Adicione sempre `aria-hidden="true"` nas orbes. São puramente decorativas e não devem ser lidas por leitores de tela.

---

## Efeito Glass — Receita padrão

Todo card, painel ou modal deve usar esta base glass em vez de `background-color` sólido:

### Glass Surface (uso geral — cards, dropdowns)

```scss
.meu-card {
  background: color-mix(
    in srgb,
    var(--secondary-color) 60%,
    transparent
  );
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}
```

### Glass Deep (modais, auth card, hero)

```scss
.meu-modal {
  background: color-mix(
    in srgb,
    var(--app-background-color) 75%,
    transparent
  );
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
}
```

### Glass Ghost (itens de lista, badges)

```scss
.meu-item {
  background: rgb(from var(--app-background-color) r g b / 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--border-color);
}
```

---

## Bordas

As bordas neste design são **neutras e sutis**. Sem degradê, sem brilho colorido.

```scss
// ✅ CORRETO — borda neutra do sistema de design
border: 1px solid var(--border-color);

// ❌ INCORRETO — borda com glow colorido (foi removido)
border: 1px solid rgb(from var(--primary-color) r g b / 0.18);
```

O `--border-color` já está calibrado para cada tema em `_color-definitions.scss` e funciona corretamente tanto em dark quanto em light mode.

---

## Animações de Hover — Gradiente de Varredura

Para elementos interativos que merecem destaque visual (ex: botão de passkey, cards clicáveis), use a técnica de **gradiente de varredura com pseudo-elemento**:

```scss
.elemento-interativo {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border-color);
  transition: border-color 0.35s ease, box-shadow 0.35s ease;

  // Gradiente escondido — aguarda o hover
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      110deg,
      rgba(241, 133, 34, 0.08) 0%,    // laranja (--orange)
      rgba(169, 114, 255, 0.10) 50%,  // lilás (--lilac)
      rgba(241, 133, 34, 0.06) 100%
    );
    background-size: 200% 100%;
    background-position: 100% 0;       // começa escondido à direita
    opacity: 0;
    transition:
      opacity 0.35s ease,
      background-position 0.6s ease;
    pointer-events: none;
    border-radius: inherit;
  }

  &:hover {
    border-color: rgb(from var(--primary-color) r g b / 0.35);

    &::before {
      opacity: 1;
      background-position: 0% 0;      // varre da direita para a esquerda
    }
  }
}
```

### Como funciona

1. O `::before` ocupa todo o elemento com `position: absolute; inset: 0`
2. O gradiente começa com `background-position: 100%` — invisível à direita
3. No hover, `opacity` vai de 0 → 1 e `background-position` vai de 100% → 0% 
4. Isso cria o efeito de varredura suave do gradiente da direita para a esquerda
5. O `overflow: hidden` no pai garante que o gradiente não vaze fora do `border-radius`

> **z-index:** Todo conteúdo interno (ícones, textos) deve ter `position: relative; z-index: 1` para ficar acima do `::before`.

---

## Animação de entrada de componentes

Sempre que um componente ou bloco de formulário aparecer na tela (ex: troca de step, abertura de modal), use esta animação de entrada:

```scss
.meu-bloco {
  animation: aurora-enter 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes aurora-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Para painéis que entram lateralmente (ex: steps de formulário):

```scss
@keyframes aurora-enter-side {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

---

## Mensagens de feedback

Toda mensagem de erro, aviso ou info deve seguir este padrão:

```html
<!-- Erro -->
<div class="feedback-msg feedback-msg--error" role="alert">
  <app-icons name="alert-circle" size="16px" />
  <span>Mensagem de erro aqui</span>
</div>

<!-- Info / aviso -->
<div class="feedback-msg feedback-msg--info" role="status">
  <app-icons name="alert-triangle" size="16px" />
  <span>Mensagem informativa aqui</span>
</div>
```

```scss
.feedback-msg {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.8rem;
  line-height: 1.4;
  animation: aurora-enter 0.3s ease forwards;

  &--error {
    background: rgb(from var(--dark-red) r g b / 0.1);
    border: 1px solid rgb(from var(--dark-red) r g b / 0.25);
    color: var(--danger-color);
  }

  &--info {
    background: rgb(from var(--primary-color) r g b / 0.08);
    border: 1px solid rgb(from var(--primary-color) r g b / 0.2);
    color: var(--primary-color);
  }
}
```

---

## Regras obrigatórias

| Regra | Razão |
|---|---|
| Use `var(--border-color)` para bordas, não cores hardcoded | Compatibilidade light/dark |
| Adicione `aria-hidden="true"` em todos os elementos decorativos | Acessibilidade |
| Inclua `@media (prefers-reduced-motion: reduce)` ao usar animações | Acessibilidade |
| Use `will-change: transform` apenas em elementos que animam ativamente | Performance |
| Nunca use `backdrop-filter` em listas com muitos itens simultâneos | Performance |
| Mantenha `z-index: 0` nas orbes e cenas decorativas | Garante que ficam atrás do conteúdo |

---

## Redução de movimento

Todo arquivo SCSS que usar animações **deve** incluir:

```scss
@media (prefers-reduced-motion: reduce) {
  .aurora-orb,
  .aurora-scene * {
    animation: none;
  }

  .meu-componente {
    animation: none;
    transition: none;
  }
}
```

---

## Implementado até agora

| Área | Status | Arquivo |
|---|---|---|
| Páginas de autenticação — Layout (Outlet) | ✅ Concluído | `pages/auth/outlet/` |
| Páginas de autenticação — Login | ✅ Concluído | `pages/auth/login/` |
| Páginas de autenticação — Registro | ✅ Concluído | `pages/auth/register/` |
| Select component | ✅ Concluído | `shared/ui/atoms/inputs/select/` |
| Navbar / Header principal | 🔲 Pendente | — |
| Cards de livro (`item-book`) | 🔲 Pendente | — |
| Modais e dialogs | 🔲 Pendente | — |
| Dashboard | 🔲 Pendente | — |
| Fundo global (`app.component`) | 🔲 Pendente | — |

---

*Criado em 05/06/2026 — Gatuno Frontend*
