FROM jenkins/jenkins:lts-jdk17

USER root

# Install Docker CLI so Jenkins can build/run containers via the host socket
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        lsb-release && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
        https://download.docker.com/linux/debian \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin && \
    rm -rf /var/lib/apt/lists/*

# Allow jenkins user to use the Docker socket mounted from the host
RUN groupadd -f docker && usermod -aG docker jenkins

# Fix Docker socket permissions on macOS where /var/run/docker.sock is owned by root
RUN printf '#!/bin/sh\nchmod 666 /var/run/docker.sock\nexec "$@"\n' > /entrypoint.sh \
    && chmod +x /entrypoint.sh

USER jenkins

# Pre-install suggested plugins (runs on first boot)
RUN jenkins-plugin-cli --plugins \
        git \
        workflow-aggregator \
        docker-workflow \
        blueocean \
        credentials-binding \
        pipeline-stage-view
