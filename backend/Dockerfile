# --- Étape de construction ---
FROM rust:1.93-slim AS builder

# Installation des dépendances système nécessaires à la compilation
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    perl \
    make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ASTUCE : On copie les fichiers de dépendances d'abord
# Cela permet de mettre en cache la compilation des bibliothèques (très long)
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/rtc_backend*

# Maintenant on copie le vrai code source
COPY . .
RUN cargo build --release

# --- Étape d'exécution ---
FROM debian:bookworm-slim
WORKDIR /app

# On installe juste ce qu'il faut pour faire tourner le binaire
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# On récupère le binaire compilé
COPY --from=builder /app/target/release/rtc-backend .

EXPOSE 3000
CMD ["./rtc-backend"]