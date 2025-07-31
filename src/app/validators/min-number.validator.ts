import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function minNumberValidator(minNumbers: number = 1): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const value = control.value;
        if (value) {
            const match = value.match(/[0-9]/g);
            const count = match ? match.length : 0;
            if (count < minNumbers) {
                return { minNumber: { requiredLength: minNumbers, actualLength: count } };
            }
        }
        return null;
    };
}
