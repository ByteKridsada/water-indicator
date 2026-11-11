# Stage 1: build the React app into static files with Node.
# Build context is the repo root (see docker-compose.yml) so the root .dockerignore applies.
FROM node:22-alpine AS build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend ./
# Relative path: the browser calls /api/v1 on whatever address served the page,
# so the same build works behind the tunnel, on a VPS, or on any later domain.
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

# Stage 2: serve only the built files with nginx; Node and the sources are left behind.
FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
