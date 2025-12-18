# ClearCut Starter (Free Background Remover)
This is a minimal production-minded starter:
- `web/` Next.js (App Router) + Tailwind
- `api/` FastAPI + rembg for background removal
- `docker-compose.yml` to run both locally

## Run with Docker
1) Copy env files:
- `cp web/.env.example web/.env.local`
- `cp api/.env.example api/.env`
2) Start:
- `docker compose up --build`
3) Open:
- Web: http://localhost:3000/remove-background
- API: http://localhost:8000/docs
