# Στάδιο 1: Χτίσιμο της εφαρμογής (TanStack / Vite)
FROM node:20-alpine AS builder
WORKDIR /app

# Ορισμός ARG & ENV για να περάσουν οι VITE_ μεταβλητές στο build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_STRIPE_PUBLISHABLE_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY

COPY package*.json ./
RUN npm ci --no-audit --progress=false --force
COPY . .
RUN npm run build

# Στάδιο 2: Στήσιμο του Nginx με το σωστό Routing
FROM nginx:alpine

# ΑΛΛΑΓΗ: Το Nitro/TanStack παράγει τα static αρχεία στο /app/.output/public αντί για το /app/dist
COPY --from=builder /app/.output/public /usr/share/nginx/html

# Δημιουργία του σωστού Nginx Config για να μην βγάζει 404 στα client routes
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
    error_page 404 /404.html; \
    error_page 500 502 503 504 /50x.html; \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]