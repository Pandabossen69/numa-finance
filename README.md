# NUMA

Personlig ekonomisk kontroll — inte bara en budgetapp.

NUMA håller en kontinuerligt uppdaterad och verifierbar bild av dina saldon, utgifter, reserver och hur mycket du tryggt kan spendera.

## Phase 0 (Foundation)

Detta repo innehåller **fas 0**: projektfundament, domänmodell, svensk mobil UI-skal, PWA-grund, lokal vertikal slice och Supabase-schema med RLS.

### Stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS
- Supabase (PostgreSQL, Auth, RLS, Storage) — schema `numa`; lokal JSON-lagring är **dev-only / en användare**
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

Utan Supabase-nycklar kör appen i **lokalt läge** (en användare) och sparar data i `.data/numa-store.json`.  
**Produktion / flera användare kräver Supabase.**

När `NEXT_PUBLIC_SUPABASE_URL` och `NEXT_PUBLIC_SUPABASE_ANON_KEY` är satta aktiveras Supabase-klienterna.

Valfritt: `OPENAI_API_KEY` (server-only) för autoläsning av kvitton. Utan nyckel funkar `/fota` med manuell beloppsinmatning.

Delat projekt: NUMA bor i schema `numa` + bucket `numa-source-media`. Se `docs/SUPABASE-SETUP.md`.

### Vertical slice

1. Ange saldo på **Idag**
2. **+ → Fota kvitto** (eller skriv belopp) och bekräfta mot tryggt idag
3. Se uppdaterat saldo, pulse och spending på **Idag**
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
