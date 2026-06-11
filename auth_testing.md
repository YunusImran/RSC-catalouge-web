# Auth Testing Playbook (Fabric Catalog)

Admin credentials seeded on startup:
- Email: admin@fabriccatalog.com
- Password: Admin@123

## Endpoints
All under /api/auth: login, logout, me, refresh, change-password, forgot-password, reset-password.

Cookies: access_token (15 min), refresh_token (7 days), httpOnly, samesite=lax.

## MongoDB verification
- users collection should have admin user with bcrypt hash starting `$2b$`
- Indexes: users.email unique, login_attempts.identifier, password_reset_tokens.expires_at TTL

## Curl
```
curl -c c.txt -X POST $URL/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@fabriccatalog.com","password":"Admin@123"}'
curl -b c.txt $URL/api/auth/me
```
