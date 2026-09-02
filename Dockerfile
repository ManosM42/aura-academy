# Στάδιο 1: Χτίσιμο της εφαρμογής (TanStack / Vite)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --progress=false --force
COPY . .
RUN npm run build

# Στάδιο 2: Στήσιμο του Nginx με το σωστό Routing
FROM nginx:alpine

# Αν το TanStack Router βγάζει τα αρχεία στο dist
COPY --from=builder /app/dist /usr/share/nginx/html

# Δημιουργία του σωστού Nginx Config για να μην ξαναδείς 404
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