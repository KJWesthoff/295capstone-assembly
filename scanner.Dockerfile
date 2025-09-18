FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy the external scanner source from submodule
COPY external-scanner/ventiapi-scanner/ ./

# Install Python dependencies from the original requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install additional dependency needed for the scanner
RUN pip install boto3>=1.34.0

# Install the scanner package in editable mode
RUN pip install -e .

# Create a simple wrapper script that uses the proper CLI entry point
RUN echo '#!/bin/bash\npython -m scanner.cli "$@"' > /usr/local/bin/venti && \
    chmod +x /usr/local/bin/venti

# Create necessary directories for shared volumes
RUN mkdir -p /shared/results /shared/specs

# Set the default entrypoint to use the venti command
ENTRYPOINT ["venti"]

# Default command (will be overridden by docker run arguments)
CMD ["--help"]