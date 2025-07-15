import { Routes } from "@angular/router";
import { profile } from "console";
import { ProfileComponent } from "./profile/profile.component";

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'profile',
    },
    {
        path: 'profile',
        component: ProfileComponent,
    }
]
