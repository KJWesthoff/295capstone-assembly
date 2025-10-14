FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy the scanner source code and requirements
COPY scanner-service/scanner/ ./scanner/
COPY scanner-service/requirements.txt ./requirements.txt
COPY scanner-service/pyproject.toml ./pyproject.toml
COPY scanner-service/templates/ ./templates/

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install additional dependencies
RUN pip install --no-cache-dir \
    boto3>=1.34.0

# Copy wrapper script
COPY venti_wrapper.py /app/venti_wrapper.py

# Create wrapper script that adds dangerous and fuzz-auth options
RUN echo '#!/bin/bash\npython /app/venti_wrapper.py "$@"' > /usr/local/bin/venti && \
    chmod +x /usr/local/bin/venti

# Create necessary directories for shared volumes
RUN mkdir -p /shared/results /shared/specs

# Set the default entrypoint to use the venti command
ENTRYPOINT ["venti"]

# Default command (will be overridden by docker run arguments)
CMD ["--help"]