# Nuclei Scanner Container
FROM golang:1.21-alpine AS builder

# Install git for nuclei templates
RUN apk add --no-cache git

# Build Nuclei from source
RUN go install -v github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

# Runtime image
FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Copy nuclei binary
COPY --from=builder /go/bin/nuclei /usr/bin/nuclei

# Install Python wrapper dependencies
COPY requirements.txt /app/
RUN pip3 install --no-cache-dir -r /app/requirements.txt

# Copy scanner wrapper and templates
COPY nuclei_wrapper.py /app/scanner_wrapper.py
COPY nuclei.yaml /app/nuclei.yaml

# Create directories
RUN mkdir -p /app/templates /input /output /shared \
    && chmod 755 /app/templates /input /output /shared

# Download nuclei templates
RUN nuclei -update-templates -templates-directory /app/templates

# Set working directory
WORKDIR /app

# Standard volumes for scanner interface
VOLUME ["/input", "/output", "/shared"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python3 scanner_wrapper.py --health-check || exit 1

# Entry point
ENTRYPOINT ["python3", "scanner_wrapper.py"]