import {
	Directive,
	Input,
	TemplateRef,
	ViewContainerRef,
	inject,
	effect,
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
	private permissions: string | string[] = [];

	@Input() set appHasPermission(val: string | string[]) {
		this.permissions = val;
		this.updateView();
	}

	constructor() {
		// Update view when user profile changes
		effect(() => {
			// This registers the effect on profileSignal via hasPermission
			this.updateView();
		});
	}

	private updateView() {
		const hasPerm = this.userService.hasPermission(this.permissions);

		if (hasPerm && !this.hasView) {
			this.viewContainer.createEmbeddedView(this.templateRef);
			this.hasView = true;
		} else if (!hasPerm && this.hasView) {
			this.viewContainer.clear();
			this.hasView = false;
		}
	}
}
