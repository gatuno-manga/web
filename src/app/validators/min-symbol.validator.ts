import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function minSymbolValidator(minSymbols: number = 1): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const value = control.value;
        if (value) {
            // Regex expandido para todos os símbolos ASCII comuns
            const match = value.match(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g);
            const count = match ? match.length : 0;
            if (count < minSymbols) {
                return { minSymbol: { requiredLength: minSymbols, actualLength: count } };
            }
        }
        return null;
    };
}
