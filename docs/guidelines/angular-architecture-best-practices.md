# Boas Práticas de Arquitetura Angular - Gatuno

Este documento descreve as regras e padrões arquiteturais que devem ser seguidos rigorosamente no projeto Gatuno para garantir escalabilidade, performance e manutenibilidade.

## 1. Arquitetura Feature-Sliced Design (FSD) / DDD

O projeto é organizado em camadas baseadas em domínios e responsabilidades:

- **Core (`src/app/core/`):** Contém singletons e configurações globais. Aqui vivem os interceptadores (ex: auth, cache), serviços globais e tokens de injeção.
- **Shared (`src/app/shared/`):** Contém UI genérica seguindo o **Atomic Design** (`atoms`, `molecules`, `organisms`), além de utilitários e validadores reutilizáveis.
- **Features (`src/app/features/`):** Contém a lógica de negócio e componentes específicos de cada domínio (ex: `authentication`, `books`, `reading`).
- **Pages (`src/app/pages/`):** Componentes roteados que compõem as diversas fatias de negócio (features) em uma visualização final.

## 2. Padrões de Componentes (Angular v21+)

- **Standalone:** Todos os componentes, diretivas e pipes devem ser standalone.
- **Estratégia de Detecção:** `changeDetection: ChangeDetectionStrategy.OnPush` é obrigatório para otimização de performance.
- **Signals API:**
  - Utilize `input()` e `output()` (Signal-based) em vez de `@Input()` e `@Output()`.
  - Utilize `model()` para bindings de duas vias.
  - Utilize `computed()` para estados derivados.
- **Injeção de Dependência:** Prefira a função `inject()` em vez de injeção via construtor.

## 3. Templates e Controle de Fluxo

- Utilize a sintaxe de controle de fluxo nativa do Angular: `@if`, `@for` (sempre com `track`), `@switch`.
- Evite lógica complexa nos templates; delegue para propriedades calculadas (`computed`) no TypeScript.
- **Imagens:** Utilize `NgOptimizedImage` para imagens estáticas para melhor LCP e performance.

## 4. Performance e Qualidade

- **Knip:** O projeto utiliza o Knip para identificar código morto, exports não utilizados e dependências órfãs. Execute periodicamente para manter o projeto limpo.
- **Testes:** Todo novo recurso ou correção deve vir acompanhado de testes unitários que comprovem seu comportamento.
- **Acessibilidade (A11Y):** O código deve passar em checagens AXE e seguir os níveis WCAG AA.

## 5. Fluxo de Autenticação e Segurança

- Os interceptadores em `core/interceptors/` gerenciam o fluxo de autenticação e cache de forma centralizada.
- Guards de proteção de rota (ex: `auth.guard.ts`) devem estar localizados no domínio correspondente dentro de `features/authentication/`.
