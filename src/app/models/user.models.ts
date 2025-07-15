export interface loginRequest {
    email: string;
    password: string;
}

export interface loginResponse {
    accessToken: string;
    refreshToken: string;
}

export interface payloadToken {
    email: string;
    sub: string;
    roles: Role[];
    iss: string;
    iat: number;
    exp: number;
}

export enum Role {
    USER = 'user',
    ADMIN = 'admin'
}

export interface registerRequest {
    email: string;
    password: string;
}
