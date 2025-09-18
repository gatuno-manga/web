import { Routes } from "@angular/router";
import { ProfileComponent } from "./profile/profile.component";
import { FilterComponent } from "./filter/filter.component";

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'filter',
    },
    {
        path: 'filter',
        component: FilterComponent,
    },
    {
        path: 'profile',
        component: ProfileComponent,
    }
]
