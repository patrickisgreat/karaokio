# Karaokio party box: Next.js app + the processing toolchain (ffmpeg, yt-dlp,
# Demucs with baked model weights) in one image, so a cold Fargate task is
# ready to process songs the moment it starts — no first-run model download.

# ── deps: node modules (better-sqlite3 compiles from source) ─────────────────
FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit

# ── build: next build ────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN npm run build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 python3-venv curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp: standalone binary, self-updating not needed inside an immutable image
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

# Demucs in its own venv, CPU-only torch (the CUDA wheels are ~2.5GB heavier
# and Fargate has no GPU). `python` on PATH points into the venv, which is the
# interpreter audioProcessor spawns.
#
# PyPI stays the primary index with the pytorch CPU index as extra: a bare
# --index-url replaces PyPI entirely, which breaks build deps (typing_extensions
# needs flit_core, absent from the pytorch index). At equal versions the +cpu
# local tag outranks the plain PyPI wheel (PEP 440), so CPU builds still win.
RUN python3 -m venv /opt/demucs \
    && /opt/demucs/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/demucs/bin/pip install --no-cache-dir torch torchaudio \
       --extra-index-url https://download.pytorch.org/whl/cpu \
    && /opt/demucs/bin/pip install --no-cache-dir demucs \
    && ln -s /opt/demucs/bin/python /usr/local/bin/python

# Bake the htdemucs weights so first separation doesn't spend minutes
# downloading. TORCH_HOME must match the runtime user's view of the cache.
ENV TORCH_HOME=/opt/torch-cache
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')" \
    && chmod -R a+rX /opt/torch-cache

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.js tailwind.config.js postcss.config.js ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=3000
# All persistent state under one root — in AWS this is the EFS mount.
ENV DATA_ROOT=/data

# uid 1000 = the image's `node` user = the EFS access point's POSIX identity.
USER node
EXPOSE 3000
CMD ["npm", "start"]
