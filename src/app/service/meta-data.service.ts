import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Meta, MetaDefinition, Title } from '@angular/platform-browser';

interface MetaDataOptions {
	title?: string;
	description?: string;
	image?: string;
	url?: string;
	robots?: string;
	keywords?: string | string[];
	author?: string;
}

@Injectable({
	providedIn: 'root',
})
export class MetaDataService {
	private managedTags: HTMLMetaElement[] = [];
	private defaultMeta: MetaDataOptions = {
		title: 'Gatuno',
		description: 'Seu acervo local de livros',
		robots: 'index, follow',
		keywords: 'livros, leitura, biblioteca',
	};

	constructor(
		private metaService: Meta,
		private titleService: Title,
		@Inject(DOCUMENT) private doc: Document,
		private router: Router,
	) {
		this.router.events.subscribe((event) => {
			if (event instanceof NavigationEnd) {
				this.initDefaultMeta();
			}
		});
	}

	initDefaultMeta(): void {
		this.setMetaData(this.defaultMeta);
	}

	setMetaData(options: MetaDataOptions): void {
		this.clearMetaTags();
		const mergedOptions = { ...this.defaultMeta, ...options };
		if (mergedOptions.title) this.setTitle(mergedOptions.title);
		if (mergedOptions.description)
			this.setDescription(mergedOptions.description);
		if (mergedOptions.image) this.setImage(mergedOptions.image);
		if (mergedOptions.url) this.setUrl(mergedOptions.url);
		if (mergedOptions.robots) this.setRobots(mergedOptions.robots);
		if (mergedOptions.keywords) this.setKeywords(mergedOptions.keywords);
		if (mergedOptions.author) this.setAuthor(mergedOptions.author);
		this.setOpenGraph();
		this.setTwitter();
	}

	setTitle(title: string): void {
		const resolvedTitle =
			title !== this.defaultMeta.title ? `${title} | Gatuno` : title;
		this.titleService.setTitle(resolvedTitle);
		this.metaService.addTag({
			property: 'og:site_name',
			content: resolvedTitle,
		});
		this.metaService.addTag({
			name: 'twitter:site',
			content: resolvedTitle,
		});
	}

	setDescription(description: string): void {
		this.updateTag({ name: 'description', content: description });
		this.updateTag({ property: 'og:description', content: description });
		this.updateTag({ name: 'twitter:description', content: description });
	}

	setImage(imageUrl: string): void {
		this.updateTag({ property: 'og:image', content: imageUrl });
		this.updateTag({ name: 'twitter:image', content: imageUrl });
	}

	setUrl(url: string): void {
		this.updateTag({ property: 'og:url', content: url });
		this.updateTag({ name: 'twitter:url', content: url });
		this.updateCanonicalLink(url);
	}

	setRobots(robots: string): void {
		this.updateTag({ name: 'robots', content: robots });
		this.updateTag({ name: 'googlebot', content: robots });
	}

	setKeywords(keywords: string | string[]): void {
		const keywordsContent = Array.isArray(keywords)
			? keywords.join(', ')
			: keywords;
		this.updateTag({ name: 'keywords', content: keywordsContent });
	}

	setAuthor(author: string): void {
		this.updateTag({ name: 'author', content: author });
	}

	setOpenGraph() {
		this.updateTag({ property: 'og:type', content: 'website' });
		this.updateTag({ property: 'og:locale', content: 'pt_BR' });
	}

	setTwitter() {
		this.updateTag({
			name: 'twitter:card',
			content: 'summary_large_image',
		});
	}

	private updateTag(tag: MetaDefinition): void {
		const metaElement = this.metaService.updateTag(tag);
		if (metaElement) {
			this.managedTags.push(metaElement);
		}
	}

	clearMetaTags(): void {
		for (const tag of this.managedTags) {
			this.metaService.removeTagElement(tag);
		}
		this.managedTags = [];
	}

	private updateCanonicalLink(url: string): void {
		let link: HTMLLinkElement | null = this.doc.querySelector(
			'link[rel="canonical"]',
		);
		if (link) {
			link.setAttribute('href', url);
		} else {
			link = this.doc.createElement('link');
			link.setAttribute('rel', 'canonical');
			link.setAttribute('href', url);
			this.doc.head.appendChild(link);
		}
	}
}
