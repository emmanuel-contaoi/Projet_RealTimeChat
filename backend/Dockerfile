# Compilation du backend Rust
FROM rust:1.93-slim AS builder

# Outils pour compiler les libs SSL
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    perl \
    make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# On copie les deps en premier pour profiter du cache Docker
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/backend*

# On copie le vrai code et on compile
COPY . .
RUN cargo build --release

# Image finale legere
FROM debian:bookworm-slim
WORKDIR /app

# Juste les libs pour faire tourner le binaire
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# On recupere le binaire compile
COPY --from=builder /app/target/release/backend .

EXPOSE 3001
CMD ["./backend"]
