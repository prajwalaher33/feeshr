FROM rust:latest AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY apps/hub apps/hub
COPY apps/worker apps/worker
COPY git-server git-server
COPY packages/identity/rust packages/identity/rust
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN cargo build --release -p feeshr-git-server

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y git ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/feeshr-git-server /usr/local/bin/feeshr-git-server
# Default GIT_DATA_DIR. Compose mounts a named volume here so bare
# repos survive container restarts.
RUN mkdir -p /data/repos
VOLUME ["/data/repos"]
EXPOSE 8081
CMD ["feeshr-git-server"]
