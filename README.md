# NUMA

Personlig ekonomisk kontroll — inte bara en budgetapp.

NUMA håller en kontinuerligt uppdaterad och verifierbar bild av dina saldon, utgifter, reserver och hur mycket du tryggt kan spendera.

## Phase 0 (Foundation)

Detta repo innehåller **fas 0**: projektfundament, domänmodell, svensk mobil UI-skal, PWA-grund, lokal vertikal slice och Supabase-schema med RLS.

### Stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS
- Supabase (PostgreSQL, Auth, RLS, Storage) — schema redo; lokal JSON-lagring som default tills nycklar finns
- Zod + React Hook Form
- Vitest
- PWA (manifest + service worker)

### Quick start

```bash
npm install
npm run icons
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000) — du skickas till `/idag`.

### Useful commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Environment

Kopiera `.env.example` till `.env.local`.

Utan Supabase-nycklar kör appen i **lokalt läge** och sparar data i `.data/numa-store.json`.

När `NEXT_PUBLIC_SUPABASE_URL` och `NEXT_PUBLIC_SUPABASE_ANON_KEY` är satta aktiveras Supabase-klienterna.

Delat projekt: NUMA bor i schema `numa` + bucket `numa-source-media`. Se `docs/SUPABASE-SETUP.md`.

### Vertical slice

1. Skapa konto + verifierat/ingående saldo
2. Lägg till manuell utgift via **+**
3. Se uppdaterat beräknat saldo och dagens/månadens spending på **Idag**
4. `tryggt att spendera` beräknas i domänlagret (inte hårdkodat i UI)

### Documentation

- `docs/PRODUCT-VISION.md`
- `docs/ARCHITECTURE.md`
- `docs/FINANCIAL-INVARIANTS.md`
- `docs/DATA-MODEL.md`
- `docs/ROADMAP.md`
- `docs/SUPABASE-SETUP.md`
- `docs/GAMIFICATION.md`

### Language

- **UI:** svenska
- **Kod/docs/DB:** engelska
