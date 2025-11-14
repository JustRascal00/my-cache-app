# My Cache App

## Overview • მიმოხილვა

**EN** – This Next.js demo showcases a stats service that serves read-heavy traffic from layered caches (in‑memory LRU + Redis) while persisting the source of truth in PostgreSQL. The stack highlights optimistic locking, cache stampede mitigation, and graceful fallbacks.

**KA** – ეს Next.js დემო წარმოადგენს სტატისტიკის სერვისს, რომელიც კითხვებზე ორიენტირებულ ტრაფიკს ამუშავებს მრავალშრიანი ქეშით (ინ-მემორი LRU + Redis) და სინამდვილეს PostgreSQL-ში ინახავს. აქცენტი კეთდება ოპტიმისტურ ლოქინგზე, ქეშ-სტამპიდის თავიდან აცილებაზე და უსაფრთხო პადენებზე.

## Backend Flow • უკანა ნაწილი

**EN**
- `GET /api/stats/get` first inspects the local LRU cache (`lib/cache.ts`).  
- On a miss it checks Redis (`lib/redis.ts`).  
- If both caches miss or are stale, it fetches the latest row from PostgreSQL via `lib/db.ts`.  
- Optimistic locking uses the `updated_at` + `version` pair to ensure that concurrent updates don’t overwrite each other.  
- To prevent cache stampedes, the handler acquires a Redis lock with `SETNX`; while the lock is held, other readers receive the most recent stale payload.  
- Fresh DB reads hydrate both Redis and the LRU cache, keeping subsequent requests hot.

**KA**
- `GET /api/stats/get` ჯერ ლოკალურ LRU ქეშს ამოწმებს (`lib/cache.ts`).  
- ქეშის აცდენისას Redis-ის ქეში მოწმდება (`lib/redis.ts`).  
- თუ მონაცემი კვლავ ვერ მოიძებნა, გამოიყენება PostgreSQL (`lib/db.ts`) და იკითხება ბოლო ჩანაწერი.  
- ოპტიმისტური ლოქინგი `updated_at` და `version` ველებს იყენებს, რათა პარალელურმა განახლებებმა ერთმანეთს არ გადაჰყვეს.  
- ქეშ-სტამპიდის ასაცილებლად API იღებს Redis-ის ლოქს (`SETNX`); ლოქის ქონისას სხვა მოთხოვნები დროებით ბოლო ძველ მონაცემს იღებენ.  
- მონაცემის განახლებას ახლავს Redis-ისა და ინ-მემორი ქეშის სინქრონიზაცია, რაც შემდეგ კითხვებს აჩქარებს.

## Frontend Flow • ფრონტენდი

**EN**
- `pages/index.tsx` renders a compact dashboard with “Fetch stats” and “Export JSON” actions.  
- Clicking fetch shows a loading state, calls the API, streams the response JSON, and highlights whether the payload came from cache or DB.  
- Errors (network, API, lock contention) surface inline with context, and users can download the exact payload for auditing.

**KA**
- `pages/index.tsx` გთავაზობთ მინიმალისტურ დაფას ღილაკებით „სტატისტიკის მიღება“ და „JSON ექსპორტი“.  
- მოთხოვნის დაწყებისას ჩანს დატვირთვის სტატუსი, შემდეგ კი წარმოჩინდება მიღებული JSON და წყარო (ქეში თუ ბაზა).  
- შეცდომები (ქსელი, API, ლოქი) ეკრანზე გასაგები ტექსტით ჩანს, ხოლო მიღებული ინფორმაცია შესაძლებელია JSON ფაილად ჩამოიტვირთოს.

## Data Lifecycle • მონაცემების ციკლი

1. **Warm cache path** – majority of requests are satisfied by the LRU cache; Redis acts as the cross-instance backup.  
2. **Cold start** – first miss locks Redis, reads PostgreSQL, validates `updated_at`, hydrates caches, and releases the lock.  
3. **Stale serve** – if another worker holds the lock, degraded responses return a cached snapshot with `degraded=true`, keeping latency predictable.  
4. **Export** – frontend can download any response exactly as served, enabling HR/reporting teams to archive snapshots.

**KA Summary** – ძირითადი კითხვები LRU ქეშიდან პასუხობს, Redis უზრუნველყოფს თავშესაფარს მრავალ ინსტანციაზე; პირველი ცივი კითხვა იღებს ლოქს, კითხულობს PostgreSQL-ს, აახალგაზრდავებს ქეშებს და ათავისუფლებს ლოქს; კონკურენტული კითხვები საჭიროების შემთხვევაში ძველ მონაცემს იღებს; UI ნებისმიერ პასუხს JSON ფაილად ინახავს.

