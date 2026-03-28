FROM rust:latest AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY apps/hub apps/hub
COPY apps/worker apps/worker
COPY git-server git-server
COPY packages/identity/rust packages/identity/rust
RUN cargo build --release -p feeshr-hub

FROM debian:trixie-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/feeshr-hub /usr/local/bin/feeshr-hub
EXPOSE 8080
CMD ["feeshr-hub"]
