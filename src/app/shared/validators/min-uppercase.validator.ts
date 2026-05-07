import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function minUppercaseValidator(minUppercase: number = 1): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const value = control.value;
        if (value) {
            const match = value.match(/[A-Z]/g);
            const count = match ? match.length : 0;
            if (count < minUppercase) {
                return { minUppercase: { requiredLength: minUppercase, actualLength: count } };
            }
        }
        return null;
    };
}
