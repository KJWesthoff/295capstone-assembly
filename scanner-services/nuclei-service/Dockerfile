FROM python:3.11-slim

# Install Nuclei
RUN apt-get update && apt-get install -y curl unzip && \
    curl -L -o nuclei.zip "https://github.com/projectdiscovery/nuclei/releases/download/v3.4.10/nuclei_3.4.10_linux_amd64.zip" && \
    unzip nuclei.zip && \
    mv nuclei /usr/local/bin/ && \
    chmod +x /usr/local/bin/nuclei && \
    rm nuclei.zip && \
    apt-get remove -y curl unzip && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY main.py .

# Create nuclei config directory
RUN mkdir -p /root/.config/nuclei

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["python", "main.py"]