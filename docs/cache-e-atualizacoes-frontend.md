# Estratégia de Cache e Entrega de Atualizações do Frontend

Este documento descreve a arquitetura de cache, o ciclo de vida de atualizações do frontend Angular (Gatuno Web) e a configuração do reverse proxy (Caddy) para garantir que novas versões sejam entregues imediatamente aos usuários sem a necessidade de recargas manuais (F5 / "hard refresh").

---

## 1. O Problema Identificado

### Sintoma
Após realizar o build e deploy de uma nova versão do frontend em produção, os usuários continuavam visualizando a versão antiga da aplicação. Apenas após fechar todas as abas ou forçar uma atualização manual da página (Ctrl+F5 / Refresh) a nova versão era carregada.

### Causas Raízes

O problema era originado pela combinação de três camadas:

1. **Proxy Reverso (Caddy) sem cabeçalhos de controle de cache:**
   - O Caddy repassava as requisições (`reverse_proxy 10.10.2.10:4200`) sem cabeçalhos `Cache-Control`.
   - Os navegadores aplicavam heurística de cache (RFC 7234) ao documento HTML inicial e aos manifests, armazenando-os em cache local de disco/memória.
   - Ao lançar uma nova versão, os arquivos `.js` recebem novos hashes gerados pelo Angular (`main-[hash].js`), mas o navegador continuava lendo o `index.html` antigo em cache, solicitando bundles antigos.

2. **Express SSR (`src/server.ts`) com cache estático agressivo:**
   - O `express.static` estava configurado globalmente com `maxAge: '1y'` sem exceções:
     ```typescript
     app.get('**', express.static(browserDistFolder, { maxAge: '1y', index: 'index.html' }));
     ```
   - Arquivos essenciais como `index.html`, `custom-sw.js`, `ngsw-worker.js` e `ngsw.json` estavam sendo enviados com `Cache-Control: public, max-age=31536000`, fazendo com que os navegadores nem sequer consultassem o servidor para verificar se houve alteração.

3. **Ciclo de Vida do Angular Service Worker (PWA):**
   - O `@angular/service-worker` armazena o `index.html` e os bundles no `CacheStorage` do navegador (`installMode: prefetch`).
   - Ao navegar para o site, o Service Worker intercepta a requisição localmente e **serve imediatamente a versão antiga do cache**, antes de qualquer requisição de rede.
   - Em segundo plano, ele baixa a nova versão (`ngsw.json`), mas por padrão **não ativa a nova versão na aba ativa**. Ele aguarda que o usuário feche todas as abas, recarregue manualmente a página ou que o aplicativo invoque programaticamente `SwUpdate.activateUpdate()`.

---

## 2. Regra de Ouro do Cache para SPAs

| Tipo de Arquivo | Exemplos | Política de Cache | Motivo |
| :--- | :--- | :--- | :--- |
| **Documentos de Entrada e Rotas SSR** | `/`, `/index.html`, `/books`, rotas SPA | `no-store, no-cache, must-revalidate, max-age=0` | O HTML referencia os scripts da versão atual. Deve sempre ser verificado no servidor. |
| **Arquivos de Controle do Service Worker** | `ngsw.json`, `custom-sw.js`, `ngsw-worker.js`, `manifest.webmanifest` | `no-store, no-cache, must-revalidate, max-age=0` | Se esses arquivos ficarem em cache, o navegador nunca saberá que existe uma versão nova. |
| **Assets Imutáveis com Hash** | `main-*.js`, `chunk-*.js`, `styles-*.css`, `/assets/*`, fontes | `public, max-age=31536000, immutable` | Cada alteração de código gera um novo hash no nome do arquivo. Podem ser cacheados por 1 ano com segurança máxima. |

---

## 3. Configuração do Reverse Proxy (Caddy)

No repositório de infraestrutura (`/home/luis/Documents/proxmox/nginx/`), os arquivos `acs/Caddyfile` e `home/Caddyfile` foram configurados com matchers mutuamente exclusivos usando `handle` e sobrescrita de cabeçalhos com `header_down`:

