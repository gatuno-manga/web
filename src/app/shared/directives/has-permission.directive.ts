import {
	Directive,
	effect,
	input,
	inject,
	TemplateRef,
	ViewContainerRef,
} from '@angular/core';
import { UserService } from '@core/services/user.service';

@Directive({
	selector: '[appHasPermission]',
	standalone: true,
})
export class HasPermissionDirective {
	private templateRef = inject(TemplateRef);
	private viewContainer = inject(ViewContainerRef);
	private userService = inject(UserService);

	private hasView = false;
	appHasPermission = input.required<string | string[]>();

	constructor() {
		// Update view when user profile changes or permissions input changes
		effect(() => {
			this.updateView();
		});
	}

	private updateView() {
		const permissions = this.appHasPermission();
		const hasPerm = this.userService.hasPermission(permissions);

		if (hasPerm && !this.hasView) {
			this.viewContainer.createEmbeddedView(this.templateRef);
			this.hasView = true;
		} else if (!hasPerm && this.hasView) {
			this.viewContainer.clear();
			this.hasView = false;
		}
	}
}
