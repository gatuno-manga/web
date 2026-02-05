import { Routes } from "@angular/router";
import { LoginComponent } from "./login/login.component";
import { RegisterComponent } from "./register/register.component";
import { isNotLoggedMatchGuard } from "../../guards/auth.guard";

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: '404',
    },
    {
        path: 'login',
        component: LoginComponent,
        canMatch: [isNotLoggedMatchGuard],
    },
    {
        path: 'register',
        component: RegisterComponent,
        canMatch: [isNotLoggedMatchGuard],
    },
]
