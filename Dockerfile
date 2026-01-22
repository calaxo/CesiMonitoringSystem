# Utilise l'image Node.js officielle comme base
FROM node:18-alpine AS base

# Installe les dépendances seulement quand nécessaire
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Installe les dépendances basées sur le gestionnaire de paquets préféré
COPY hutc/package.json hutc/package-lock.json* ./
RUN npm ci

# Reconstruit le code source seulement quand nécessaire
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY hutc/ .

# Next.js collecte des données de télémétrie complètement anonymes sur l'utilisation générale.
# Apprenez-en plus ici: https://nextjs.org/telemetry
# Décommentez la ligne suivante au cas où vous voudriez désactiver la télémétrie lors du build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Image de production, copie tous les fichiers et lance next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Décommentez la ligne suivante au cas où vous voudriez désactiver la télémétrie lors du runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copier les fichiers nécessaires depuis le builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
# définir le nom d'hôte à localhost
ENV HOSTNAME="0.0.0.0"

# Lancer Next.js en mode production
CMD ["npm", "start"]