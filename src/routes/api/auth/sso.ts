
import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { auth } from "@/integrations/auth/config";
import { env } from "@/utils/env";
import { scryptSync } from "node:crypto";

async function handler({ request }: { request: Request }) {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    const errorRedirect = (error: string) => {
        return new Response(null, {
            status: 302,
            headers: {
                Location: `/auth/login?error=${error}`,
            },
        });
    };

    if (!token) {
        return errorRedirect("missing_token");
    }

    try {
        const secret = env.MAIN_APP_SECRET || env.AUTH_SECRET;
        if (!secret) {
            console.error("Missing MAIN_APP_SECRET or AUTH_SECRET");
            return errorRedirect("server_configuration");
        }

        const decoded = jwt.verify(token, secret) as {
            email: string;
            name: string;
            username: string;
            userId: string;
        };

        if (!decoded.email) {
            return errorRedirect("invalid_token_payload");
        }

        // Generate deterministic password (32 bytes -> 64 hex chars, fitting maxPasswordLength: 64)
        const password = scryptSync(decoded.email, secret, 32).toString("hex");

        // Try to sign in
        let response = await auth.api.signInEmail({
            body: {
                email: decoded.email,
                password,
            },
            asResponse: true, 
        });

        // If sign in fails, try to sign up
        if (!response.ok) {
            response = await auth.api.signUpEmail({
                body: {
                    email: decoded.email,
                    password,
                    name: decoded.name,
                    username: decoded.username || decoded.email.split("@")[0],
                },
                asResponse: true
            });
        }

        if (!response.ok) {
            console.error("Failed to sign in/up user via SSO", await response.text());
            return errorRedirect("sso_failed");
        }
        
        // Forward the Set-Cookie headers
        const headers = new Headers();
        response.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'set-cookie') {
                headers.append(key, value);
            }
        });

        // Redirect to dashboard
        headers.set("Location", "/dashboard");
        return new Response(null, {
            status: 302,
            headers
        });

    } catch (e) {
        console.error("SSO Token Verification Failed", e);
        return errorRedirect("invalid_token");
    }
}

export const Route = createFileRoute("/api/auth/sso")({
    server: {
        handlers: {
            GET: handler,
        }
    }
});
