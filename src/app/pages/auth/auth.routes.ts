import { Routes } from "@angular/router";
import { LoginComponent } from "./login/login.component";
import { RegisterComponent } from "./register/register.component";
import { inject } from "@angular/core";
import { AuthenticateGuard } from "../../guards/auth.guard";

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: '404',
    },
    {
        path: 'login',
        component: LoginComponent,
        canMatch: [() => inject(AuthenticateGuard).isNotLogged()],
    },
    {
        path: 'register',
        component: RegisterComponent,
        canMatch: [() => inject(AuthenticateGuard).isNotLogged()],
    },
]
