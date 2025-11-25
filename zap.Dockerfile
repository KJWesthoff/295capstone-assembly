# ZAP Scanner Docker Image
# Based on official OWASP ZAP stable image with custom configurations

FROM ghcr.io/zaproxy/zaproxy:stable

# Set working directory
WORKDIR /zap

# Install additional tools if needed
USER root
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create necessary directories and set permissions
RUN mkdir -p /zap/wrk/results /zap/specs && \
    chown -R zap:zap /zap/wrk /zap/specs

# Stay as root to avoid permission issues with mounted volumes
# This is needed because Docker volumes are often owned by root
USER root

# Copy custom ZAP configurations (if needed)
# COPY zap-config/ /zap/

# Set default command to run ZAP API scan
ENTRYPOINT ["zap-api-scan.py"]
CMD ["--help"]