```caddy
(gatuno_proxies) {
    # API Gatuno
    handle /api* {
        reverse_proxy 10.10.2.10:3000
    }

    # S3 Gatuno
    handle_path /s3* {
        reverse_proxy 10.10.2.10:9000
    }

    # NanoMQ WebSocket
    handle /mqtt* {
        reverse_proxy 10.10.2.10:8083
    }

    # 1. Arquivos que NUNCA devem ter cache (Service Worker, Manifest, HTMLs)
    @no_cache {
        path /ngsw.json /ngsw-worker.js /custom-sw.js /safety-worker.js /worker-basic.min.js /manifest.webmanifest *.html
    }
    handle @no_cache {
        reverse_proxy 10.10.2.10:4200 {
            header_down Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
            header_down Pragma "no-cache"
            header_down Expires "0"
        }
    }

    # 2. Arquivos estáticos imutáveis (com hash gerado pelo build do Angular)
    @static_assets {
        path /assets/* *.css *.js *.woff2 *.woff *.ttf *.png *.jpg *.jpeg *.svg *.webp *.ico
        not path /ngsw.json /ngsw-worker.js /custom-sw.js /safety-worker.js /worker-basic.min.js /manifest.webmanifest
    }
    handle @static_assets {
        reverse_proxy 10.10.2.10:4200 {
            header_down Cache-Control "public, max-age=31536000, immutable"
        }
    }

    # 3. Frontend Angular (fallback para navegação SPA e rotas SSR)
    # Todo HTML gerado dinamicamente nunca deve ser cacheado pelo navegador
    handle {
        reverse_proxy 10.10.2.10:4200 {
            header_down Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
            header_down Pragma "no-cache"
            header_down Expires "0"
        }
    }
}
```

### Como aplicar alterações no Caddy (Proxmox LXC):
```bash
# Na pasta /home/luis/Documents/proxmox/nginx
make deploy-acs
```

---

## 4. Ajustes Recomendados no Frontend (`gatuno/web`)

### 4.1. Ajuste no Express SSR (`src/server.ts`)

Configurar `setHeaders` no `express.static` para que o servidor local não defina cache de 1 ano para arquivos de inicialização ou Service Worker:

```typescript
// src/server.ts
app.get(
	'**',
	express.static(browserDistFolder, {
		maxAge: '1y',
		index: 'index.html',
		setHeaders: (res, path) => {
			// Arquivos que nunca devem ter cache longo
			if (
				path.endsWith('.html') ||
				path.endsWith('ngsw.json') ||
				path.endsWith('custom-sw.js') ||
				path.endsWith('ngsw-worker.js') ||
				path.endsWith('safety-worker.js') ||
				path.endsWith('manifest.webmanifest')
			) {
				res.setHeader(
					'Cache-Control',
					'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
				);
				res.setHeader('Pragma', 'no-cache');
				res.setHeader('Expires', '0');
			}
		},
	}),
);

// Na renderização SSR (app.get('**')):
app.get('**', (req, res, next) => {
	// ...
	commonEngine.render({ ... })
		.then((html) => {
			res.setHeader(
				'Cache-Control',
				'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
			);
			res.send(themedHtml);
		})
		.catch((err) => next(err));
});
```

### 4.2. Auto-Atualização com Angular `SwUpdate`

Para que os clientes ativos no navegador recebam a versão nova sem precisar adivinhar que houve deploy, crie o serviço `UpdateService`:

```typescript
// src/app/core/services/update.service.ts
import { inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UpdateService {
	private readonly swUpdate = inject(SwUpdate);

	constructor() {
		if (!this.swUpdate.isEnabled) {
			return;
		}

		// Escuta eventos de nova versão baixada em segundo plano
		this.swUpdate.versionUpdates
			.pipe(
				filter(
					(evt): evt is VersionReadyEvent =>
						evt.type === 'VERSION_READY',
				),
			)
			.subscribe(() => {
				console.log('[PWA] Nova versão detectada e pronta.');
				// Ativa a nova versão e recarrega a página automaticamente
				this.swUpdate.activateUpdate().then(() => {
					window.location.reload();
				});
			});

		// Opcional: verificar atualizações quando o usuário volta para a aba
		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') {
					this.swUpdate.checkForUpdate();
				}
			});
		}
	}
}
```

E inicialize o serviço no `AppComponent` (`src/app/app.component.ts`):

```typescript
export class AppComponent {
	private readonly updateService = inject(UpdateService);
	// ...
}
```

---

## 5. Como Testar e Validar

1. **Testar cabeçalhos via Terminal:**
   ```bash
   # HTML / Navegação (deve retornar no-store, no-cache)
   curl -I https://gatuno.canto.internal/

   # Manifesto do Service Worker (deve retornar no-store, no-cache)
   curl -I https://gatuno.canto.internal/ngsw.json

   # Arquivos estáticos com hash (deve retornar max-age=31536000, immutable)
   curl -I https://gatuno.canto.internal/main-*.js
   ```

2. **Verificar no Google Chrome DevTools:**
   - Abra **DevTools (F12) > Network**.
   - Ao acessar a página, selecione a requisição do documento raiz:
     - `Cache-Control` deve ser `no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`.
   - Na aba **Application > Service Workers**:
     - O worker deve estar ativo e verificar periodicamente o `/ngsw.json` com status `200` ou `304` direto da rede, nunca `(from disk cache)`.
